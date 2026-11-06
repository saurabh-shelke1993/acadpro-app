import React from "react";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AttendanceHistory from "./AttendanceHistory";
import { supabase } from "../supabaseClient";
import { getCurrentUser } from "../utils/auth";
import {
  getAccessibleAcademies,
  getAccessibleCenters,
  getAccessibleBatches,
} from "../utils/dataScope";
import { utcAttendanceToday } from "../utils/attendanceEditWindow";

jest.mock("../components/Layout", () => ({ children }) => <>{children}</>);
jest.mock("../supabaseClient", () => ({ supabase: { from: jest.fn() } }));
jest.mock("../utils/auth", () => ({ getCurrentUser: jest.fn() }));
jest.mock("../utils/dataScope", () => ({
  getAccessibleAcademies: jest.fn(),
  getAccessibleCenters: jest.fn(),
  getAccessibleBatches: jest.fn(),
}));
jest.mock("../services/attendanceService", () => ({
  updateAttendanceStatus: jest.fn(),
  softDeleteAttendance: jest.fn(),
}));

const today = utcAttendanceToday();
const oldDate = new Date(Date.parse(today + "T00:00:00Z") - 9 * 86400000).toISOString().slice(0, 10);
const makeRecord = (id, fullName, attendance_date) => ({
  id,
  academy_id: "academy-1",
  player_id: id + "-player",
  attendance_date,
  status: "present",
  is_deleted: false,
  players: { full_name: fullName },
  batches: { batch_name: "Juniors", centers: { center_name: "GawandBaugh" } },
  batch_schedules: null,
  users: { full_name: "Test Coach" },
});

const rows = [
  makeRecord("recent-1", "Recent Junior", today),
  makeRecord("old-1", "Old Junior", oldDate),
];

const renderHistory = async (role) => {
  getCurrentUser.mockResolvedValue({ id: "user-1", role, academy_id: "academy-1" });
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    gte: () => chain,
    lte: () => chain,
    in: () => chain,
    then: (resolve, reject) =>
      Promise.resolve({ data: rows, error: null }).then(resolve, reject),
  };
  supabase.from.mockReturnValue(chain);
  render(
    <MemoryRouter initialEntries={["/attendance-history"]}>
      <AttendanceHistory />
    </MemoryRouter>
  );
  await screen.findByRole("cell", { name: "Old Junior" });
};

beforeEach(() => {
  jest.clearAllMocks();
  getAccessibleAcademies.mockResolvedValue([{ id: "academy-1", academy_name: "Test Academy" }]);
  getAccessibleCenters.mockResolvedValue([]);
  getAccessibleBatches.mockResolvedValue([]);
});

test("AM4 Coach can edit recent attendance but sees older records as read-only", async () => {
  await renderHistory("coach");
  const recent = screen.getByRole("cell", { name: "Recent Junior" }).closest("tr");
  const old = screen.getByRole("cell", { name: "Old Junior" }).closest("tr");
  expect(within(recent).getByRole("button", { name: "Edit attendance for Recent Junior" }))
    .toBeInTheDocument();
  expect(within(old).queryByRole("button", { name: "Edit attendance for Old Junior" }))
    .not.toBeInTheDocument();
  expect(within(old).getByText("Read-only")).toBeInTheDocument();
  expect(within(old).queryByRole("button", { name: /Delete attendance/ })).not.toBeInTheDocument();
  expect(screen.getByText(/Earlier records are read-only/)).toBeInTheDocument();
});

test.each(["academy_owner", "super_admin"])(
  "AM4 %s retains edit and soft-delete controls for older attendance",
  async (role) => {
    await renderHistory(role);
    const old = screen.getByRole("cell", { name: "Old Junior" }).closest("tr");
    expect(within(old).getByRole("button", { name: "Edit attendance for Old Junior" }))
      .toBeInTheDocument();
    expect(within(old).getByRole("button", { name: "Delete attendance for Old Junior" }))
      .toBeInTheDocument();
  }
);

test("AM4 History retains scoped navigation and attendance data loading", async () => {
  await renderHistory("coach");
  expect(screen.getByRole("link", { name: "Mark Attendance" }))
    .toHaveAttribute("href", "/attendance?view=mark");
  expect(screen.getByRole("link", { name: "Attendance History" }))
    .toHaveAttribute("aria-current", "page");
  expect(supabase.from).toHaveBeenCalledWith("attendance");
});

test("AM7 Owner sees compact academy context instead of a disabled academy selector", async () => {
  await renderHistory("academy_owner");
  expect(screen.getByText(/Academy:/)).toHaveTextContent("Academy: Test Academy");
  expect(screen.queryByRole("combobox", { name: "Academy" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reset filters" })).toBeDisabled();
  expect(screen.getByRole("heading", { name: "Records" })).toBeInTheDocument();
});

test("AM7 Super Admin retains academy filtering without changing their role scope", async () => {
  await renderHistory("super_admin");
  expect(screen.getByRole("combobox", { name: "Academy" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "All academies" })).toBeInTheDocument();
});

test("AM7 presents all eight historical record details for mobile card layout", async () => {
  await renderHistory("coach");
  const row = screen.getByRole("cell", { name: "Old Junior" }).closest("tr");
  expect(row).toHaveClass("attendance-history-record-row");
  expect(within(row).getByRole("cell", { name: "present" })).toHaveAttribute("data-label", "Status");
  expect(within(row).getByRole("cell", { name: "GawandBaugh" })).toHaveAttribute("data-label", "Center");
  expect(within(row).getByRole("cell", { name: "Juniors" })).toHaveAttribute("data-label", "Batch");
  expect(within(row).getByRole("cell", { name: "Legacy / batch attendance" })).toHaveAttribute("data-label", "Session");
  expect(within(row).getByRole("cell", { name: "Test Coach" })).toHaveAttribute("data-label", "Marked by");
  expect(within(row).getByRole("cell", { name: "Read-only" })).toHaveAttribute("data-label", "Actions");
});

test("AM7 status filtering and reset keep the same scoped records", async () => {
  await renderHistory("coach");
  fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "absent" } });
  expect(await screen.findByText("No attendance records found")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
  await waitFor(() => expect(screen.getByRole("cell", { name: "Old Junior" })).toBeInTheDocument());
  expect(supabase.from).toHaveBeenCalledWith("attendance");
});
