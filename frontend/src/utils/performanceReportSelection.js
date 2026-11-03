/**
 * PM2: Default to the highest-ranked assessed player only when there is no
 * explicit/manual player selection. Ranked entries are already scope-filtered.
 */
export const getPreferredPerformancePlayerId = (selectedPlayerId, rankedPlayers) => {
  if (selectedPlayerId) return selectedPlayerId;
  return rankedPlayers[0]?.player?.id || "";
};

/**
 * Restore authorized player deep links in the correct academy scope.
 * An invalid or out-of-scope ID is ignored because it is absent from
 * the authorizedPlayers array returned by the current role's data query.
 */
export const getInitialPerformanceSelection = (user, authorizedPlayers, requestedPlayerId) => {
  const requestedPlayer = requestedPlayerId
    ? authorizedPlayers.find((player) => player.id === requestedPlayerId)
    : null;

  const academyId = user?.role === "super_admin"
    ? (requestedPlayer?.academy_id || "")
    : user?.role === "academy_owner"
      ? (user.academy_id || "")
      : (requestedPlayer?.academy_id || authorizedPlayers[0]?.academy_id || "");

  return { academyId, playerId: requestedPlayer?.id || "" };
};
