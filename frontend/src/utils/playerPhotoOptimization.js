/**
 * Optimize player photos before sending any bytes to the private Storage bucket.
 * Only the encoded WebP result is uploaded; the original file is never stored.
 */
export const MAX_ORIGINAL_PLAYER_PHOTO_BYTES = 10 * 1024 * 1024;
export const TARGET_PLAYER_PHOTO_BYTES = 100 * 1024;
export const MAX_STORED_PLAYER_PHOTO_BYTES = 150 * 1024;
export const MAX_PLAYER_PHOTO_EDGE = 512;

const ALLOWED_ORIGINAL_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DIMENSION_STEPS = [512, 448, 384, 320, 256];
const QUALITY_STEPS = [0.82, 0.72, 0.62, 0.52, 0.42];
const MAX_DECODED_PIXELS = 50_000_000;

export const validateOriginalPlayerPhoto = (file) => {
  if (!file) throw new Error("Choose a photo to upload.");
  if (!ALLOWED_ORIGINAL_TYPES.has(file.type)) {
    throw new Error("Use a JPG, PNG, or WebP image.");
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new Error("The selected photo is empty or unreadable.");
  }
  if (file.size > MAX_ORIGINAL_PLAYER_PHOTO_BYTES) {
    throw new Error("Choose an original photo no larger than 10 MB.");
  }
};

const loadPhoto = async (file) => {
  // ImageBitmap is preferred because it can release decoded memory explicitly.
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close?.(),
      };
    } catch {
      // Fallback below also supports browsers without createImageBitmap.
    }
  }

  if (typeof Image === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    throw new Error("This browser cannot process the selected photo.");
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        release: () => {},
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The image could not be opened. Choose a valid JPG, PNG, or WebP photo."));
    };
    image.src = url;
  });
};

const toWebpBlob = (canvas, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (!blob || !blob.size) {
      reject(new Error("Photo compression failed. Please choose another photo."));
      return;
    }
    // Some browsers silently encode PNG when WebP is not supported.
    if (blob.type !== "image/webp") {
      reject(new Error("This browser cannot create WebP photos. Try an updated browser."));
      return;
    }
    resolve(blob);
  }, "image/webp", quality);
});

export const optimizePlayerPhoto = async (file) => {
  validateOriginalPlayerPhoto(file);
  if (typeof document === "undefined") {
    throw new Error("Photo compression requires a browser.");
  }

  const photo = await loadPhoto(file);
  try {
    const { width, height } = photo;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
      throw new Error("The photo has invalid dimensions.");
    }
    if (width * height > MAX_DECODED_PIXELS) {
      throw new Error("This photo has too many pixels. Choose a lower-resolution image.");
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context || typeof canvas.toBlob !== "function") {
      throw new Error("This browser does not support photo compression.");
    }

    let underLimit = null;
    let lastDimensions = "";
    for (const limit of DIMENSION_STEPS) {
      const ratio = Math.min(1, limit / Math.max(width, height));
      const targetWidth = Math.max(1, Math.round(width * ratio));
      const targetHeight = Math.max(1, Math.round(height * ratio));
      // Small photos should not be encoded repeatedly at identical dimensions.
      const dimensions = `${targetWidth}x${targetHeight}`;
      if (dimensions === lastDimensions) continue;
      lastDimensions = dimensions;
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(photo.source, 0, 0, canvas.width, canvas.height);

      for (const quality of QUALITY_STEPS) {
        const blob = await toWebpBlob(canvas, quality);
        if (blob.size <= TARGET_PLAYER_PHOTO_BYTES) {
          return new File([blob], "player-photo.webp", { type: "image/webp" });
        }
        // Retain the first acceptable candidate: it has the most detail.
        if (!underLimit && blob.size <= MAX_STORED_PLAYER_PHOTO_BYTES) {
          underLimit = blob;
        }
      }
    }
    if (underLimit) {
      return new File([underLimit], "player-photo.webp", { type: "image/webp" });
    }
    throw new Error("This photo could not be reduced below 150 KB. Try a simpler photo.");
  } finally {
    photo.release();
  }
};
