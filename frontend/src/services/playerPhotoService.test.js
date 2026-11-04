import { supabase } from "./supabase";
import { optimizePlayerPhoto } from "../utils/playerPhotoOptimization";
import { getPlayerPhotoUrl, uploadPlayerPhoto } from "./playerPhotoService";

jest.mock("./supabase", () => ({
  supabase: { from: jest.fn(), storage: { from: jest.fn() } },
}));
jest.mock("../utils/playerPhotoOptimization", () => ({
  MAX_STORED_PLAYER_PHOTO_BYTES: 150 * 1024,
  optimizePlayerPhoto: jest.fn(),
}));

const player = {
  id: "11111111-1111-4111-8111-111111111111",
  academy_id: "22222222-2222-4222-8222-222222222222",
};
const previousPath = `${player.academy_id}/${player.id}/old-photo.png`;
const original = new File(["original bytes"], "camera.jpg", { type: "image/jpeg" });

let photoRow;
let optimized;
let bucket;
let flags;
let extraRows;
let updateCalls;

const query = (mode, payload) => {
  const filters = {};
  const chain = {
    eq: jest.fn((field, value) => { filters[field] = value; return chain; }),
    is: jest.fn((field, value) => { filters[field] = value; return chain; }),
    select: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    maybeSingle: jest.fn(async () => {
      if (mode === "update") {
        updateCalls.push({ payload, filters: { ...filters } });
        if (flags.casConflict) {
          photoRow.profile_image = "another-update.webp";
          return { data: null, error: null };
        }
        if (filters.profile_image !== photoRow.profile_image) return { data: null, error: null };
        if (flags.updateError) return { data: null, error: new Error("Update denied") };
        photoRow.profile_image = payload.profile_image;
        if (flags.errorAfterCommit) return { data: null, error: new Error("Response lost") };
        return { data: { id: player.id, profile_image: photoRow.profile_image }, error: null };
      }
      if (flags.readError) return { data: null, error: new Error("Read denied") };
      if (flags.hiddenPlayer ||
          filters.id !== player.id || filters.academy_id !== player.academy_id) {
        return { data: null, error: null };
      }
      return { data: { ...photoRow }, error: null };
    }),
    then: (resolve, reject) => {
      if (flags.referenceError) {
        return Promise.resolve({ data: null, error: new Error("Reference query failed") }).then(resolve, reject);
      }
      const found = [photoRow, ...extraRows].filter((row) =>
        row.academy_id === filters.academy_id &&
        row.profile_image === filters.profile_image
      );
      return Promise.resolve({ data: found.slice(0, 1).map((row) => ({ id: row.id })), error: null }).then(resolve, reject);
    },
  };
  return chain;
};

beforeEach(() => {
  jest.clearAllMocks();
  flags = {};
  extraRows = [];
  updateCalls = [];
  photoRow = { ...player, profile_image: previousPath };
  optimized = new File([new Uint8Array(65 * 1024)], "player-photo.webp", { type: "image/webp" });
  optimizePlayerPhoto.mockResolvedValue(optimized);

  bucket = {
    upload: jest.fn().mockResolvedValue({ error: null }),
    remove: jest.fn(async (paths) => ({ data: paths.map((name) => ({ name })), error: flags.removeError ? new Error("Delete denied") : null })),
    createSignedUrl: jest.fn(async () => (
      flags.signedError
        ? { data: null, error: new Error("Sign failed") }
        : { data: { signedUrl: "https://signed.example/photo" }, error: null }
    )),
  };
  supabase.storage.from.mockReturnValue(bucket);
  supabase.from.mockImplementation((table) => {
    if (table !== "players") throw new Error("Unexpected table " + table);
    return {
      select: jest.fn(() => query("select")),
      update: jest.fn((payload) => query("update", payload)),
    };
  });
});

test("uploads only compressed WebP, conditionally updates the player and removes old object", async () => {
  const result = await uploadPlayerPhoto({ player, file: original });
  expect(optimizePlayerPhoto).toHaveBeenCalledWith(original);
  expect(bucket.upload).toHaveBeenCalledWith(
    expect.stringMatching(new RegExp(`^${player.academy_id}/${player.id}/.+\\.webp$`)),
    optimized,
    { cacheControl: "3600", contentType: "image/webp", upsert: false }
  );
  expect(bucket.upload.mock.calls[0][1]).not.toBe(original);
  expect(updateCalls[0].payload).toEqual({ profile_image: result.path });
  expect(updateCalls[0].filters).toMatchObject({ id: player.id, academy_id: player.academy_id, profile_image: previousPath });
  expect(bucket.remove).toHaveBeenCalledWith([previousPath]);
  expect(result.url).toBe("https://signed.example/photo");
  expect(result.cleanupWarning).toBeNull();
});

test("first photo upload uses IS NULL and never attempts to delete an old file", async () => {
  photoRow.profile_image = null;
  const result = await uploadPlayerPhoto({ player, file: original });
  expect(updateCalls[0].filters.profile_image).toBeNull();
  expect(bucket.remove).not.toHaveBeenCalled();
  expect(result.cleanupWarning).toBeNull();
});

test("does not delete an old photo still referenced by another player", async () => {
  extraRows = [{ ...player, id: "second-player", profile_image: previousPath }];
  const result = await uploadPlayerPhoto({ player, file: original });
  expect(bucket.remove).not.toHaveBeenCalled();
  expect(result.cleanupWarning).toMatch(/still referenced/);
});

test("does not delete an object from an untrusted or foreign path", async () => {
  photoRow.profile_image = "other-academy/another-player/photo.png";
  const result = await uploadPlayerPhoto({ player, file: original });
  expect(bucket.remove).not.toHaveBeenCalled();
  expect(result.cleanupWarning).toBeNull();
});

test("storage cleanup failure is nonfatal after a successful database update", async () => {
  flags.removeError = true;
  const result = await uploadPlayerPhoto({ player, file: original });
  expect(result.path).toBe(photoRow.profile_image);
  expect(result.cleanupWarning).toMatch(/previous file could not be removed/);
  expect(bucket.remove).toHaveBeenCalledWith([previousPath]);
});

test("reference lookup failure retains old object and reports warning", async () => {
  flags.referenceError = true;
  const result = await uploadPlayerPhoto({ player, file: original });
  expect(result.cleanupWarning).toMatch(/previous file could not be removed/);
  expect(bucket.remove).not.toHaveBeenCalled();
});

test("failed conditional database update removes only uncommitted new upload", async () => {
  flags.updateError = true;
  await expect(uploadPlayerPhoto({ player, file: original })).rejects.toThrow("Update denied");
  const newPath = bucket.upload.mock.calls[0][0];
  expect(photoRow.profile_image).toBe(previousPath);
  expect(bucket.remove).toHaveBeenCalledWith([newPath]);
  expect(bucket.remove).not.toHaveBeenCalledWith([previousPath]);
});

test("concurrent replacement cannot overwrite another upload, and rolls back its own new object", async () => {
  flags.casConflict = true;
  await expect(uploadPlayerPhoto({ player, file: original })).rejects.toThrow("changed during upload");
  const newPath = bucket.upload.mock.calls[0][0];
  expect(bucket.remove).toHaveBeenCalledWith([newPath]);
  expect(bucket.remove).not.toHaveBeenCalledWith([previousPath]);
});

test("ambiguous update response does not delete an object already referenced in DB", async () => {
  flags.errorAfterCommit = true;
  const result = await uploadPlayerPhoto({ player, file: original });
  expect(result.path).toBe(photoRow.profile_image);
  expect(bucket.remove).toHaveBeenCalledWith([previousPath]);
  expect(bucket.remove).not.toHaveBeenCalledWith([result.path]);
});

test("read permission failure stops before uploading anything", async () => {
  flags.hiddenPlayer = true;
  await expect(uploadPlayerPhoto({ player, file: original })).rejects.toThrow("access could not be verified");
  expect(bucket.upload).not.toHaveBeenCalled();
});

test("optimization failure never uploads original or reads private player data", async () => {
  optimizePlayerPhoto.mockRejectedValue(new Error("Choose an original photo no larger than 10 MB."));
  await expect(uploadPlayerPhoto({ player, file: original })).rejects.toThrow("10 MB");
  expect(bucket.upload).not.toHaveBeenCalled();
  expect(supabase.from).not.toHaveBeenCalled();
});

test("oversized optimized output cannot reach Storage", async () => {
  optimizePlayerPhoto.mockResolvedValue(new File([new Uint8Array(151 * 1024)], "too-large.webp", { type: "image/webp" }));
  await expect(uploadPlayerPhoto({ player, file: original })).rejects.toThrow("under 150 KB");
  expect(bucket.upload).not.toHaveBeenCalled();
});

test("signed URL failures do not misreport an already committed update as upload failure", async () => {
  flags.signedError = true;
  const result = await uploadPlayerPhoto({ player, file: original });
  expect(result.path).toBe(photoRow.profile_image);
  expect(result.url).toBeNull();
  expect(result.cleanupWarning).toMatch(/preview could not be refreshed/);
});

test("legacy private JPG remains readable and public URLs remain rejected", async () => {
  expect(await getPlayerPhotoUrl(previousPath)).toBe("https://signed.example/photo");
  expect(bucket.createSignedUrl).toHaveBeenCalledWith(previousPath, 1800);
  await expect(getPlayerPhotoUrl("https://public.example/photo.jpg")).rejects.toThrow("private storage object path");
});
