import { getAcademyOwnerDashboardData } from "./dashboardService";
import { adaptOwnerData, recordedMarkSummary, groupAttendanceByCenter } from "../components/Dashboard/academyOwnerPreviewAdapter";
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

// Run this suite in separate Node processes with TZ=UTC and TZ=Asia/Kolkata.
// Expectations deliberately preserve existing mixed UTC/local calendar behavior.
const owner = { id: "owner-a", role: "academy_owner", academy_id: "academy-a" };
const kolkata = process.env.TZ === "Asia/Kolkata";
const cases = [
  // instant, UTC attendance day, UTC weekday/month, Kolkata weekday/month
  ["2024-02-28T18:29:59Z", "2024-02-28", 3, "2024-02", 3, "2024-02"],
  ["2024-02-28T18:30:00Z", "2024-02-28", 3, "2024-02", 4, "2024-02"],
  ["2024-02-29T18:30:00Z", "2024-02-29", 4, "2024-02", 5, "2024-03"],
  ["2024-03-01T00:00:00Z", "2024-03-01", 5, "2024-03", 5, "2024-03"],
  ["2024-12-31T18:29:59Z", "2024-12-31", 2, "2024-12", 2, "2024-12"],
  ["2024-12-31T18:30:00Z", "2024-12-31", 2, "2024-12", 3, "2025-01"],
  ["2025-01-01T00:00:00Z", "2025-01-01", 3, "2025-01", 3, "2025-01"],
  ["2024-03-02T18:30:00Z", "2024-03-02", 6, "2024-03", 7, "2024-03"],
];
const bounds = {
  "2024-02": ["2024-02-01", "2024-03-01", "2024-01-31", "2024-02-29"],
  "2024-03": ["2024-03-01", "2024-04-01", "2024-02-29", "2024-03-31"],
  "2024-12": ["2024-12-01", "2025-01-01", "2024-11-30", "2024-12-31"],
  "2025-01": ["2025-01-01", "2025-02-01", "2024-12-31", "2025-01-31"],
};
test("timezone process is explicit", () => {
  expect(["UTC", "Asia/Kolkata"]).toContain(process.env.TZ);
  expect(new Date("2024-03-01T00:00:00Z").getTimezoneOffset()).toBe(kolkata ? -330 : 0);
});
test.each(cases)("calendar characterization at %s", async (instant, day, utcWeekday, utcMonth, indiaWeekday, indiaMonth) => {
  jest.setSystemTime(new Date(instant));
  const month = kolkata ? indiaMonth : utcMonth;
  const weekday = kolkata ? indiaWeekday : utcWeekday;
  const [start, end, indiaStart, indiaEnd] = bounds[month];
  fixtures.batch_schedules = Array.from({ length: 7 }, (_, i) => ({
    id: `schedule-${i + 1}`, day_of_week: i + 1, batch_id: "junior", center_id: "north", start_time: "09:00"
  }));
  fixtures.attendance = [{ batch_id: "junior", attendance_date: day, status: "present" }];
  fixtures.payment_dues = [
    { due_date: start, total_amount: 100 }, { due_date: end, total_amount: 900 },
    { due_date: "2024-02-29", total_amount: 7 }, { due_date: null, total_amount: 11 }
  ];
  fixtures.payments = [
    { payment_date: `${start}T00:00:00Z`, amount_paid: 20 },
    { payment_date: `${kolkata ? indiaStart : start}T18:30:00Z`, amount_paid: 30 },
    { payment_date: `${end}T00:00:00Z`, amount_paid: 900 }
  ];
  const result = await getAcademyOwnerDashboardData(owner);
  expect(queries.attendance.lte).toHaveBeenCalledWith("attendance_date", day);
  expect(result.todaySessions).toHaveLength(1);
  expect(result.todaySessions[0]).toMatchObject({ id: `schedule-${weekday}`, attendanceRecorded: true });
  expect(queries.expenses.gte).toHaveBeenCalledWith("expense_date", kolkata ? indiaStart : start);
  expect(queries.expenses.lt).toHaveBeenCalledWith("expense_date", kolkata ? indiaEnd : end);
  expect(result.financial.totalBilledThisMonth).toBe(100 + (month === "2024-02" ? 7 : 0));
  expect(result.financial.collectionsThisMonth).toBe(50);
  expect(adaptOwnerData(result).financial).toEqual(result.financial);
});
test("service-to-preview preserves finances, weighted marks and same-name center identity", async () => {
  const result = await getAcademyOwnerDashboardData(owner);
  const preview = adaptOwnerData(result);
  expect(preview.financial).toEqual(result.financial);
  expect(preview.financial).toMatchObject({ totalPaid: 230, outstandingAmount: 70, collectionRate: 150 });
  expect(recordedMarkSummary(preview.attendanceBatches)).toMatchObject({ present: 9, marked: 12, rate: 75 });
  expect(groupAttendanceByCenter(preview.attendanceBatches).map(g => g.centerId)).toEqual(["north", "south", null]);
  expect(preview.totals.players).toBe(1);
  expect(preview.centerMemberships).toBe(2);
});
