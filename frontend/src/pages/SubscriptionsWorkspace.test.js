import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";
import { getCurrentUser } from "../utils/auth";
import SubscriptionsWorkspace, { LegacySubscriptionsRedirect } from "./SubscriptionsWorkspace";

jest.mock("../utils/auth", () => ({ getCurrentUser: jest.fn() }));
jest.mock("./PlayerSubscriptions", () => () => <main data-testid="subscriptions-players">Original player assignment view</main>);
jest.mock("./SubscriptionPlans", () => () => <main data-testid="subscriptions-plans">Original plan management view</main>);

function Url() {
  const location = useLocation();
  return <output data-testid="route-url">{location.pathname + location.search + location.hash}</output>;
}
function renderRoute(role, start) {
  getCurrentUser.mockResolvedValue(role ? { id: "user-1", role, academy_id: "academy-1" } : null);
  render(
    <MemoryRouter initialEntries={[start]}>
      <Url />
      <Routes>
        <Route path="/subscriptions" element={
          <ProtectedRoute allowedRoles={["super_admin", "academy_owner"]}>
            <SubscriptionsWorkspace />
          </ProtectedRoute>
        } />
        <Route path="/subscription-plans" element={
          <ProtectedRoute allowedRoles={["super_admin", "academy_owner"]}>
            <LegacySubscriptionsRedirect view="plans" />
          </ProtectedRoute>
        } />
        <Route path="/player-subscriptions" element={
          <ProtectedRoute allowedRoles={["super_admin", "academy_owner"]}>
            <LegacySubscriptionsRedirect view="players" />
          </ProtectedRoute>
        } />
        <Route path="/login" element={<p>Login route</p>} />
      </Routes>
    </MemoryRouter>
  );
  return screen.getByTestId("route-url");
}
beforeEach(() => { jest.clearAllMocks(); });

test.each(["academy_owner", "super_admin"])(
  "SM3 %s default Subscriptions route opens original Player Subscriptions component", async (role) => {
    const url = renderRoute(role, "/subscriptions");
    await screen.findByTestId("subscriptions-players");
    await waitFor(() => expect(url).toHaveTextContent("/subscriptions?view=players"));
    expect(screen.queryByTestId("subscriptions-plans")).not.toBeInTheDocument();
  }
);
test.each(["academy_owner", "super_admin"])(
  "SM3 %s can directly open original plan-management component", async (role) => {
    const url = renderRoute(role, "/subscriptions?view=plans");
    await screen.findByTestId("subscriptions-plans");
    expect(url).toHaveTextContent("/subscriptions?view=plans");
    expect(screen.queryByTestId("subscriptions-players")).not.toBeInTheDocument();
  }
);
test.each([
  ["/player-subscriptions?centerId=c1#assign", "view=players", "subscriptions-players"],
  ["/subscription-plans?academyId=a1#plans", "view=plans", "subscriptions-plans"],
])("SM3 legacy URL %s preserves extra search/hash parameters", async (start, view, component) => {
  const url = renderRoute("academy_owner", start);
  await screen.findByTestId(component);
  expect(url).toHaveTextContent("/subscriptions?");
  expect(url).toHaveTextContent(view);
  expect(url).toHaveTextContent("#");
  expect(url).toHaveTextContent(start.includes("centerId") ? "centerId=c1" : "academyId=a1");
});
test("SM3 unsupported view safely normalizes to Player Subscriptions", async () => {
  const url = renderRoute("academy_owner", "/subscriptions?view=other&batchId=b1#detail");
  await screen.findByTestId("subscriptions-players");
  expect(url).toHaveTextContent("view=players");
  expect(url).toHaveTextContent("batchId=b1");
  expect(url).toHaveTextContent("#detail");
});
test.each([
  ["coach", "/subscriptions?view=plans"],
  ["parent", "/subscriptions?view=players"],
  ["coach", "/player-subscriptions"],
  ["parent", "/subscription-plans"],
  [null, "/subscriptions?view=plans"],
])("SM3 denies role %s access to %s", async (role, start) => {
  const url = renderRoute(role, start);
  await screen.findByText("Login route");
  expect(url).toHaveTextContent("/login");
  expect(screen.queryByTestId("subscriptions-players")).not.toBeInTheDocument();
  expect(screen.queryByTestId("subscriptions-plans")).not.toBeInTheDocument();
});
