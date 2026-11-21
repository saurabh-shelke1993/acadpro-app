import {
  adaptOwnerData, attendancePath, centerPlayersPath, enquiriesPath,
  filterAttendanceByCenter, formatCount, formatMoney, formatTime,
  getCollectionRateLabel, groupAttendanceByCenter, recordedMarkSummary,
} from "./academyOwnerPreviewAdapter";

const marks = [
  { id: "b1", centerId: "north", centerName: "Ground", presentRecords: 8, totalRecords: 10 },
  { id: "b2", centerId: "south", centerName: "Ground", presentRecords: 1, totalRecords: 2 },
  { id: "b3", centerId: "north", centerName: "Ground", presentRecords: 0, totalRecords: 0 },
];

test("canonical attendance links encode exact IDs without injecting query parameters", () => {
  const session = { centerId: "north & south/#", batchId: "b?x=1+2" };
  const url = new URL(attendancePath(session), "https://example.invalid");
  expect(url.pathname).toBe("/attendance");
  expect([...url.searchParams]).toEqual([["view", "mark"], ["centerId", session.centerId], ["batchId", session.batchId]]);
  expect(attendancePath(null)).toBe("/attendance?view=mark");
  expect(attendancePath({ centerId: "north" })).toBe("/attendance?view=mark");
});

test("player and enquiry navigation preserves real scope and avoids fabricated unassigned IDs", () => {
  const center = { id: "c&?/#", academyId: "a+b" };
  const params = new URL(centerPlayersPath(center), "https://example.invalid").searchParams;
  expect([...params]).toEqual([["academyId", center.academyId], ["centerId", center.id]]);
  expect(centerPlayersPath({ id: "c" })).toBe("/players");
  expect(new URL(enquiriesPath({ centerId: center.id }), "https://example.invalid").searchParams.get("centerId")).toBe(center.id);
  expect(enquiriesPath({ centerId: "unassigned-center" })).toBe("/enquiries");
  expect(enquiriesPath(null)).toBe("/enquiries");
});

test("same-name centers remain separate and filtering does not modify the academy summary", () => {
  const groups = groupAttendanceByCenter(marks);
  expect(groups.map(({ centerId, centerName, rows }) => [centerId, centerName, rows.length]))
    .toEqual([["north", "Ground", 2], ["south", "Ground", 1]]);
  expect(filterAttendanceByCenter(marks, "south")).toEqual([marks[1]]);
  expect(filterAttendanceByCenter(marks, "Ground")).toEqual([]);
  expect(filterAttendanceByCenter(marks)).toEqual(marks);
  expect(recordedMarkSummary(marks)).toEqual({ rate: 75, present: 9, marked: 12, recordedBatches: 2, totalBatches: 3 });
});

test("unidentified centers remain a null ID bucket, without inferring identity from labels", () => {
  const rows = [{ centerName: "One" }, { centerId: null, centerName: "Two" }];
  expect(groupAttendanceByCenter(rows)).toEqual([{ centerId: null, centerName: "One", rows }]);
  expect(filterAttendanceByCenter(rows, null)).toEqual(rows);
  expect(groupAttendanceByCenter(null)).toBeNull();
  expect(filterAttendanceByCenter(undefined, "north")).toBeNull();
});

test("known empty and recorded-zero attendance are distinct from unavailable counts", () => {
  expect(recordedMarkSummary([])).toEqual({ rate: null, present: 0, marked: 0, recordedBatches: 0, totalBatches: 0 });
  expect(recordedMarkSummary([{ presentRecords: 0, totalRecords: 3 }]).rate).toBe(0);
  expect(recordedMarkSummary([{ presentRecords: 0, totalRecords: 0 }]).rate).toBeNull();
  expect(recordedMarkSummary(null)).toEqual({ rate: null, present: null, marked: null, recordedBatches: null, totalBatches: null });
});

test.each([
  { totalRecords: 3 }, { presentRecords: null, totalRecords: 3 },
  { presentRecords: 4, totalRecords: 3 }, { presentRecords: -1, totalRecords: 3 },
  { presentRecords: 1, totalRecords: "" },
])("does not inflate a summary from unknown or inconsistent marks: %j", (row) => {
  expect(recordedMarkSummary([marks[0], row])).toMatchObject({ rate: null, present: null, marked: null, totalBatches: 2 });
});

test.each([undefined, null, "", " ", false, [], {}, NaN, Infinity])("missing/invalid numeric value %j is not displayed as zero", (value) => {
  expect(formatCount(value)).toBe("—");
  expect(formatMoney(value)).toBe("—");
  expect(adaptOwnerData({ totals: { players: value }, centers: [{ players: value }] }).centerMemberships).toBeNull();
});

test("valid counts and money preserve zero, precision and Indian formatting", () => {
  expect(formatCount(0)).toBe("0");
  expect(formatCount("120000")).toBe("1,20,000");
  expect(formatMoney(0)).toBe("₹0");
  expect(formatMoney(1234.5)).toBe("₹1,234.5");
  expect(formatMoney(-12)).toBe("₹-12");
});

test("normalization distinguishes unique players, memberships and aggregated batch labels without mutation", () => {
  const financial = Object.freeze({ totalBilledThisMonth: 100, collectionRate: 150, collectionsThisMonth: 150, outstandingAmount: 90 });
  const data = Object.freeze({ academyName: "Academy", totals: Object.freeze({ players: 1, centers: 2, batches: 2 }),
    centers: Object.freeze([
      Object.freeze({ id: "north", academyId: "a", name: "Ground", players: 1,
        ageGroups: Object.freeze([Object.freeze({ name: "Junior (U10)", players: 1 }), Object.freeze({ name: "Empty", players: 0 })]) }),
      Object.freeze({ id: "south", academyId: "a", name: "Ground", players: 1, ageGroups: [] }),
      Object.freeze({ id: "empty", academyId: "a", name: "Empty Ground", players: 0, ageGroups: [] }),
    ]), todaySessions: [], attendanceByBatch: marks, financial, enquirySummary: { total: 0, groups: [] } });
  const result = adaptOwnerData(data);
  expect(result.totals.players).toBe(1);
  expect(result.centerMemberships).toBe(2);
  expect(result.centers).toHaveLength(3);
  expect(result.centers[0].batches).toEqual([{ name: "Junior (U10)", players: 1 }, { name: "Empty", players: 0 }]);
  expect(result.centers[0].batches.every((batch) => !("id" in batch) && !("batchId" in batch))).toBe(true);
  expect(result.financial).toEqual(financial);
  expect(getCollectionRateLabel(result.financial)).toBe("150%");
  expect(data.centers[0]).not.toHaveProperty("batches");
});

test("absent collections/fields stay unavailable while known empty arrays and totals stay empty/zero", () => {
  expect(adaptOwnerData(null)).toBeNull();
  expect(adaptOwnerData([])).toBeNull();
  expect(adaptOwnerData({})).toEqual({ academyName: null,
    totals: { players: null, centers: null, batches: null }, centers: null, centerMemberships: null,
    sessions: null, attendanceBatches: null, financial: null, enquiries: null });
  expect(adaptOwnerData({ centers: [], todaySessions: [], attendanceByBatch: [] }))
    .toMatchObject({ centers: [], centerMemberships: 0, sessions: [], attendanceBatches: [] });
  expect(adaptOwnerData({ centers: [{ players: 0 }] }).centers[0].batches).toBeNull();
});

test("collection display preserves service rate without dividing, capping or modifying finances", () => {
  expect(getCollectionRateLabel({ totalBilledThisMonth: 100, collectionRate: 175, collectionsThisMonth: 2 })).toBe("175%");
  expect(getCollectionRateLabel({ totalBilledThisMonth: 0, collectionRate: 0, outstandingAmount: 900 })).toBe("N/A");
  expect(getCollectionRateLabel({ totalBilledThisMonth: null, collectionRate: 0 })).toBe("—");
  expect(getCollectionRateLabel({ totalBilledThisMonth: 100 })).toBe("—");
});

test("clock formatting is pure and does not apply any timezone/date conversion", () => {
  expect(formatTime("00:00")).toBe("12:00 AM");
  expect(formatTime("12:05:00")).toBe("12:05 PM");
  expect(formatTime("17:30")).toBe("5:30 PM");
  for (const value of [null, "24:00", "12:99", "12:05garbage"]) expect(formatTime(value)).toBe("Time TBC");
});
