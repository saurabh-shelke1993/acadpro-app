import {
  MAX_ORIGINAL_PLAYER_PHOTO_BYTES,
  MAX_STORED_PLAYER_PHOTO_BYTES,
  optimizePlayerPhoto,
  validateOriginalPlayerPhoto,
} from "./playerPhotoOptimization";

const fileOfSize = (bytes, type = "image/jpeg") =>
  new File([new Uint8Array(bytes)], "original-photo.jpg", { type });

let bitmap;
let drawImage;
let toBlob;

beforeEach(() => {
  bitmap = { width: 2048, height: 1024, close: jest.fn() };
  drawImage = jest.fn();
  toBlob = jest.fn((callback) =>
    callback(new Blob([new Uint8Array(72 * 1024)], { type: "image/webp" }))
  );
  global.createImageBitmap = jest.fn().mockResolvedValue(bitmap);
  jest.spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockImplementation(() => ({ clearRect: jest.fn(), drawImage }));
  jest.spyOn(HTMLCanvasElement.prototype, "toBlob")
    .mockImplementation((...args) => toBlob(...args));
});

afterEach(() => {
  jest.restoreAllMocks();
  delete global.createImageBitmap;
});

test("validates original JPG, PNG and WebP files up to 10 MB", () => {
  for (const mime of ["image/jpeg", "image/png", "image/webp"]) {
    expect(() => validateOriginalPlayerPhoto(fileOfSize(10, mime))).not.toThrow();
  }
  expect(() => validateOriginalPlayerPhoto({ type: "image/jpeg", size: MAX_ORIGINAL_PLAYER_PHOTO_BYTES })).not.toThrow();
  expect(() => validateOriginalPlayerPhoto({ type: "image/jpeg", size: MAX_ORIGINAL_PLAYER_PHOTO_BYTES + 1 }))
    .toThrow("10 MB");
  expect(() => validateOriginalPlayerPhoto({ type: "image/gif", size: 1024 })).toThrow("JPG, PNG, or WebP");
  expect(() => validateOriginalPlayerPhoto({ type: "image/jpeg", size: 0 })).toThrow("empty");
});

test("resizes preserving aspect ratio and returns a small WebP file", async () => {
  const source = fileOfSize(12 * 1024, "image/png");
  const optimized = await optimizePlayerPhoto(source);
  expect(optimized).toBeInstanceOf(File);
  expect(optimized.type).toBe("image/webp");
  expect(optimized.name).toBe("player-photo.webp");
  expect(optimized.size).toBeLessThanOrEqual(MAX_STORED_PLAYER_PHOTO_BYTES);
  expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 512, 256);
  expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/webp", 0.82);
  expect(bitmap.close).toHaveBeenCalledTimes(1);
});

test("reduces compression quality until it reaches 100 KB target", async () => {
  let conversions = 0;
  toBlob.mockImplementation((callback) => {
    const bytes = ++conversions === 1 ? 125 * 1024 : 85 * 1024;
    callback(new Blob([new Uint8Array(bytes)], { type: "image/webp" }));
  });
  const optimized = await optimizePlayerPhoto(fileOfSize(1024));
  expect(optimized.size).toBe(85 * 1024);
  expect(toBlob.mock.calls.map((call) => call[2])).toEqual([0.82, 0.72]);
});

test("accepts an under-150 KB candidate when the 100 KB target is unreachable", async () => {
  toBlob.mockImplementation((callback) =>
    callback(new Blob([new Uint8Array(125 * 1024)], { type: "image/webp" }))
  );
  const optimized = await optimizePlayerPhoto(fileOfSize(1024));
  expect(optimized.size).toBe(125 * 1024);
  expect(bitmap.close).toHaveBeenCalledTimes(1);
});

test("never returns an oversized or non-WebP result for upload", async () => {
  toBlob.mockImplementation((callback) =>
    callback(new Blob([new Uint8Array(170 * 1024)], { type: "image/webp" }))
  );
  await expect(optimizePlayerPhoto(fileOfSize(1024))).rejects.toThrow("below 150 KB");
  expect(bitmap.close).toHaveBeenCalledTimes(1);

  toBlob.mockImplementation((callback) =>
    callback(new Blob([new Uint8Array(8 * 1024)], { type: "image/png" }))
  );
  await expect(optimizePlayerPhoto(fileOfSize(1024))).rejects.toThrow("cannot create WebP");
});

test("rejects excessive pixel dimensions before encoding and frees bitmap", async () => {
  bitmap.width = 12000;
  bitmap.height = 10000;
  await expect(optimizePlayerPhoto(fileOfSize(1024))).rejects.toThrow("too many pixels");
  expect(toBlob).not.toHaveBeenCalled();
  expect(bitmap.close).toHaveBeenCalledTimes(1);
});

test("does not even decode unsupported or over-10 MB originals", async () => {
  await expect(optimizePlayerPhoto({ type: "image/jpeg", size: MAX_ORIGINAL_PLAYER_PHOTO_BYTES + 1 }))
    .rejects.toThrow("10 MB");
  await expect(optimizePlayerPhoto({ type: "text/plain", size: 123 }))
    .rejects.toThrow("JPG, PNG, or WebP");
  expect(global.createImageBitmap).not.toHaveBeenCalled();
});
