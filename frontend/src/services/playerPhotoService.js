import { supabase } from "./supabase";
import { MAX_STORED_PLAYER_PHOTO_BYTES, optimizePlayerPhoto } from "../utils/playerPhotoOptimization";
import { getPreviousPlayerPhotoCleanupPath } from "../utils/playerPhotoCleanup";

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

const readScopedPlayerPhoto = async (player) => {
  const { data, error } = await supabase
    .from("players")
    .select("id, academy_id, profile_image")
    .eq("id", player.id)
    .eq("academy_id", player.academy_id)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.id !== player.id || data.academy_id !== player.academy_id) {
    throw new Error("Player photo access could not be verified. Refresh and try again.");
  }
  return data;
};

// Never delete a new upload if a network/DB error makes it impossible to
// verify that another request has not already committed it as the active photo.
const removeUncommittedUpload = async (player, path) => {
  let current;
  try {
    current = await readScopedPlayerPhoto(player);
  } catch (error) {
    console.warn("Could not verify whether the new player photo is referenced:", error);
    return;
  }
  if (current.profile_image === path) return;
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) throw error;
  } catch (error) {
    console.warn("Unable to clean up an uncommitted player photo:", error);
  }
};

// PH4: best effort only. A cleanup error must never turn an already committed
// photo update into a reported upload failure or delete any referenced photo.
const cleanupPreviousPhoto = async (player, previousPath, newPath) => {
  const path = getPreviousPlayerPhotoCleanupPath({ player, previousPath, newPath });
  if (!path) return null;

  try {
    const { data: references, error: referenceError } = await supabase
      .from("players")
      .select("id")
      .eq("academy_id", player.academy_id)
      .eq("profile_image", path)
      .limit(1);

    if (referenceError || !Array.isArray(references)) {
      throw referenceError || new Error("Reference check did not return a valid result.");
    }
    if (references.length) {
      return "Photo saved. The previous photo is still referenced, so it was retained.";
    }

    const { data: removed, error: removalError } = await supabase.storage
      .from(BUCKET)
      .remove([path]);
    if (removalError || !Array.isArray(removed) || removed.length === 0) {
      throw removalError || new Error("Storage did not confirm the previous photo's removal.");
    }
    return null;
  } catch (error) {
    console.warn("Previous player photo was retained after a successful update:", error);
    return "Photo saved, but the previous file could not be removed. It remains in storage.";
  }
};

export const uploadPlayerPhoto = async ({ player, file }) => {
  if (!player?.id || !player?.academy_id) {
    throw new Error("Player and academy information are required.");
  }

  // Browser-only optimization is mandatory: the original never reaches Storage.
  const optimizedPhoto = await optimizePlayerPhoto(file);
  if (optimizedPhoto.type !== "image/webp" ||
      optimizedPhoto.size > MAX_STORED_PLAYER_PHOTO_BYTES) {
    throw new Error("Photo optimization did not produce a valid WebP under 150 KB.");
  }

  // Read the current database value instead of trusting a potentially stale
  // copy of player.profile_image in the React component.
  const { profile_image: previousPath } = await readScopedPlayerPhoto(player);
  const path = `${player.academy_id}/${player.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.webp`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, optimizedPhoto, {
      cacheControl: "3600",
      contentType: "image/webp",
      upsert: false,
    });
  if (uploadError) throw uploadError;

  let committed = false;
  let updateFailure;
  try {
    // Compare-and-set prevents two concurrent uploads from overwriting each
    // other based on stale photo paths. Returning the updated row also catches
    // zero-row updates under RLS or a changed photo reference.
    let update = supabase
      .from("players")
      .update({ profile_image: path })
      .eq("id", player.id)
      .eq("academy_id", player.academy_id);
    update = previousPath
      ? update.eq("profile_image", previousPath)
      : update.is("profile_image", null);

    const { data: updated, error: updateError } = await update
      .select("id, profile_image")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated || updated.id !== player.id || updated.profile_image !== path) {
      throw new Error("Player photo changed during upload. Refresh the player and try again.");
    }
    committed = true;
  } catch (error) {
    updateFailure = error;
  }

  if (!committed) {
    try {
      const current = await readScopedPlayerPhoto(player);
      committed = current.profile_image === path;
    } catch (verificationError) {
      console.warn("Could not confirm the player photo update:", verificationError);
    }
    if (!committed) {
      await removeUncommittedUpload(player, path);
      throw updateFailure || new Error("Player photo update could not be confirmed.");
    }
  }

  let url = null;
  const warnings = [];
  try {
    url = await getPlayerPhotoUrl(path);
  } catch (error) {
    console.warn("Player photo saved but preview URL could not be created:", error);
    warnings.push("Photo saved, but the preview could not be refreshed. Reload the player profile.");
  }

  const cleanupWarning = await cleanupPreviousPhoto(player, previousPath, path);
  if (cleanupWarning) warnings.push(cleanupWarning);

  return { path, url, cleanupWarning: warnings.join(" ") || null };
};
