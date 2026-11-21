import { configure, fireEvent, render, screen } from "@testing-library/react";
import AppRoutes from "./AppRoutes";
import { getCurrentUser } from "../utils/auth";
import { supabase } from "../supabaseClient";
import { getAcademyOwnerDashboardData, getDashboardSummary, getSuperAdminDashboardData } from "../services/dashboardService";

// Real routes, guard, Dashboard, preview, Layout and Sidebar; mocked external I/O.
// These tests do not authenticate a real browser or prove server-side RLS.
// The real layout/preview render and refresh need headroom on Windows CI.
configure({ asyncUtilTimeout: 5000 });
jest.setTimeout(20000);
jest.mock("../utils/auth", () => ({
  ...jest.requireActual("../utils/roles"), getCurrentUser: jest.fn(), logoutUser: jest.fn()
}));
jest.mock("../supabaseClient", () => ({
  supabase: { from: jest.fn(), auth: { onAuthStateChange: jest.fn() } }
}));
jest.mock("../services/dashboardService", () => ({
  getAcademyOwnerDashboardData: jest.fn(), getDashboardSummary: jest.fn(), getSuperAdminDashboardData: jest.fn()
}));
jest.mock("../components/DashboardCharts", () => () => null);
jest.mock("../components/Dashboard/AcademyOwnerDashboard", () => () => <h1>Existing Owner dashboard</h1>);
jest.mock("../components/Dashboard/SuperAdminDashboard", () => () => <h1>Existing Super Admin dashboard</h1>);
jest.mock("../pages/Login", () => () => <h1>Login destination</h1>);
jest.mock("../pages/Analytics", () => () => null);
jest.mock("../pages/Academy", () => () => null);
jest.mock("../pages/Centers", () => () => null);
jest.mock("../pages/Batches", () => () => null);
jest.mock("../pages/Players", () => () => null);
jest.mock("../pages/Enquiries", () => () => null);
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
jest.mock("../pages/AttendanceWorkspace", () => ({
  __esModule: true, default: () => null, LegacyAttendanceRedirect: () => null
}));
jest.mock("../pages/SubscriptionsWorkspace", () => ({
  __esModule: true, default: () => null, LegacySubscriptionsRedirect: () => null
}));

const owner = { id: "owner-a", role: "academy_owner", academy_id: "academy-a" };
let errorLog;
beforeEach(() => {
  jest.clearAllMocks();
  // CRA resets mock implementations before each test, including module factories.
  supabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  const academyQuery = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
  };
  supabase.from.mockReturnValue(academyQuery);
  errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  localStorage.clear();
  // Forged display cache must never authorize the route.
  localStorage.setItem("acadpro_user", JSON.stringify(owner));
  window.history.replaceState({}, "", "/beta-owner-preview");
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn()
  });
  getCurrentUser.mockReset().mockResolvedValue(owner);
  getAcademyOwnerDashboardData.mockReset().mockResolvedValue({
    academyName: "Fixture Academy", totals: { players: 0, centers: 0, batches: 0 },
    centers: [], todaySessions: [], attendanceByBatch: [],
    financial: { collectionsThisMonth: 0, totalBilledThisMonth: 0, collectionRate: 0 },
    enquirySummary: { total: 0, groups: [] }
  });
  getSuperAdminDashboardData.mockReset().mockResolvedValue({});
  getDashboardSummary.mockReset();
});
afterEach(() => { errorLog.mockRestore(); localStorage.clear(); });

const expectNoFetch = () => {
  expect(getAcademyOwnerDashboardData).not.toHaveBeenCalled();
  expect(getSuperAdminDashboardData).not.toHaveBeenCalled();
  expect(getDashboardSummary).not.toHaveBeenCalled();
};

test("Owner directly enters and refreshes the real preview route with two independent profile checks", async () => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const view = render(<AppRoutes />);
    expect(await screen.findByRole("heading", { name: "Academy overview", level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Fixture Academy/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Financial snapshot" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute("href", "#main-content");
    expect(screen.queryByRole("link", { name: /owner preview/i })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/beta-owner-preview");
    view.unmount();
  }
  expect(getCurrentUser).toHaveBeenCalledTimes(4);
  expect(getAcademyOwnerDashboardData).toHaveBeenCalledTimes(2);
  expect(getAcademyOwnerDashboardData).toHaveBeenCalledWith(owner);
  expect(getSuperAdminDashboardData).not.toHaveBeenCalled();
  expect(getDashboardSummary).not.toHaveBeenCalled();
});

test.each(["super_admin", "coach", "parent", "unknown", null])(
  "guard denies %s on direct entry and refresh despite Owner cache", async (role) => {
    getCurrentUser.mockResolvedValue(role === null ? null : { ...owner, role });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      window.history.replaceState({}, "", "/beta-owner-preview");
      const view = render(<AppRoutes />);
      expect(await screen.findByRole("heading", { name: "Login destination" })).toBeInTheDocument();
      expect(window.location.pathname).toBe("/login");
      expect(screen.queryByRole("heading", { name: "Academy overview" })).not.toBeInTheDocument();
      view.unmount();
    }
    expect(getCurrentUser).toHaveBeenCalledTimes(2);
    expectNoFetch();
  }
);

test.each(["super_admin", "coach", "parent", null])(
  "second lookup denies role changed to %s after the Owner route guard", async (role) => {
    getCurrentUser.mockResolvedValueOnce(owner).mockResolvedValue(role === null ? null : { ...owner, role });
    render(<AppRoutes />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load dashboard data");
    expect(screen.queryByRole("heading", { name: "Academy overview" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(getCurrentUser).toHaveBeenCalledTimes(2);
    expectNoFetch();
  }
);

test.each([null, undefined, "", " ", 42])("second lookup denies missing/invalid academy %j", async (academy_id) => {
  getCurrentUser.mockResolvedValueOnce(owner).mockResolvedValue({ ...owner, academy_id });
  render(<AppRoutes />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load dashboard data");
  expectNoFetch();
});

test("second lookup failure uses safe page error and no dashboard fallback", async () => {
  getCurrentUser.mockResolvedValueOnce(owner).mockRejectedValueOnce(new Error("Profile read failed"));
  render(<AppRoutes />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load dashboard data");
  expectNoFetch();
});

test("pending route guard never mounts the preview or fetches data", () => {
  getCurrentUser.mockImplementation(() => new Promise(() => {}));
  render(<AppRoutes />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading...");
  expect(screen.queryByRole("heading", { name: "Academy overview" })).not.toBeInTheDocument();
  expectNoFetch();
});

test.each(["academy_owner", "super_admin"])("ordinary dashboard route still renders existing %s destination", async (role) => {
  window.history.replaceState({}, "", "/dashboard");
  getCurrentUser.mockResolvedValue({ ...owner, role });
  render(<AppRoutes />);
  expect(await screen.findByRole("heading", {
    name: role === "academy_owner" ? "Existing Owner dashboard" : "Existing Super Admin dashboard"
  })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Academy overview" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Return to dashboard" })).not.toBeInTheDocument();
  expect(getCurrentUser).toHaveBeenCalledTimes(2);
  expect(role === "academy_owner" ? getSuperAdminDashboardData : getAcademyOwnerDashboardData).not.toHaveBeenCalled();
});

test("return link navigates to the existing Owner dashboard", async () => {
  render(<AppRoutes />);
  expect(await screen.findByRole("heading", { name: "Academy overview" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Return to dashboard" }));
  expect(await screen.findByRole("heading", { name: "Existing Owner dashboard" })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/dashboard");
});
