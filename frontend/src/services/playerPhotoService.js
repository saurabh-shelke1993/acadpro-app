import { supabase } from "./supabase";

const BUCKET = "player-photos";
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const getPlayerPhotoUrl = async (storedValue) => {
  if (!storedValue) return null;

  // Keep compatibility with any legacy absolute URLs, but newly uploaded
  // player photos are stored as private bucket object paths.
  if (/^https?:\/\//i.test(storedValue)) return storedValue;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storedValue, 60 * 30);

  if (error) throw error;
  return data?.signedUrl || null;
};

export const uploadPlayerPhoto = async ({ player, file }) => {
  if (!player?.id || !player?.academy_id) {
    throw new Error("Player and academy information are required.");
  }
  if (!file) throw new Error("Choose a photo to upload.");
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Use a JPG, PNG, or WebP image.");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Photo must be 2 MB or smaller.");
  }

  const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" })[file.type];
  const path = `${player.academy_id}/${player.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { error: updateError } = await supabase
    .from("players")
    .update({ profile_image: path })
    .eq("id", player.id)
    .eq("academy_id", player.academy_id);

  if (updateError) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw updateError;
  }

  return { path, url: await getPlayerPhotoUrl(path) };
};
