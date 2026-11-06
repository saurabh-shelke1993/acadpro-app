import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "./Sidebar";

jest.mock("../supabaseClient", () => ({ supabase: { from: jest.fn() } }));
jest.mock("../utils/auth", () => ({ logoutUser: jest.fn() }));

const renderSidebar = (role, route) => {
  localStorage.setItem("acadpro_user", JSON.stringify({ id: "test-user", role, academy_id: null }));
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Sidebar />
    </MemoryRouter>
  );
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

test.each([
  ["academy_owner", "/attendance?view=mark"],
  ["coach", "/attendance?view=mark"],
  ["super_admin", "/attendance?view=history"],
])("AM5 %s has exactly one canonical Attendance sidebar entry", (role, expectedUrl) => {
  renderSidebar(role, expectedUrl);
  const nav = screen.getByRole("navigation", { name: "Primary navigation" });
  const links = within(nav).getAllByRole("link", { name: "Attendance" });
  expect(links).toHaveLength(1);
  expect(links[0]).toHaveAttribute("href", expectedUrl);
  expect(links[0]).toHaveClass("app-nav-link-active");
  expect(within(nav).queryByRole("link", { name: "Attendance History" }))
    .not.toBeInTheDocument();
});

test.each(["academy_owner", "coach", "super_admin"])(
  "AM5 %s keeps Attendance selected on canonical History",
  (role) => {
    renderSidebar(role, "/attendance?view=history");
    expect(screen.getByRole("link", { name: "Attendance" }))
      .toHaveClass("app-nav-link-active");
  }
);

test.each([
  ["academy_owner", "/attendance-history"],
  ["coach", "/coach-attendance"],
  ["coach", "/attendance-history"],
  ["super_admin", "/attendance-history"],
])("AM5 %s keeps Attendance highlighted on legacy route %s", (role, oldRoute) => {
  renderSidebar(role, oldRoute);
  expect(screen.getByRole("link", { name: "Attendance" }))
    .toHaveClass("app-nav-link-active");
});

test("AM5 Super Admin never gets a Mark destination", () => {
  renderSidebar("super_admin", "/attendance?view=history");
  expect(screen.getByRole("link", { name: "Attendance" }))
    .toHaveAttribute("href", "/attendance?view=history");
});

test("AM5 Parent has no Attendance management sidebar link", () => {
  renderSidebar("parent", "/parent-portal");
  expect(screen.queryByRole("link", { name: "Attendance" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Attendance History" })).not.toBeInTheDocument();
});

test.each(["academy_owner", "super_admin"])(
  "SM3 %s has exactly one Subscriptions management sidebar link", (role) => {
    renderSidebar(role, "/subscriptions?view=players");
    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    const links = within(nav).getAllByRole("link", { name: "Subscriptions" });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/subscriptions?view=players");
    expect(links[0]).toHaveClass("app-nav-link-active");
    expect(within(nav).queryByRole("link", { name: "Subscription Plans" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Player Subscriptions" })).not.toBeInTheDocument();
  }
);
test.each([
  ["academy_owner", "/subscriptions?view=plans"],
  ["super_admin", "/subscription-plans"],
  ["academy_owner", "/player-subscriptions"],
])("SM3 %s keeps Subscriptions highlighted on %s", (role, route) => {
  renderSidebar(role, route);
  expect(screen.getByRole("link", { name: "Subscriptions" }))
    .toHaveClass("app-nav-link-active");
});
test.each(["coach", "parent"])("SM3 %s has no Subscriptions management link", (role) => {
  renderSidebar(role, role === "parent" ? "/parent-portal" : "/coach-dashboard");
  expect(screen.queryByRole("link", { name: "Subscriptions" })).not.toBeInTheDocument();
});
