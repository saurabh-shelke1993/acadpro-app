import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";
import { getCurrentUser } from "../utils/auth";
import AttendanceWorkspace, { LegacyAttendanceRedirect } from "./AttendanceWorkspace";

jest.mock("../utils/auth", () => ({ getCurrentUser: jest.fn() }));
jest.mock("./Attendance", () => () => <main data-testid="owner-mark">Academy Owner marking</main>);
jest.mock("./CoachAttendance", () => () => <main data-testid="coach-mark">Coach assigned-session marking</main>);
jest.mock("./AttendanceHistory", () => () => <main data-testid="history">Attendance History workspace</main>);

function RouteLocation() {
  const location = useLocation();
  return <output data-testid="current-url">{location.pathname + location.search + location.hash}</output>;
}

const withGuard = (roles, child) => (
  <ProtectedRoute allowedRoles={roles}>{child}</ProtectedRoute>
);

const renderRoute = (role, initialEntry) => {
  getCurrentUser.mockResolvedValue(role ? { id: "user-1", academy_id: "academy-1", role } : null);
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <RouteLocation />
      <Routes>
        <Route path="/attendance" element={withGuard(
          ["super_admin", "academy_owner", "coach"], <AttendanceWorkspace />
        )} />
        <Route path="/attendance-history" element={withGuard(
          ["super_admin", "academy_owner", "coach"], <LegacyAttendanceRedirect view="history" />
        )} />
        <Route path="/coach-attendance" element={withGuard(
          ["coach"], <LegacyAttendanceRedirect view="mark" />
        )} />
        <Route path="/login" element={<p>Login route</p>} />
      </Routes>
    </MemoryRouter>
  );
  return screen.getByTestId("current-url");
};

beforeEach(() => {
  jest.clearAllMocks();
});

test("AM5 Owner default URL normalizes to Mark while retaining center/batch/hash", async () => {
  const url = renderRoute("academy_owner", "/attendance?centerId=c1&batchId=b1#roster");
  await screen.findByTestId("owner-mark");
  await waitFor(() => expect(url).toHaveTextContent("view=mark"));
  expect(url).toHaveTextContent("centerId=c1");
  expect(url).toHaveTextContent("batchId=b1");
  expect(url).toHaveTextContent("#roster");
  expect(screen.queryByTestId("history")).not.toBeInTheDocument();
});

test("AM5 Coach uses original assigned-session component via canonical Mark", async () => {
  const url = renderRoute("coach", "/attendance?view=mark&scheduleId=s1&date=2026-11-05&batchId=b1");
  await screen.findByTestId("coach-mark");
  expect(url).toHaveTextContent("scheduleId=s1");
  expect(url).toHaveTextContent("date=2026-11-05");
  expect(url).toHaveTextContent("batchId=b1");
  expect(screen.queryByTestId("owner-mark")).not.toBeInTheDocument();
});

test("AM5 Coach legacy dashboard route redirects to Mark preserving deep links", async () => {
  const url = renderRoute("coach", "/coach-attendance?scheduleId=s1&date=2026-11-05&batchId=b1");
  await screen.findByTestId("coach-mark");
  expect(url).toHaveTextContent("/attendance?");
  expect(url).toHaveTextContent("view=mark");
  expect(url).toHaveTextContent("scheduleId=s1");
  expect(url).toHaveTextContent("date=2026-11-05");
  expect(url).toHaveTextContent("batchId=b1");
});

test("AM5 Super Admin without view defaults to History, not Owner marking", async () => {
  const url = renderRoute("super_admin", "/attendance");
  await screen.findByTestId("history");
  expect(url).toHaveTextContent("/attendance?view=history");
  expect(screen.queryByTestId("owner-mark")).not.toBeInTheDocument();
});

test("AM5 Super Admin explicit Mark request is normalized to History", async () => {
  const url = renderRoute("super_admin", "/attendance?view=mark&centerId=unknown");
  await screen.findByTestId("history");
  expect(url).toHaveTextContent("view=history");
  expect(url).toHaveTextContent("centerId=unknown");
  expect(screen.queryByTestId("owner-mark")).not.toBeInTheDocument();
});

test.each(["academy_owner", "coach", "super_admin"])(
  "AM5 %s selects History through canonical view",
  async (role) => {
    const url = renderRoute(role, "/attendance?view=history&date=2026-11-05");
    await screen.findByTestId("history");
    expect(url).toHaveTextContent("/attendance?view=history");
    expect(url).toHaveTextContent("date=2026-11-05");
    expect(screen.queryByTestId("coach-mark")).not.toBeInTheDocument();
  }
);

test("AM5 legacy History route redirects, overriding stale view without dropping query/hash", async () => {
  const url = renderRoute("academy_owner", "/attendance-history?view=mark&startDate=2026-10-01#records");
  await screen.findByTestId("history");
  expect(url).toHaveTextContent("/attendance?");
  expect(url).toHaveTextContent("view=history");
  expect(url).toHaveTextContent("startDate=2026-10-01");
  expect(url).toHaveTextContent("#records");
});

test("AM5 invalid view normalizes to role-appropriate Mark for Coach and Owner", async () => {
  const url = renderRoute("coach", "/attendance?view=invalid&scheduleId=s1");
  await screen.findByTestId("coach-mark");
  expect(url).toHaveTextContent("view=mark");
  expect(url).toHaveTextContent("scheduleId=s1");
});

test.each([
  ["parent", "/attendance?view=history"],
  ["parent", "/attendance-history"],
  ["academy_owner", "/coach-attendance?scheduleId=s1"],
])("AM5 denies %s access to protected route %s", async (role, initial) => {
  const url = renderRoute(role, initial);
  await screen.findByText("Login route");
  expect(url).toHaveTextContent("/login");
  expect(screen.queryByTestId("history")).not.toBeInTheDocument();
});

test("AM5 rejects unauthenticated canonical access", async () => {
  const url = renderRoute(null, "/attendance?view=mark");
  await screen.findByText("Login route");
  expect(url).toHaveTextContent("/login");
});

test("AM5 unknown view with Super Admin stays history-only", async () => {
  const url = renderRoute("super_admin", "/attendance?view=unknown");
  await screen.findByTestId("history");
  expect(url).toHaveTextContent("/attendance?view=history");
  expect(screen.queryByTestId("owner-mark")).not.toBeInTheDocument();
});
