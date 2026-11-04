/**
 * Only photos stored in the canonical academy/player Storage folder are eligible
 * for automatic replacement cleanup. Legacy external URLs and malformed paths
 * must never be passed to Storage.remove().
 */
export const getPreviousPlayerPhotoCleanupPath = ({ player, previousPath, newPath }) => {
  if (!player?.id || !player?.academy_id || typeof previousPath !== "string" ||
      !previousPath || previousPath === newPath) return null;

  const pieces = previousPath.split("/");
  if (pieces.length !== 3 ||
      pieces[0] !== String(player.academy_id) ||
      pieces[1] !== String(player.id)) return null;

  const name = pieces[2];
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp)$/i.test(name) ||
      name === "." || name.includes("..")) return null;

  return previousPath;
};
