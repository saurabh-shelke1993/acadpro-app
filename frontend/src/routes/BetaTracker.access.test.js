import { render, screen, waitFor } from "@testing-library/react";
import AppRoutes from "./AppRoutes";
import { getCurrentUser } from "../utils/auth";

// Exercise the real AppRoutes, ProtectedRoute, tracker, Layout and Sidebar.
// Other destinations and external I/O are isolated; no live account is needed.
jest.mock("../utils/auth", () => ({ getCurrentUser: jest.fn(), logoutUser: jest.fn() }));
jest.mock("../supabaseClient", () => ({ supabase: { from: jest.fn() } }));
jest.mock("../pages/Login", () => () => <h1>Login destination</h1>);
jest.mock("../pages/Dashboard", () => () => null);
jest.mock("../pages/Analytics", () => () => null);
jest.mock("../pages/Academy", () => () => null);
jest.mock("../pages/Centers", () => () => null);
jest.mock("../pages/Batches", () => () => null);
jest.mock("../pages/Players", () => () => null);
jest.mock("../pages/Enquiries", () => () => null);
jest.mock("../pages/AttendanceWorkspace", () => ({ __esModule: true, default: () => null, LegacyAttendanceRedirect: () => null }));
jest.mock("../pages/SubscriptionsWorkspace", () => ({ __esModule: true, default: () => null, LegacySubscriptionsRedirect: () => null }));
jest.mock("../pages/PaymentDues", () => () => null);
jest.mock("../pages/PaymentCollections", () => () => null);
jest.mock("../pages/Expenses", () => () => null);
jest.mock("../pages/Coaches", () => () => null);
jest.mock("../pages/CoachBatchMapping", () => () => null);
jest.mock("../pages/CoachDashboard", () => () => null);
jest.mock("../pages/CoachProfile", () => () => null);
jest.mock("../pages/CoachPerformanceAssessments", () => () => null);
jest.mock("../pages/PlayerPerformanceReport", () => () => null);
jest.mock("../pages/ParentPortal", () => () => null);
jest.mock("../pages/ParentFinancialOverview", () => () => null);
jest.mock("../pages/AcademyUpiSettings", () => () => null);
jest.mock("../pages/ParentUpiPaymentReview", () => () => null);

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  window.history.replaceState({}, "", "/beta-tracker");
  window.matchMedia = jest.fn().mockReturnValue({ matches: false });
});

afterEach(() => { localStorage.clear(); });

test("Super Admin can enter the real route directly and remount it on refresh", async () => {
  const user = { id: "fixture", role: "super_admin" };
  getCurrentUser.mockResolvedValue(user);
  localStorage.setItem("acadpro_user", JSON.stringify(user));
  const first = render(<AppRoutes />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading...");
  expect(await screen.findByRole("heading", { name: "Beta Launch Tracker", level: 1 })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Beta Launch Tracker" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute("href", "#main-content");
  first.unmount();
  render(<AppRoutes />);
  expect(await screen.findByRole("heading", { name: "Beta Launch Tracker", level: 1 })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/beta-tracker");
  expect(getCurrentUser).toHaveBeenCalledTimes(2);
});

test.each(["academy_owner", "coach", "parent", "unknown", null, undefined])(
  "denies role %s on direct entry and refresh even with a forged Super Admin sidebar cache", async (role) => {
    getCurrentUser.mockResolvedValue(role === undefined ? null : { id: "fixture", role });
    localStorage.setItem("acadpro_user", JSON.stringify({ role: "super_admin" }));
    for (let attempt = 0; attempt < 2; attempt += 1) {
      window.history.replaceState({}, "", "/beta-tracker");
      const view = render(<AppRoutes />);
      expect(screen.queryByRole("heading", { name: "Beta Launch Tracker" })).not.toBeInTheDocument();
      expect(await screen.findByRole("heading", { name: "Login destination" })).toBeInTheDocument();
      expect(window.location.pathname).toBe("/login");
      expect(screen.queryByRole("link", { name: "Beta Launch Tracker" })).not.toBeInTheDocument();
      view.unmount();
    }
  }
);

test("does not render tracker contents while the existing auth lookup is pending", async () => {
  getCurrentUser.mockImplementation(() => new Promise(() => {}));
  render(<AppRoutes />);
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Loading..."));
  expect(screen.queryByRole("heading", { name: "Beta Launch Tracker" })).not.toBeInTheDocument();
});
