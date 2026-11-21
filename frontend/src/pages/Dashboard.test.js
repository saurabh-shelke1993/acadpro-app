import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "./Dashboard";
import { getCurrentUser } from "../utils/auth";
import { supabase } from "../supabaseClient";
import { getAcademyOwnerDashboardData, getDashboardSummary, getSuperAdminDashboardData } from "../services/dashboardService";

jest.mock("../utils/auth", () => ({ ...jest.requireActual("../utils/roles"), getCurrentUser: jest.fn() }));
jest.mock("../supabaseClient", () => ({ supabase: { auth: { onAuthStateChange: jest.fn() } } }));
jest.mock("../services/dashboardService", () => ({
  getAcademyOwnerDashboardData: jest.fn(), getDashboardSummary: jest.fn(), getSuperAdminDashboardData: jest.fn()
}));
jest.mock("../components/Layout", () => ({ children }) => <main>{children}</main>);
jest.mock("../components/DashboardCharts", () => () => null);
jest.mock("../components/Dashboard/AcademyOwnerDashboard", () => ({ data, onRefresh }) =>
  <><h1>Existing Owner dashboard</h1><p>{data.marker}</p><button onClick={onRefresh}>Refresh owner</button></>);
jest.mock("../components/Dashboard/SuperAdminDashboard", () => ({ data }) =>
  <><h1>Existing Super Admin dashboard</h1><p>{data.marker}</p></>);
jest.mock("../components/Dashboard/AcademyOwnerDashboardPreview", () => ({ data }) =>
  <><h1>Owner preview</h1><p>{data.marker}</p></>);

const owner = { id: "owner-a", role: "academy_owner", academy_id: "academy-a" };
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const mount = (props = { ownerPreview: true }) => render(<MemoryRouter><Dashboard {...props} /></MemoryRouter>);
let authChanged;
let unsubscribe;
let errorLog;

beforeEach(() => {
  jest.resetAllMocks();
  errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  unsubscribe = jest.fn();
  supabase.auth.onAuthStateChange.mockImplementation((callback) => {
    authChanged = callback;
    return { data: { subscription: { unsubscribe } } };
  });
  getCurrentUser.mockResolvedValue(owner);
  getAcademyOwnerDashboardData.mockResolvedValue({ marker: "Academy A data" });
  getSuperAdminDashboardData.mockResolvedValue({ marker: "Platform data" });
});
afterEach(() => errorLog.mockRestore());

const expectNoFallback = () => {
  expect(getSuperAdminDashboardData).not.toHaveBeenCalled();
  expect(getDashboardSummary).not.toHaveBeenCalled();
};

test("preview waits for profile and data, then passes Owner data and exposes return/refresh controls", async () => {
  const lookup = deferred();
  const data = deferred();
  getCurrentUser.mockReturnValue(lookup.promise);
  getAcademyOwnerDashboardData.mockReturnValue(data.promise);
  mount();
  expect(screen.getByRole("status")).toHaveTextContent("Loading your dashboard");
  expect(screen.getByRole("link", { name: "Return to dashboard" })).toHaveAttribute("href", "/dashboard");
  expect(screen.getByRole("button", { name: "Refresh preview" })).toBeDisabled();
  expect(getAcademyOwnerDashboardData).not.toHaveBeenCalled();
  await act(async () => lookup.resolve(owner));
  expect(getAcademyOwnerDashboardData).toHaveBeenCalledWith(owner);
  expect(screen.queryByRole("heading", { name: "Owner preview" })).not.toBeInTheDocument();
  await act(async () => data.resolve({ marker: "Academy A data" }));
  expect(screen.getByRole("heading", { name: "Owner preview" })).toBeInTheDocument();
  expect(screen.getByText("Academy A data")).toBeInTheDocument();
  expectNoFallback();
});

test.each([null, { ...owner, role: "super_admin" }, { ...owner, role: "coach" },
  { ...owner, role: "parent" }, { ...owner, role: "unknown" },
  ...[undefined, null, "", "   ", 42, {}].map((academy_id) => ({ ...owner, academy_id }))])(
  "preview denies invalid second profile %j without any dashboard fetch", async (profile) => {
    getCurrentUser.mockResolvedValue(profile);
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load dashboard data");
    expect(getAcademyOwnerDashboardData).not.toHaveBeenCalled();
    expectNoFallback();
  }
);

test("failed lookup is a safe error with no dashboard fetch", async () => {
  getCurrentUser.mockRejectedValue(new Error("Lookup failed"));
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load dashboard data");
  expect(getAcademyOwnerDashboardData).not.toHaveBeenCalled();
  expectNoFallback();
});

test("service error can be retried only after another Owner validation", async () => {
  getAcademyOwnerDashboardData.mockRejectedValueOnce(new Error("Read failed"));
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load dashboard data");
  fireEvent.click(screen.getByRole("button", { name: "Refresh preview" }));
  expect(await screen.findByRole("heading", { name: "Owner preview" })).toBeInTheDocument();
  expect(getCurrentUser).toHaveBeenCalledTimes(2);
  expect(getAcademyOwnerDashboardData).toHaveBeenCalledTimes(2);
  expectNoFallback();
});

test("refresh removes previous data and denies a changed role without fallback", async () => {
  mount();
  expect(await screen.findByText("Academy A data")).toBeInTheDocument();
  getCurrentUser.mockResolvedValue({ ...owner, role: "super_admin" });
  fireEvent.click(screen.getByRole("button", { name: "Refresh preview" }));
  expect(screen.queryByText("Academy A data")).not.toBeInTheDocument();
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(getAcademyOwnerDashboardData).toHaveBeenCalledTimes(1);
  expectNoFallback();
});

test("unmount during profile lookup prevents even starting the data request", async () => {
  const lookup = deferred();
  getCurrentUser.mockReturnValue(lookup.promise);
  const view = mount();
  view.unmount();
  await act(async () => lookup.resolve(owner));
  expect(getAcademyOwnerDashboardData).not.toHaveBeenCalled();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expectNoFallback();
});

test.each(["resolve", "reject"])("unmounted data request may %s without publishing or logging stale results", async (settle) => {
  const data = deferred();
  getAcademyOwnerDashboardData.mockReturnValue(data.promise);
  const view = mount();
  await waitFor(() => expect(getAcademyOwnerDashboardData).toHaveBeenCalledTimes(1));
  view.unmount();
  await act(async () => data[settle](settle === "resolve" ? { marker: "Stale data" } : new Error("Stale error")));
  expect(screen.queryByText("Stale data")).not.toBeInTheDocument();
  expect(errorLog).not.toHaveBeenCalled();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

test("auth change during lookup blocks the stale profile before a service can be called", async () => {
  const lookup = deferred();
  getCurrentUser.mockReturnValueOnce(lookup.promise).mockResolvedValue(null);
  mount();
  act(() => authChanged("SIGNED_OUT"));
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  await act(async () => lookup.resolve(owner));
  expect(getAcademyOwnerDashboardData).not.toHaveBeenCalled();
  expectNoFallback();
});

test("auth change denies a changed role and ignores earlier successful data", async () => {
  const data = deferred();
  getAcademyOwnerDashboardData.mockReturnValue(data.promise);
  mount();
  await waitFor(() => expect(getAcademyOwnerDashboardData).toHaveBeenCalledTimes(1));
  getCurrentUser.mockResolvedValue({ ...owner, role: "parent" });
  act(() => authChanged("USER_UPDATED"));
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  await act(async () => data.resolve({ marker: "Stale data" }));
  expect(screen.queryByText("Stale data")).not.toBeInTheDocument();
  expect(getAcademyOwnerDashboardData).toHaveBeenCalledTimes(1);
  expectNoFallback();
});

test("switching Owners never lets an out-of-order academy response replace current data", async () => {
  const oldData = deferred();
  const newData = deferred();
  const otherOwner = { ...owner, id: "owner-b", academy_id: "academy-b" };
  getAcademyOwnerDashboardData.mockReturnValueOnce(oldData.promise).mockReturnValueOnce(newData.promise);
  mount();
  await waitFor(() => expect(getAcademyOwnerDashboardData).toHaveBeenCalledTimes(1));
  getCurrentUser.mockResolvedValue(otherOwner);
  act(() => authChanged("SIGNED_IN"));
  await waitFor(() => expect(getAcademyOwnerDashboardData).toHaveBeenLastCalledWith(otherOwner));
  await act(async () => newData.resolve({ marker: "Academy B data" }));
  expect(screen.getByText("Academy B data")).toBeInTheDocument();
  await act(async () => oldData.resolve({ marker: "Academy A data" }));
  expect(screen.queryByText("Academy A data")).not.toBeInTheDocument();
  expect(screen.getByText("Academy B data")).toBeInTheDocument();
});

test("sign-out clears already displayed data while the new lookup is pending", async () => {
  mount();
  expect(await screen.findByText("Academy A data")).toBeInTheDocument();
  const lookup = deferred();
  getCurrentUser.mockReturnValue(lookup.promise);
  act(() => authChanged("SIGNED_OUT"));
  expect(screen.queryByText("Academy A data")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toBeInTheDocument();
  await act(async () => lookup.resolve(null));
  expect(screen.getByRole("alert")).toBeInTheDocument();
});

test("initial-session notification does not duplicate the profile or Owner read", async () => {
  mount();
  expect(await screen.findByText("Academy A data")).toBeInTheDocument();
  act(() => authChanged("INITIAL_SESSION"));
  expect(getCurrentUser).toHaveBeenCalledTimes(1);
  expect(getAcademyOwnerDashboardData).toHaveBeenCalledTimes(1);
});

test.each(["academy_owner", "super_admin"])("ordinary /dashboard still renders existing %s component without a preview subscription", async (role) => {
  getCurrentUser.mockResolvedValue({ ...owner, role });
  mount({});
  expect(await screen.findByRole("heading", { name: role === "academy_owner" ? "Existing Owner dashboard" : "Existing Super Admin dashboard" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Owner preview" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Return to dashboard" })).not.toBeInTheDocument();
  expect(supabase.auth.onAuthStateChange).not.toHaveBeenCalled();
  expect(role === "academy_owner" ? getAcademyOwnerDashboardData : getSuperAdminDashboardData).toHaveBeenCalledWith({ ...owner, role });
});

test("changing the same mounted Dashboard to preview hides ordinary data until revalidated", async () => {
  getCurrentUser.mockResolvedValue({ ...owner, role: "super_admin" });
  const view = mount({});
  expect(await screen.findByText("Platform data")).toBeInTheDocument();
  const lookup = deferred();
  getCurrentUser.mockReturnValue(lookup.promise);
  view.rerender(<MemoryRouter><Dashboard ownerPreview /></MemoryRouter>);
  expect(screen.queryByText("Platform data")).not.toBeInTheDocument();
  await act(async () => lookup.resolve({ ...owner, role: "super_admin" }));
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(getSuperAdminDashboardData).toHaveBeenCalledTimes(1);
  expect(getAcademyOwnerDashboardData).not.toHaveBeenCalled();
});
