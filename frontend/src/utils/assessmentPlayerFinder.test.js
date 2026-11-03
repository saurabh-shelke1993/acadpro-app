import {
  PICKER_PAGE_SIZE,
  fetchAssessedPlayerIds,
  getBatchOptions,
  getCenterOptions,
  selectAssessmentPlayerOptions,
} from "./assessmentPlayerFinder";

const players = [
  { id: "p-1", academy_id: "academy-1", center_id: "center-1", batch_id: "batch-1", full_name: "Arjun Shelke", centers: { center_name: "Lodha Amara" }, batches: { batch_name: "Juniors" } },
  { id: "p-2", academy_id: "academy-1", center_id: "center-2", batch_id: "batch-2", full_name: "Dinesh Lomate", centers: { center_name: "Hiranandani Estate" }, batches: { batch_name: "U8 Toddlers" } },
  { id: "p-3", academy_id: "academy-2", center_id: "center-3", batch_id: "batch-3", full_name: "Zara Patel", centers: { center_name: "Thane Centre" }, batches: { batch_name: "Juniors" } },
];

test("filters authorized players by academy, center, dependent batch and name", () => {
  const get = (academy, center, batch, search) =>
    selectAssessmentPlayerOptions(players, academy, center, batch, search, "all", new Set(), false).map((p) => p.id);
  expect(get("academy-1", "", "", "")).toEqual(["p-1", "p-2"]);
  expect(get("academy-1", "center-2", "", "")).toEqual(["p-2"]);
  expect(get("academy-1", "center-2", "batch-1", "")).toEqual([]);
  expect(get("academy-1", "", "", "u8 toddlers")).toEqual(["p-2"]);
  expect(get("", "", "", "lodha")).toEqual(["p-1"]);
  expect(get("", "", "", "arJuN")).toEqual(["p-1"]);
});

test("status filtering distinguishes visible assessed and unassessed records", () => {
  const assessed = new Set(["p-1"]);
  expect(selectAssessmentPlayerOptions(players, "academy-1", "", "", "", "assessed", assessed, true).map((p) => p.id)).toEqual(["p-1"]);
  expect(selectAssessmentPlayerOptions(players, "academy-1", "", "", "", "unassessed", assessed, true).map((p) => p.id)).toEqual(["p-2"]);
  // Never classify players as unassessed while the availability query is loading/failed.
  expect(selectAssessmentPlayerOptions(players, "academy-1", "", "", "", "unassessed", new Set(), false)).toEqual([]);
});

test("derives unique center and batch filters only from supplied accessible players", () => {
  const withDuplicate = [...players, { ...players[0], id: "p-4" }];
  expect(getCenterOptions(withDuplicate).map((x) => x.id)).toEqual(["center-2", "center-1", "center-3"]);
  expect(getBatchOptions(withDuplicate.filter((p) => p.center_id === "center-1")).map((x) => x.id)).toEqual(["batch-1"]);
  expect(PICKER_PAGE_SIZE).toBe(25);
});

const clientWithRows = (rows, fail = false) => {
  const calls = [];
  const client = {
    from: jest.fn(() => {
      let filters = { playerIds: [], coachId: "", start: 0, end: 499 };
      const q = {
        select: () => q,
        in: (field, ids) => { filters.playerIds = ids; return q; },
        eq: (field, id) => { filters.coachId = id; return q; },
        order: () => q,
        range: (start, end) => { filters.start = start; filters.end = end; return q; },
        then: (resolve, reject) => {
          calls.push({ ...filters });
          if (fail) return Promise.resolve({ data: null, error: new Error("No access") }).then(resolve, reject);
          const results = rows.filter((row) =>
            filters.playerIds.includes(row.player_id) &&
            (!filters.coachId || filters.coachId === row.coach_id)
          ).slice(filters.start, filters.end + 1);
          return Promise.resolve({ data: results, error: null }).then(resolve, reject);
        },
      };
      return q;
    }),
  };
  return { client, calls };
};

test("queries groups of 50 player IDs and paginates beyond 500 rows", async () => {
  const allIds = Array.from({ length: 51 }, (_, i) => `p-${i + 1}`);
  const rows = [
    ...Array.from({ length: 501 }, (_, i) => ({ id: `a-${i}`, player_id: "p-1", coach_id: "c-1" })),
    { id: "a-other", player_id: "p-51", coach_id: "c-1" },
  ];
  const { client, calls } = clientWithRows(rows);
  const ids = await fetchAssessedPlayerIds(client, allIds, "c-1");
  expect(Array.from(ids).sort()).toEqual(["p-1", "p-51"]);
  expect(calls).toHaveLength(3);
  expect(calls[0].playerIds).toHaveLength(50);
  expect(calls[1].start).toBe(500);
  expect(calls[2].playerIds).toEqual(["p-51"]);
  expect(calls.every((call) => call.coachId === "c-1")).toBe(true);
});

test("coach visibility uses own coach_id and does not count another coach's assessment", async () => {
  const { client } = clientWithRows([
    { id: "a1", player_id: "p-1", coach_id: "c-other" },
    { id: "a2", player_id: "p-2", coach_id: "c-self" },
  ]);
  const own = await fetchAssessedPlayerIds(client, ["p-1", "p-2"], "c-self");
  expect(Array.from(own)).toEqual(["p-2"]);
  const ownerVisible = await fetchAssessedPlayerIds(client, ["p-1", "p-2"]);
  expect(Array.from(ownerVisible).sort()).toEqual(["p-1", "p-2"]);
});

test("assessment availability query errors cannot be interpreted as not assessed", async () => {
  const { client } = clientWithRows([], true);
  await expect(fetchAssessedPlayerIds(client, ["p-1"])).rejects.toThrow("No access");
});
