import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Attendance from "./Attendance";
import { supabase } from "../supabaseClient";
import { getAccessibleAcademies, getAccessibleCenters, getAccessibleBatches } from "../utils/dataScope";
import { saveAttendanceRecords } from "../services/attendanceService";
import { getAttendanceSessionsForBatch, getActiveBatchAttendanceDays, getEnrolledPlayersForSchedule } from "../services/scheduleViewService";

jest.mock("../components/Layout", () => ({ children }) => <>{children}</>);
jest.mock("../supabaseClient", () => ({
  supabase: { auth: { getUser: jest.fn() }, from: jest.fn() },
}));
jest.mock("../utils/dataScope", () => ({
  getAccessibleAcademies: jest.fn(),
  getAccessibleCenters: jest.fn(),
  getAccessibleBatches: jest.fn(),
}));
jest.mock("../services/scheduleViewService", () => ({
  getAttendanceSessionsForBatch: jest.fn(async () => []),
  getActiveBatchAttendanceDays: jest.fn(async () => []),
  getEnrolledPlayersForSchedule: jest.fn(async () => []),
  formatScheduleLabel: jest.fn(() => "Training session"),
}));
jest.mock("../services/attendanceService", () => ({
  saveAttendanceRecords: jest.fn(),
}));

const renderAttendance = (role, initialRoute = "/attendance", existingRows = []) => {
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  supabase.from.mockImplementation((table) => {
    if (table === "attendance") {
      const query = {
        select: () => query,
        eq: () => query,
        then: (resolve, reject) =>
          Promise.resolve({ data: existingRows, error: null }).then(resolve, reject),
      };
      return query;
    }
    if (table !== "users") throw new Error("Unexpected data table: " + table);
    return {
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { id: "user-1", academy_id: "academy-1", role }, error: null }),
        }),
      }),
    };
  });

  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/attendance-history" element={<h1>History landing</h1>} />
      </Routes>
    </MemoryRouter>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  getAccessibleAcademies.mockResolvedValue([]);
  getAccessibleCenters.mockResolvedValue([]);
  getAccessibleBatches.mockResolvedValue([]);
  saveAttendanceRecords.mockResolvedValue(undefined);
  getActiveBatchAttendanceDays.mockResolvedValue([]);
});

test("AM2 Super Admin direct /attendance is redirected to History, without a marking action", async () => {
  renderAttendance("super_admin");
  expect(await screen.findByRole("heading", { name: "History landing" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Save Attendance" })).not.toBeInTheDocument();
  expect(saveAttendanceRecords).not.toHaveBeenCalled();
});

test("AM2 Academy Owner retains Mark Attendance workspace and existing selection controls", async () => {
  renderAttendance("academy_owner");
  expect(await screen.findByRole("heading", { name: "Mark Attendance" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "History landing" })).not.toBeInTheDocument();
  expect(await screen.findByRole("link", { name: "Attendance History" }))
    .toHaveAttribute("href", "/attendance?view=history");
  expect(screen.getByLabelText("Date")).toHaveAttribute("max", new Date().toISOString().slice(0, 10));
  await waitFor(() => expect(getAccessibleAcademies).toHaveBeenCalled());
});

const session = { id: "session-1", day_of_week: 4, start_time: "17:00:00", end_time: "18:00:00" };

const openOwnerRoster = async (existingRows = []) => {
  getAccessibleAcademies.mockResolvedValue([
    { id: "academy-1", academy_name: "Thane City FC" },
  ]);
  getAccessibleCenters.mockResolvedValue([
    { id: "center-1", academy_id: "academy-1", center_name: "Lodha Amara" },
  ]);
  getAccessibleBatches.mockResolvedValue([
    { id: "batch-1", batch_name: "Juniors" },
  ]);
  getAttendanceSessionsForBatch.mockResolvedValue([session]);
  getActiveBatchAttendanceDays.mockResolvedValue([1, 3, 5]);
  getEnrolledPlayersForSchedule.mockResolvedValue([
    { player_id: "player-1", full_name: "Pratik Maheshwari" },
    { player_id: "player-2", full_name: "Pratham Naik" },
  ]);
  renderAttendance("academy_owner", "/attendance?view=mark", existingRows);
  await screen.findByRole("option", { name: "Lodha Amara" });
  fireEvent.change(screen.getByLabelText("Center"), { target: { value: "center-1" } });
  await screen.findByRole("option", { name: "Juniors" });
  fireEvent.change(screen.getByLabelText("Batch"), { target: { value: "batch-1" } });
  await screen.findByRole("option", { name: /Thursday · 5:00 PM–6:00 PM/ });
  fireEvent.change(screen.getByLabelText("Session"), { target: { value: "session-1" } });
  await screen.findByText("Pratik Maheshwari");
  await screen.findByText("Pratham Naik");
  await waitFor(() => expect(screen.getByLabelText("Attendance summary")).toBeInTheDocument());
};

test("AM6.1 Owner filters show Academy context and one row of Center, Batch, Date, Session", async () => {
  await openOwnerRoster();
  expect(screen.getByText("Academy: Thane City FC")).toBeInTheDocument();
  expect(screen.queryByLabelText("Academy")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Center")).toBeInTheDocument();
  expect(screen.getByLabelText("Batch")).toBeInTheDocument();
  expect(screen.getByLabelText("Date")).toBeInTheDocument();
  expect(screen.getByLabelText("Session")).toBeInTheDocument();
  expect(screen.getByRole("option", { name: /Thursday · 5:00 PM–6:00 PM/ })).toBeInTheDocument();
});

test("AM6.2–6.4 Owner live totals, bulk marking, draft Reset and Save gating", async () => {
  await openOwnerRoster();
  const save = screen.getByRole("button", { name: "Save Attendance" });
  expect(save).toBeDisabled();
  expect(screen.getAllByLabelText("Attendance summary")).toHaveLength(1);

  fireEvent.click(screen.getByRole("button", { name: /Mark all present/ }));
  expect(screen.getAllByRole("radio", { name: /present/ }).every((radio) => radio.checked)).toBe(true);
  expect(save).not.toBeDisabled();
  expect(saveAttendanceRecords).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: /Mark all absent/ }));
  expect(screen.getAllByRole("radio", { name: /absent/ }).every((radio) => radio.checked)).toBe(true);
  expect(saveAttendanceRecords).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  expect(screen.getAllByRole("radio").every((radio) => !radio.checked)).toBe(true);
  expect(save).toBeDisabled();
  expect(saveAttendanceRecords).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("radio", { name: "Mark Pratik Maheshwari present" }));
  expect(save).toBeDisabled();
  fireEvent.click(screen.getByRole("radio", { name: "Mark Pratham Naik absent" }));
  expect(save).not.toBeDisabled();

  fireEvent.click(save);
  await waitFor(() => expect(saveAttendanceRecords).toHaveBeenCalledTimes(1));
  const rows = saveAttendanceRecords.mock.calls[0][0];
  expect(rows).toHaveLength(2);
  expect(rows.map((row) => row.status)).toEqual(["present", "absent"]);
  expect(rows.every((row) => row.academy_id === "academy-1" && row.batch_schedule_id === "session-1")).toBe(true);
});

test("AM6.4 Owner previously recorded attendance is read-only and not saved again", async () => {
  await openOwnerRoster([
    { player_id: "player-1", status: "present" },
    { player_id: "player-2", status: "absent" },
  ]);
  await screen.findByText(/Attendance is already recorded for this session/);
  expect(screen.getAllByRole("radio").every((radio) => radio.disabled)).toBe(true);
  expect(screen.queryByRole("button", { name: "Save Attendance" })).not.toBeInTheDocument();
  expect(saveAttendanceRecords).not.toHaveBeenCalled();
});

test("AM6.6 Owner sees batch operating days independently of date-scoped sessions", async () => {
  await openOwnerRoster();
  expect(await screen.findByText("Runs: Mon · Wed · Fri")).toBeInTheDocument();
  expect(getActiveBatchAttendanceDays).toHaveBeenCalledWith("batch-1", "center-1");
  expect(getAttendanceSessionsForBatch).toHaveBeenCalledWith("batch-1", "center-1", expect.any(String));
  expect(screen.queryByText("Daily operations")).not.toBeInTheDocument();
  expect(screen.queryByText("Daily roster")).not.toBeInTheDocument();
});
