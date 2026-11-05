import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CoachAttendance from "./CoachAttendance";
import { supabase } from "../supabaseClient";
import {
  getCoachAttendanceSessions,
  getEnrolledPlayersForSchedule,
} from "../services/scheduleViewService";

jest.mock("../components/Layout", () => ({ children }) => <>{children}</>);
jest.mock("../supabaseClient", () => ({ supabase: { from: jest.fn() } }));
jest.mock("../services/scheduleViewService", () => ({
  getCoachAttendanceSessions: jest.fn(),
  getEnrolledPlayersForSchedule: jest.fn(),
  formatScheduleLabel: jest.fn(() => "Monday 5:00–6:00 PM"),
}));

const session = {
  id: "session-1",
  academy_id: "academy-1",
  batch_id: "batch-1",
  center_id: "center-1",
  batches: { batch_name: "Juniors" },
  centers: { center_name: "GawandBaugh" },
};
let recordedRows;

const setup = (route, rows = [{ id: "record-1", player_id: "player-1", status: "present" }]) => {
  recordedRows = rows;
  localStorage.setItem("acadpro_user", JSON.stringify({
    id: "coach-user-1", role: "coach", academy_id: "academy-1",
  }));
  getCoachAttendanceSessions.mockResolvedValue([session]);
  getEnrolledPlayersForSchedule.mockResolvedValue([
    { id: "player-1", full_name: "Test Junior" },
  ]);
  supabase.from.mockImplementation((table) => {
    if (table !== "attendance") throw new Error("Unexpected table " + table);
    const query = {
      select: () => query,
      eq: () => query,
      then: (resolve, reject) =>
        Promise.resolve({ data: recordedRows, error: null }).then(resolve, reject),
    };
    return query;
  });
  return render(
    <MemoryRouter initialEntries={[route]}>
      <CoachAttendance />
    </MemoryRouter>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

test("AM3 existing Coach attendance outside seven dates is visible but read-only", async () => {
  setup("/coach-attendance?scheduleId=session-1&date=2020-01-01");
  expect(await screen.findByText(/Older sessions remain available for review/)).toBeInTheDocument();
  expect(screen.getByText("Test Junior")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Update Attendance" })).toBeDisabled();
  expect(screen.getByRole("button", { name: /Mark all present/ })).toBeDisabled();
  expect(screen.getByRole("button", { name: /Mark all absent/ })).toBeDisabled();
  expect(screen.getAllByRole("radio").every((radio) => radio.disabled)).toBe(true);
  expect(getEnrolledPlayersForSchedule).toHaveBeenCalledWith("session-1", "2020-01-01");
});

test("AM3 new, unrecorded historical sessions are not mistaken for existing read-only data", async () => {
  setup("/coach-attendance?scheduleId=session-1&date=2020-01-01", []);
  expect(await screen.findByText("Test Junior")).toBeInTheDocument();
  const save = screen.getByRole("button", { name: "Save Attendance" });
  expect(save).toBeDisabled();
  fireEvent.click(screen.getByRole("radio", { name: "Mark Test Junior present" }));
  await waitFor(() => expect(save).not.toBeDisabled());
  expect(screen.queryByText(/Older sessions remain available for review/)).not.toBeInTheDocument();
});

test("AM3 tampered schedule deep links are normalized to assigned sessions before roster reads", async () => {
  setup("/coach-attendance?scheduleId=unassigned-session&date=2020-01-01");
  expect(await screen.findByText("Test Junior")).toBeInTheDocument();
  expect(getEnrolledPlayersForSchedule).toHaveBeenCalledWith("session-1", "2020-01-01");
  expect(getEnrolledPlayersForSchedule).not.toHaveBeenCalledWith("unassigned-session", "2020-01-01");
});

test("AM3 retains direct Coach Dashboard session/date routing", async () => {
  setup("/coach-attendance?scheduleId=session-1&date=2020-01-01&batchId=batch-1");
  expect(await screen.findByRole("heading", { name: "Mark Attendance" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Attendance History" }))
    .toHaveAttribute("href", "/attendance?view=history");
  expect(getCoachAttendanceSessions).toHaveBeenCalledWith(
    expect.objectContaining({ role: "coach", academy_id: "academy-1" }), "2020-01-01"
  );
});

test("AM6.1 Coach shows 12-hour session labels and one live attendance summary", async () => {
  const recentDate = new Date().toISOString().slice(0, 10);
  setup("/coach-attendance?scheduleId=session-1&date=" + recentDate);
  await screen.findByText("Test Junior");
  expect(screen.getAllByLabelText("Attendance summary")).toHaveLength(1);
  expect(screen.getByText("Session")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Update Attendance" })).not.toBeDisabled();
});

test("AM6.3–6.4 Coach Reset restores saved status without writing to Supabase", async () => {
  const recentDate = new Date().toISOString().slice(0, 10);
  setup("/coach-attendance?scheduleId=session-1&date=" + recentDate);
  await screen.findByText("Test Junior");
  const present = screen.getByRole("radio", { name: "Mark Test Junior present" });
  const absent = screen.getByRole("radio", { name: "Mark Test Junior absent" });
  await waitFor(() => expect(present).toBeChecked());

  fireEvent.click(absent);
  expect(absent).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  expect(present).toBeChecked();
  expect(absent).not.toBeChecked();
  expect(supabase.from.mock.calls.every(([table]) => table === "attendance")).toBe(true);
});

test("AM6.4 Coach new-session Reset clears draft marks and locks Save", async () => {
  const recentDate = new Date().toISOString().slice(0, 10);
  setup("/coach-attendance?scheduleId=session-1&date=" + recentDate, []);
  await screen.findByText("Test Junior");
  const save = screen.getByRole("button", { name: "Save Attendance" });
  await waitFor(() => expect(save).toBeDisabled());

  fireEvent.click(screen.getByRole("button", { name: /Mark all absent/ }));
  expect(screen.getByRole("radio", { name: "Mark Test Junior absent" })).toBeChecked();
  expect(save).not.toBeDisabled();

  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  expect(screen.getAllByRole("radio").every((radio) => !radio.checked)).toBe(true);
  expect(save).toBeDisabled();
});
