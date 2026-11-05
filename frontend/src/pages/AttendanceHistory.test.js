import React from "react";
import { render, screen, within } from "@testing-library/react";
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
  await screen.findByText("Old Junior");
};

beforeEach(() => {
  jest.clearAllMocks();
  getAccessibleAcademies.mockResolvedValue([{ id: "academy-1", academy_name: "Test Academy" }]);
  getAccessibleCenters.mockResolvedValue([]);
  getAccessibleBatches.mockResolvedValue([]);
});

test("AM4 Coach can edit recent attendance but sees older records as read-only", async () => {
  await renderHistory("coach");
  const recent = screen.getByText("Recent Junior").closest("tr");
  const old = screen.getByText("Old Junior").closest("tr");
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
    const old = screen.getByText("Old Junior").closest("tr");
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
