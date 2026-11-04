import { supabase } from "./supabase";
import { MAX_STORED_PLAYER_PHOTO_BYTES, optimizePlayerPhoto } from "../utils/playerPhotoOptimization";

const BUCKET = "player-photos";

export const getPlayerPhotoUrl = async (storedValue) => {
  if (!storedValue) return null;

  // Player photos must resolve through the private bucket. Never render a
  // stored absolute URL, which could bypass the private-photo access contract.
  if (/^https?:\/\//i.test(storedValue)) {
    throw new Error("Player photo must use a private storage object path.");
  }

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
  // Validate and optimize locally before making a Storage or database request.
  // PH4 cleanup of old objects is deliberately out of scope.
  const optimizedPhoto = await optimizePlayerPhoto(file);
  if (optimizedPhoto.type !== "image/webp" ||
      optimizedPhoto.size > MAX_STORED_PLAYER_PHOTO_BYTES) {
    throw new Error("Photo optimization did not produce a valid WebP under 150 KB.");
  }

  const path = `${player.academy_id}/${player.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.webp`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, optimizedPhoto, {
      cacheControl: "3600",
      contentType: "image/webp",
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
