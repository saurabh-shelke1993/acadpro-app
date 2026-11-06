import { getAttendanceHistoryPage, ATTENDANCE_HISTORY_PAGE_SIZE } from "./attendanceHistoryService";
import { supabase } from "../supabaseClient";
import { getAccessibleBatches } from "../utils/dataScope";

jest.mock("../supabaseClient", () => ({ supabase: { from: jest.fn() } }));
jest.mock("../utils/dataScope", () => ({ getAccessibleBatches: jest.fn() }));

const owner = { id: "owner", role: "academy_owner", academy_id: "academy-1" };
const coach = { id: "coach", role: "coach", academy_id: "academy-1" };
const admin = { id: "admin", role: "super_admin" };
let query;
const mockPage = (rows = [], count = rows.length, error = null) => {
  query = {
    select: jest.fn(() => query), eq: jest.fn(() => query),
    in: jest.fn(() => query), gte: jest.fn(() => query),
    lte: jest.fn(() => query), ilike: jest.fn(() => query),
    order: jest.fn(() => query),
    range: jest.fn(async () => ({ data: rows, count, error })),
  };
  supabase.from.mockReturnValue(query);
};
beforeEach(() => {
  jest.clearAllMocks();
  mockPage([{ id: "first" }], 1205);
  getAccessibleBatches.mockResolvedValue([]);
});

test("AM7.3 requests only five rows, with exact count and deterministic tie-break ordering", async () => {
  const result = await getAttendanceHistoryPage({ user: owner, page: 200 });
  expect(ATTENDANCE_HISTORY_PAGE_SIZE).toBe(5);
  expect(result).toEqual({ rows: [{ id: "first" }], count: 1205 });
  expect(supabase.from).toHaveBeenCalledWith("attendance");
  expect(query.select).toHaveBeenCalledWith(expect.stringContaining("players(full_name)"), { count: "exact" });
  expect(query.eq).toHaveBeenCalledWith("academy_id", "academy-1");
  expect(query.eq).toHaveBeenCalledWith("is_deleted", false);
  expect(query.order).toHaveBeenNthCalledWith(1, "attendance_date", { ascending: false });
  expect(query.order).toHaveBeenNthCalledWith(2, "id", { ascending: false });
  expect(query.range).toHaveBeenCalledWith(995, 999);
});

test("AM7.3 sends date, status, player name and center/batch filters to the database", async () => {
  getAccessibleBatches.mockResolvedValue([{ id: "batch-1" }, { id: "batch-2" }]);
  await getAttendanceHistoryPage({
    user: coach, academyId: "academy-1", centerId: "center-1",
    batchId: "batch-1", playerName: " Junior ", status: "absent",
    startDate: "2026-10-01", endDate: "2026-10-31",
  });
  expect(getAccessibleBatches).toHaveBeenCalledWith(coach, "center-1");
  expect(query.select).toHaveBeenCalledWith(expect.stringContaining("players!inner(full_name)"), { count: "exact" });
  expect(query.in).toHaveBeenCalledWith("batch_id", ["batch-1", "batch-2"]);
  expect(query.eq).toHaveBeenCalledWith("batch_id", "batch-1");
  expect(query.eq).toHaveBeenCalledWith("status", "absent");
  expect(query.gte).toHaveBeenCalledWith("attendance_date", "2026-10-01");
  expect(query.lte).toHaveBeenCalledWith("attendance_date", "2026-10-31");
  expect(query.ilike).toHaveBeenCalledWith("players.full_name", "%Junior%");
  expect(query.range).toHaveBeenCalledWith(0, 4);
});

test("AM7.3 prevents cross-academy owner overrides before querying", async () => {
  await expect(getAttendanceHistoryPage({ user: owner, academyId: "academy-2" }))
    .rejects.toThrow(/academy scope/);
  expect(supabase.from).not.toHaveBeenCalled();
});

test("AM7.3 ignores invalid or Parent roles and missing academy scope", async () => {
  expect(await getAttendanceHistoryPage({ user: { role: "parent" } }))
    .toEqual({ rows: [], count: 0 });
  await expect(getAttendanceHistoryPage({ user: { role: "coach" } }))
    .rejects.toThrow(/academy scope/);
  expect(supabase.from).not.toHaveBeenCalled();
});

test("AM7.3 empty authorized center avoids unrelated attendance reads", async () => {
  expect(await getAttendanceHistoryPage({ user: coach, centerId: "other-center" }))
    .toEqual({ rows: [], count: 0 });
  expect(supabase.from).not.toHaveBeenCalled();
});

test("AM7.3 a batch outside the selected center never triggers a broad query", async () => {
  getAccessibleBatches.mockResolvedValue([{ id: "batch-1" }]);
  const result = await getAttendanceHistoryPage({ user: owner, centerId: "center-1", batchId: "batch-2" });
  expect(result.count).toBe(0);
  expect(supabase.from).not.toHaveBeenCalled();
});

test("AM7.3 Super Admin can request platform results or a selected academy", async () => {
  await getAttendanceHistoryPage({ user: admin });
  expect(query.eq).not.toHaveBeenCalledWith("academy_id", expect.anything());
  await getAttendanceHistoryPage({ user: admin, academyId: "academy-2" });
  expect(query.eq).toHaveBeenCalledWith("academy_id", "academy-2");
});

test("AM7.3 detects unavailable count and surfaces database errors", async () => {
  mockPage([], null);
  await expect(getAttendanceHistoryPage({ user: owner })).rejects.toThrow(/count unavailable/);
  mockPage([], 0, new Error("read failed"));
  await expect(getAttendanceHistoryPage({ user: owner })).rejects.toThrow("read failed");
});

test("AM7.3 zero matches returns an empty page with a verified zero count", async () => {
  mockPage([], 0);
  expect(await getAttendanceHistoryPage({ user: owner, page: 10 }))
    .toEqual({ rows: [], count: 0 });
  expect(query.range).toHaveBeenCalledWith(45, 49);
});
