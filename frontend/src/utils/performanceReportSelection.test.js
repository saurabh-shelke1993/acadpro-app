import { getInitialPerformanceSelection, getPreferredPerformancePlayerId } from "./performanceReportSelection";

const ranked = [
  { player: { id: "player-high", full_name: "Top Player" }, average: 8.9 },
  { player: { id: "player-next", full_name: "Second Player" }, average: 7.8 },
];

test("defaults to the highest ranked player when no player is selected", () => {
  expect(getPreferredPerformancePlayerId("", ranked)).toBe("player-high");
});

test("preserves a chosen or deep-linked player instead of overriding it", () => {
  expect(getPreferredPerformancePlayerId("player-next", ranked)).toBe("player-next");
  expect(getPreferredPerformancePlayerId("player-unassessed", ranked)).toBe("player-unassessed");
});

test("does not select a player when no scored assessments exist", () => {
  expect(getPreferredPerformancePlayerId("", [])).toBe("");
});

const authorizedPlayers = [
  { id: "child-one", academy_id: "academy-1" },
  { id: "child-two", academy_id: "academy-2" },
];

test("super admin deep links select the player's academy rather than leaving scope empty", () => {
  expect(getInitialPerformanceSelection(
    { role: "super_admin" }, authorizedPlayers, "child-two"
  )).toEqual({ academyId: "academy-2", playerId: "child-two" });
  expect(getInitialPerformanceSelection(
    { role: "super_admin" }, authorizedPlayers, null
  )).toEqual({ academyId: "", playerId: "" });
});

test("parent deep links select the authorized child's academy even across academies", () => {
  expect(getInitialPerformanceSelection(
    { role: "parent" }, authorizedPlayers, "child-two"
  )).toEqual({ academyId: "academy-2", playerId: "child-two" });
  expect(getInitialPerformanceSelection(
    { role: "parent" }, authorizedPlayers, null
  )).toEqual({ academyId: "academy-1", playerId: "" });
});

test("academy owner remains scoped to their own academy", () => {
  expect(getInitialPerformanceSelection(
    { role: "academy_owner", academy_id: "academy-1" },
    [authorizedPlayers[0]],
    "child-one"
  )).toEqual({ academyId: "academy-1", playerId: "child-one" });
});

test("invalid or out-of-scope player deep links never become a selected player", () => {
  expect(getInitialPerformanceSelection(
    { role: "coach" }, authorizedPlayers, "other-academy-player"
  )).toEqual({ academyId: "academy-1", playerId: "" });
});
