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

const player = { id: "player-1", academy_id: "academy-1" };
const original = new File(["original bytes"], "camera.jpg", { type: "image/jpeg" });
let optimized;
let bucket;
let update;
let eqId;
let eqAcademy;

beforeEach(() => {
  jest.clearAllMocks();
  optimized = new File([new Uint8Array(65 * 1024)], "player-photo.webp", { type: "image/webp" });
  optimizePlayerPhoto.mockResolvedValue(optimized);
  bucket = {
    upload: jest.fn().mockResolvedValue({ error: null }),
    remove: jest.fn().mockResolvedValue({ error: null }),
    createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: "https://signed.example/photo" }, error: null }),
  };
  supabase.storage.from.mockReturnValue(bucket);
  eqAcademy = jest.fn().mockResolvedValue({ error: null });
  eqId = jest.fn().mockReturnValue({ eq: (...args) => eqAcademy(...args) });
  update = jest.fn().mockReturnValue({ eq: (...args) => eqId(...args) });
  supabase.from.mockReturnValue({ update });
});

test("uploads only optimized WebP, updates scoped profile and signs the private URL", async () => {
  const result = await uploadPlayerPhoto({ player, file: original });
  expect(optimizePlayerPhoto).toHaveBeenCalledWith(original);
  expect(bucket.upload).toHaveBeenCalledWith(
    expect.stringMatching(/^academy-1\/player-1\/.+\.webp$/),
    optimized,
    { cacheControl: "3600", contentType: "image/webp", upsert: false }
  );
  expect(bucket.upload.mock.calls[0][1]).not.toBe(original);
  expect(update).toHaveBeenCalledWith({ profile_image: result.path });
  expect(eqId).toHaveBeenCalledWith("id", player.id);
  expect(eqAcademy).toHaveBeenCalledWith("academy_id", player.academy_id);
  expect(bucket.createSignedUrl).toHaveBeenCalledWith(result.path, 1800);
});

test("compression failure never uploads an original image", async () => {
  optimizePlayerPhoto.mockRejectedValue(new Error("Choose an original photo no larger than 10 MB."));
  await expect(uploadPlayerPhoto({ player, file: original })).rejects.toThrow("10 MB");
  expect(supabase.storage.from).not.toHaveBeenCalled();
  expect(supabase.from).not.toHaveBeenCalled();
});

test("malformed oversized optimizer output is not uploaded", async () => {
  optimizePlayerPhoto.mockResolvedValue(new File([new Uint8Array(151 * 1024)], "too-large.webp", { type: "image/webp" }));
  await expect(uploadPlayerPhoto({ player, file: original })).rejects.toThrow("under 150 KB");
  expect(supabase.storage.from).not.toHaveBeenCalled();
});

test("failed player update cleans up the new object, not an older photo", async () => {
  eqAcademy.mockResolvedValue({ error: new Error("Update denied") });
  await expect(uploadPlayerPhoto({ player, file: original })).rejects.toThrow("Update denied");
  expect(bucket.remove).toHaveBeenCalledWith([bucket.upload.mock.calls[0][0]]);
  expect(bucket.createSignedUrl).not.toHaveBeenCalled();
});

test("legacy JPG paths remain private and signed, while absolute URLs are rejected", async () => {
  expect(await getPlayerPhotoUrl("academy-1/player-1/old-photo.jpg")).toBe("https://signed.example/photo");
  expect(bucket.createSignedUrl).toHaveBeenCalledWith("academy-1/player-1/old-photo.jpg", 1800);
  await expect(getPlayerPhotoUrl("https://public.example/photo.jpg")).rejects.toThrow("private storage object path");
});
