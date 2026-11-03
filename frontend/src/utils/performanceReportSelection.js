/**
 * PM2: Default to the highest-ranked assessed player only when there is no
 * explicit/manual player selection. Ranked entries are already scope-filtered.
 */
export const getPreferredPerformancePlayerId = (selectedPlayerId, rankedPlayers) => {
  if (selectedPlayerId) return selectedPlayerId;
  return rankedPlayers[0]?.player?.id || "";
};
