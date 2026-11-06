import React from "react";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AttendanceHistory from "./AttendanceHistory";
import { getAttendanceHistoryPage } from "../services/attendanceHistoryService";
import { getCurrentUser } from "../utils/auth";
import {
  getAccessibleAcademies,
  getAccessibleCenters,
  getAccessibleBatches,
} from "../utils/dataScope";
import { utcAttendanceToday } from "../utils/attendanceEditWindow";

jest.mock("../components/Layout", () => ({ children }) => <>{children}</>);
jest.mock("../services/attendanceHistoryService", () => ({
  ATTENDANCE_HISTORY_PAGE_SIZE: 5,
  getAttendanceHistoryPage: jest.fn(),
}));
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

const renderHistory = async (role, data = rows) => {
  getCurrentUser.mockResolvedValue({ id: "user-1", role, academy_id: "academy-1" });
  // Match the server contract: apply filters before slicing five records.
  getAttendanceHistoryPage.mockImplementation(async ({ page, playerName, status }) => {
    const filtered = data.filter((item) =>
      (!status || item.status === status) &&
      (!playerName || item.players.full_name.toLowerCase().includes(playerName.toLowerCase()))
    );
    return { rows: filtered.slice((page - 1) * 5, page * 5), count: filtered.length };
  });
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
  expect(getAttendanceHistoryPage).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ academy_id: "academy-1" }) }));
});

test("AM7 Owner sees compact academy context instead of a disabled academy selector", async () => {
  await renderHistory("academy_owner");
  expect(screen.getByText(/Academy:/)).toHaveTextContent("Academy: Test Academy");
  expect(screen.queryByRole("combobox", { name: "Academy" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reset filters" })).toBeDisabled();
  expect(screen.getByRole("heading", { name: /^Records/ })).toBeInTheDocument();
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
  expect(getAttendanceHistoryPage).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ academy_id: "academy-1" }) }));
});

test("AM7.3 Next/Previous load only the selected server page and preserve full record count", async () => {
  const many = [...rows, ...Array.from({ length: 10 }, (_, index) =>
    makeRecord("extra-" + index, "Extra Junior " + index, oldDate))];
  await renderHistory("academy_owner", many);
  expect(screen.getByRole("heading", { name: /Records · 12/ })).toBeInTheDocument();
  expect(screen.getAllByText("Showing 1–5 of 12")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(getAttendanceHistoryPage).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })));
  expect(await screen.findByRole("cell", { name: "Extra Junior 3" })).toBeInTheDocument();
  expect(screen.queryByRole("cell", { name: "Old Junior" })).not.toBeInTheDocument();
  expect(screen.getAllByText("Showing 6–10 of 12")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Previous" }));
  expect(await screen.findByRole("cell", { name: "Old Junior" })).toBeInTheDocument();
  expect(screen.getAllByText("Showing 1–5 of 12")).toHaveLength(2);
});

test("AM7.3 player search matches records not present on first page", async () => {
  const many = [...rows, ...Array.from({ length: 6 }, (_, index) =>
    makeRecord("other-" + index, "Other Junior " + index, oldDate)),
    makeRecord("unique", "Unique Remote Player", oldDate)];
  await renderHistory("coach", many);
  expect(screen.queryByRole("cell", { name: "Unique Remote Player" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox", { name: "Player name" }), {
    target: { value: "Unique Remote" },
  });
  await waitFor(() => expect(getAttendanceHistoryPage).toHaveBeenCalledWith(expect.objectContaining({
    playerName: "Unique Remote", page: 1,
  })));
  expect(await screen.findByRole("cell", { name: "Unique Remote Player" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /Records · 1/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
});

test("AM7.3 server error shows Retry instead of a false empty-result success", async () => {
  await renderHistory("coach");
  getAttendanceHistoryPage.mockRejectedValueOnce(new Error("Unavailable"));
  fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "absent" } });
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load attendance history.");
  expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(screen.getByText("No attendance records found")).toBeInTheDocument());
});
