import { getAcademyOwnerDashboardData } from "./dashboardService";
import { adaptOwnerData, recordedMarkSummary, groupAttendanceByCenter } from "../components/Dashboard/academyOwnerPreviewAdapter";
import { supabase } from "../supabaseClient";
import { getAttendanceTrend, getCollectionsTrend } from "./analyticsService";
import { render, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AcademyOwnerDashboard from "../components/Dashboard/AcademyOwnerDashboard";
import AcademyOwnerDashboardPreview from "../components/Dashboard/AcademyOwnerDashboardPreview";

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
    expenses: [{ expense_date: "2026-11-15", amount_paid: 20 }],
    inquiries: [{ created_at: "2026-11-15T12:00:00Z", assigned_center_id: "north", assigned_batch_id: "junior" }],
  };
  supabase.from.mockImplementation((table) => {
    const query = {};
    ["select", "eq", "order", "gte", "lte", "lt", "maybeSingle"].forEach((method) => {
      query[method] = jest.fn(() => query);
    });
    query.then = (resolve, reject) => {
      let data = fixtures[table];
      // Model the two server-side month filters, including actual timestamp comparisons.
      if (table === "expenses" || table === "inquiries") {
        for (const [column, bound] of query.gte.mock.calls) {
          data = data.filter(row => table === "inquiries"
            ? Date.parse(row[column]) >= Date.parse(bound) : row[column] >= bound);
        }
        for (const [column, bound] of query.lt.mock.calls) {
          data = data.filter(row => table === "inquiries"
            ? Date.parse(row[column]) < Date.parse(bound) : row[column] < bound);
        }
      }
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    };
    queries[table] = query;
    return query;
  });
  getAttendanceTrend.mockResolvedValue([{ date: "fixture" }]);
  getCollectionsTrend.mockResolvedValue([{ month: "fixture" }]);
});
afterEach(() => jest.useRealTimers());

// Run this suite in separate Node processes with TZ=UTC and TZ=Asia/Kolkata.
// Monthly reporting is corrected to IST; attendance still characterizes mixed UTC/local behavior.
// Original diagnostic expectations remain in commit a2061ea (BETA-06.3A).
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
  const month = indiaMonth;
  const weekday = kolkata ? indiaWeekday : utcWeekday;
  const [start, end, indiaStart] = bounds[month];
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
    { payment_date: `${indiaStart}T18:30:00Z`, amount_paid: 30 },
    { payment_date: `${end}T00:00:00Z`, amount_paid: 900 }
  ];
  const result = await getAcademyOwnerDashboardData(owner);
  expect(queries.attendance.lte).toHaveBeenCalledWith("attendance_date", day);
  expect(result.todaySessions).toHaveLength(1);
  expect(result.todaySessions[0]).toMatchObject({ id: `schedule-${weekday}`, attendanceRecorded: true });
  expect(queries.expenses.gte).toHaveBeenCalledWith("expense_date", start);
  expect(queries.expenses.lt).toHaveBeenCalledWith("expense_date", end);
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

test.each([
  ["2024-02-29T18:29:59.999Z", "2024-02-01", "2024-03-01", "2024-01-31", "2024-02-29", "2024-01-31T18:30:00.000Z", "2024-02-29T18:30:00.000Z"],
  ["2024-02-29T18:30:00Z", "2024-03-01", "2024-04-01", "2024-02-29", "2024-03-31", "2024-02-29T18:30:00.000Z", "2024-03-31T18:30:00.000Z"],
  ["2024-03-31T18:29:59.999Z", "2024-03-01", "2024-04-01", "2024-02-29", "2024-03-31", "2024-02-29T18:30:00.000Z", "2024-03-31T18:30:00.000Z"],
  ["2024-03-31T18:30:00Z", "2024-04-01", "2024-05-01", "2024-03-31", "2024-04-30", "2024-03-31T18:30:00.000Z", "2024-04-30T18:30:00.000Z"],
  ["2024-12-31T18:29:59.999Z", "2024-12-01", "2025-01-01", "2024-11-30", "2024-12-31", "2024-11-30T18:30:00.000Z", "2024-12-31T18:30:00.000Z"],
  ["2024-12-31T18:30:00Z", "2025-01-01", "2025-02-01", "2024-12-31", "2025-01-31", "2024-12-31T18:30:00.000Z", "2025-01-31T18:30:00.000Z"],
])("corrected IST monthly inclusion at %s", async (instant, start, end, priorDay, lastDay, utcStart, utcEnd) => {
  jest.setSystemTime(new Date(instant));
  fixtures.payment_dues = [
    { due_date: priorDay, total_amount: 900, paid_amount: 0, due_status: "pending" },
    { due_date: start, total_amount: 100, paid_amount: 150, due_status: "paid" },
    { due_date: lastDay, total_amount: 200, paid_amount: 50, due_status: "partial" },
    { due_date: end, total_amount: 800, paid_amount: 0, due_status: "pending" },
    { due_date: "2024-02-30", total_amount: 1000, paid_amount: 0, due_status: "pending" },
  ];
  fixtures.expenses = [
    { expense_date: priorDay, amount_paid: 900 }, { expense_date: start, amount_paid: 10 },
    { expense_date: lastDay, amount_paid: 20 }, { expense_date: end, amount_paid: 800 },
  ];
  const beforeStart = new Date(Date.parse(utcStart) - 1).toISOString();
  const beforeEnd = new Date(Date.parse(utcEnd) - 1).toISOString();
  fixtures.payments = [
    { payment_date: beforeStart, amount_paid: 900 }, { payment_date: utcStart, amount_paid: 400 },
    { payment_date: beforeEnd, amount_paid: 200 }, { payment_date: utcEnd, amount_paid: 800 },
    { payment_date: "invalid", amount_paid: 500 },
  ];
  fixtures.inquiries = [beforeStart, utcStart, beforeEnd, utcEnd].map((created_at, id) => ({
    id, created_at, assigned_center_id: "north", assigned_batch_id: "junior",
  }));
  const result = await getAcademyOwnerDashboardData(owner);
  expect(queries.expenses.gte).toHaveBeenCalledWith("expense_date", start);
  expect(queries.expenses.lt).toHaveBeenCalledWith("expense_date", end);
  expect(queries.inquiries.gte).toHaveBeenCalledWith("created_at", utcStart);
  expect(queries.inquiries.lt).toHaveBeenCalledWith("created_at", utcEnd);
  expect(result.financial).toEqual({
    totalBilled: 3000, totalBilledThisMonth: 300, totalPaid: 150,
    outstandingAmount: 2850, collectionsThisMonth: 600, collectionRate: 200,
    expensesThisMonth: 30, pendingDues: 3, partialDues: 1, paidDues: 1,
  });
  expect(result.enquirySummary).toMatchObject({ total: 2, groups: [
    { centerId: "north", total: 2, batches: [{ batchId: "junior", count: 2 }] },
  ] });
  expect(adaptOwnerData(result).financial).toEqual(result.financial);
});

test("monthly reporting retains its captured month when reads cross midnight", async () => {
  jest.setSystemTime(new Date("2024-03-31T18:29:59.999Z"));
  const read = supabase.from.getMockImplementation();
  supabase.from.mockImplementation((table) => {
    jest.setSystemTime(new Date("2024-03-31T18:30:00Z"));
    return read(table);
  });
  fixtures.payment_dues = [{ due_date: "2024-03-31", total_amount: 100 }];
  fixtures.payments = [{ payment_date: "2024-03-31T18:29:59.999Z", amount_paid: 70 }];
  const result = await getAcademyOwnerDashboardData(owner);
  expect(queries.expenses.gte).toHaveBeenCalledWith("expense_date", "2024-03-01");
  expect(result.financial).toMatchObject({ totalBilledThisMonth: 100, collectionsThisMonth: 70 });
});

test("both real Owner presentations display the same corrected monthly data", async () => {
  jest.setSystemTime(new Date("2024-02-29T18:30:00Z"));
  fixtures.payment_dues = [{ due_date: "2024-03-01", total_amount: 1234, paid_amount: 0 }];
  fixtures.payments = [{ payment_date: "2024-02-29T18:30:00Z", amount_paid: 700 }];
  fixtures.expenses = [{ expense_date: "2024-03-31", amount_paid: 90 }];
  const result = await getAcademyOwnerDashboardData(owner);
  const before = JSON.stringify(result);
  window.matchMedia = jest.fn(() => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
  for (const Component of [AcademyOwnerDashboard, AcademyOwnerDashboardPreview]) {
    const view = render(<MemoryRouter><Component data={result} /></MemoryRouter>);
    for (const [label, value] of [["Billed this month", "1,234"], ["Collected this month", "700"], ["Expenses this month", "90"]]) {
      expect(within(view.container).getByRole("link", { name: new RegExp(label) })).toHaveTextContent(value);
    }
    view.unmount();
  }
  expect(JSON.stringify(result)).toBe(before);
});
