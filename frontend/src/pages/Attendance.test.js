import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Attendance from "./Attendance";
import { supabase } from "../supabaseClient";
import { getAccessibleAcademies, getAccessibleCenters, getAccessibleBatches } from "../utils/dataScope";
import { saveAttendanceRecords } from "../services/attendanceService";

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
  getEnrolledPlayersForSchedule: jest.fn(async () => []),
  formatScheduleLabel: jest.fn(() => "Training session"),
}));
jest.mock("../services/attendanceService", () => ({
  saveAttendanceRecords: jest.fn(),
}));

const renderAttendance = (role) => {
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  supabase.from.mockImplementation((table) => {
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
    <MemoryRouter initialEntries={["/attendance?centerId=center-1&batchId=batch-1"]}>
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
  expect(screen.getByRole("link", { name: "Attendance History" }))
    .toHaveAttribute("href", "/attendance-history");
  expect(screen.getByLabelText("Date")).toHaveAttribute("max", new Date().toISOString().slice(0, 10));
  await waitFor(() => expect(getAccessibleAcademies).toHaveBeenCalled());
});
