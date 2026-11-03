import { getPreferredPerformancePlayerId } from "./performanceReportSelection";

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
