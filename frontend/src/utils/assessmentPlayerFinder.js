/**
 * PM3.1 player finder utilities. Inputs must already be role-scoped by callers.
 * Assessment availability means at least one visible assessment record exists;
 * it does not imply that numeric skill scores are present.
 */
export const PICKER_PAGE_SIZE = 25;
const ASSESSMENT_PLAYER_BATCH_SIZE = 50;
const ASSESSMENT_ROW_PAGE_SIZE = 500;

export const selectAssessmentPlayerOptions = (players, academyId, centerId, batchId, query, status, assessedIds, coverageReady) => {
  const term = query.trim().toLocaleLowerCase();
  return players.filter((player) => {
    if (academyId && player.academy_id !== academyId) return false;
    if (centerId && player.center_id !== centerId) return false;
    if (batchId && player.batch_id !== batchId) return false;
    if (status !== "all") {
      if (!coverageReady) return false;
      const assessed = assessedIds.has(player.id);
      if (status === "assessed" && !assessed) return false;
      if (status === "unassessed" && assessed) return false;
    }
    return !term || [
      player.full_name,
      player.batches?.batch_name,
      player.centers?.center_name,
    ].filter(Boolean).some((value) => value.toLocaleLowerCase().includes(term));
  });
};

export const getCenterOptions = (players) => Array.from(
  new Map(players.filter((player) => player.center_id).map((player) => [
    player.center_id,
    { id: player.center_id, name: player.centers?.center_name || "Unnamed center" },
  ])).values()
).sort((a, b) => a.name.localeCompare(b.name));

export const getBatchOptions = (players) => Array.from(
  new Map(players.filter((player) => player.batch_id).map((player) => [
    player.batch_id,
    {
      id: player.batch_id,
      name: player.batches?.batch_name || "Unnamed batch",
      center: player.centers?.center_name || "",
    },
  ])).values()
).sort((a, b) => a.name.localeCompare(b.name) || a.center.localeCompare(b.center));

export const fetchAssessedPlayerIds = async (client, playerIds, coachId = "") => {
  const assessed = new Set();
  for (let i = 0; i < playerIds.length; i += ASSESSMENT_PLAYER_BATCH_SIZE) {
    const batch = playerIds.slice(i, i + ASSESSMENT_PLAYER_BATCH_SIZE);
    let offset = 0;
    while (true) {
      let query = client
        .from("player_performance_assessments")
        .select("id, player_id")
        .in("player_id", batch)
        .order("id", { ascending: true })
        .range(offset, offset + ASSESSMENT_ROW_PAGE_SIZE - 1);
      if (coachId) query = query.eq("coach_id", coachId);
      const { data, error } = await query;
      if (error) throw error;
      (data || []).forEach((row) => assessed.add(row.player_id));
      if (!data || data.length < ASSESSMENT_ROW_PAGE_SIZE) break;
      offset += ASSESSMENT_ROW_PAGE_SIZE;
    }
  }
  return assessed;
};
