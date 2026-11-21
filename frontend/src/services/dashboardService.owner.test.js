import { getAcademyOwnerDashboardData } from "./dashboardService";
import { supabase } from "../supabaseClient";
import { getAttendanceTrend, getCollectionsTrend } from "./analyticsService";

jest.mock("../supabaseClient", () => ({ supabase: { from: jest.fn() } }));
jest.mock("./analyticsService", () => ({ getAttendanceTrend: jest.fn(), getCollectionsTrend: jest.fn() }));

let queries;
let fixtures;
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-11-21T12:00:00Z"));
  queries = {};
  fixtures = {
    academies: { id: "academy-a", academy_name: "Fixture Academy" },
    centers: [{ id: "north", center_name: "Ground" }, { id: "south", center_name: "Ground" }],
    batches: [
      { id: "junior", center_id: "north", batch_name: "Junior", age_group: "U10" },
      { id: "senior", center_id: "south", batch_name: "Senior", age_group: "U16" },
      { id: "unassigned", center_id: null, batch_name: "Unassigned" },
    ],
    batch_schedules: [],
    players: [{ id: "player-1" }],
    player_batches: [{ player_id: "player-1", batch_id: "junior" }, { player_id: "player-1", batch_id: "senior" }],
    attendance: [
      ...Array.from({ length: 10 }, (_, i) => ({ batch_id: "junior", attendance_date: "2026-11-21", status: i < 8 ? "present" : "absent" })),
      { batch_id: "senior", attendance_date: "2026-11-21", status: "present" },
      { batch_id: "senior", attendance_date: "2026-11-21", status: "absent" },
    ],
    payment_dues: [
      { due_date: "2026-11-15", total_amount: 100, paid_amount: 30, due_status: "pending" },
      { due_date: "2026-10-15", total_amount: 200, paid_amount: 250, due_status: "paid" },
    ],
    payments: [{ amount_paid: 150, payment_date: "2026-11-15T12:00:00Z" }],
    expenses: [{ amount_paid: 20 }],
    inquiries: [{ assigned_center_id: "north", assigned_batch_id: "junior" }],
  };
  supabase.from.mockImplementation((table) => {
    const query = {};
    ["select", "eq", "order", "gte", "lte", "lt", "maybeSingle"].forEach((method) => {
      query[method] = jest.fn(() => query);
    });
    query.then = (resolve, reject) => Promise.resolve({ data: fixtures[table], error: null }).then(resolve, reject);
    queries[table] = query;
    return query;
  });
  getAttendanceTrend.mockResolvedValue([{ date: "fixture" }]);
  getCollectionsTrend.mockResolvedValue([{ month: "fixture" }]);
});
afterEach(() => jest.useRealTimers());

const owner = { id: "owner-a", role: "academy_owner", academy_id: "academy-a" };

test("adds actual center IDs to every attendance row, preserving existing mark fields and unknown centers", async () => {
  const result = await getAcademyOwnerDashboardData(owner);
  expect(result.attendanceByBatch).toEqual([
    { id: "junior", batchId: "junior", batchName: "Junior", centerId: "north", centerName: "Ground",
      expectedPlayers: 1, presentPlayers: 8, attendanceRecorded: true, presentRecords: 8,
      absentRecords: 2, totalRecords: 10, recordedSessions: 1, attendanceRate: 80 },
    { id: "senior", batchId: "senior", batchName: "Senior", centerId: "south", centerName: "Ground",
      expectedPlayers: 1, presentPlayers: 1, attendanceRecorded: true, presentRecords: 1,
      absentRecords: 1, totalRecords: 2, recordedSessions: 1, attendanceRate: 50 },
    { id: "unassigned", batchId: "unassigned", batchName: "Unassigned", centerId: null, centerName: "Center",
      expectedPlayers: 0, presentPlayers: 0, attendanceRecorded: false, presentRecords: 0,
      absentRecords: 0, totalRecords: 0, recordedSessions: 0, attendanceRate: 0 },
  ]);
});

test("retains unique players, center memberships, capped paid amounts, monthly billing and uncapped rate", async () => {
  const result = await getAcademyOwnerDashboardData(owner);
  expect(result.totals).toEqual({ players: 1, centers: 2, batches: 3 });
  expect(result.centers.map((center) => center.players)).toEqual([1, 1]);
  expect(result.financial).toEqual({ totalBilled: 300, totalBilledThisMonth: 100,
    expensesThisMonth: 20, totalPaid: 230, outstandingAmount: 70, collectionRate: 150,
    pendingDues: 1, partialDues: 0, paidDues: 1, collectionsThisMonth: 150 });
  expect(result.enquirySummary.total).toBe(1);
  expect(result.attendanceTrend).toEqual([{ date: "fixture" }]);
  expect(result.collectionsTrend).toEqual([{ month: "fixture" }]);
});

test.each(["academy-a", "academy-b"])("keeps all existing Owner read predicates and analytics scope for %s", async (academyId) => {
  await getAcademyOwnerDashboardData({ ...owner, academy_id: academyId });
  expect(supabase.from.mock.calls.map(([table]) => table)).toEqual([
    "academies", "centers", "batches", "batch_schedules", "players", "player_batches",
    "attendance", "payment_dues", "payments", "expenses", "inquiries",
  ]);
  expect(queries.academies.eq).toHaveBeenCalledWith("id", academyId);
  for (const table of ["centers", "batches", "batch_schedules", "players", "attendance", "expenses", "inquiries"]) {
    expect(queries[table].eq).toHaveBeenCalledWith("academy_id", academyId);
  }
  expect(queries.batches.select).toHaveBeenCalledWith("id, center_id, batch_name, age_group");
  for (const field of ["batches.academy_id", "players.academy_id"]) {
    expect(queries.player_batches.eq).toHaveBeenCalledWith(field, academyId);
  }
  for (const table of ["payment_dues", "payments"]) {
    expect(queries[table].eq).toHaveBeenCalledWith("players.academy_id", academyId);
    expect(queries[table].eq).toHaveBeenCalledWith("players.is_active", true);
  }
  expect(queries.attendance.eq).toHaveBeenCalledWith("is_deleted", false);
  expect(queries.attendance.gte).toHaveBeenCalledWith("attendance_date", "2026-11-15");
  expect(queries.attendance.lte).toHaveBeenCalledWith("attendance_date", "2026-11-21");
  expect(getAttendanceTrend).toHaveBeenCalledWith({ type: "academy", academyId }, 7);
  expect(getCollectionsTrend).toHaveBeenCalledWith({ type: "academy", academyId }, 6);
});

test("missing academy scope still rejects before any read", async () => {
  await expect(getAcademyOwnerDashboardData({ role: "academy_owner" })).rejects.toThrow(/not linked/);
  expect(supabase.from).not.toHaveBeenCalled();
  expect(getAttendanceTrend).not.toHaveBeenCalled();
  expect(getCollectionsTrend).not.toHaveBeenCalled();
});
