import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "./Sidebar";

jest.mock("../supabaseClient", () => ({
  supabase: { from: jest.fn() },
}));
jest.mock("../utils/auth", () => ({
  logoutUser: jest.fn(),
}));

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

test.each([
  ["academy_owner", "/attendance", "/attendance"],
  ["coach", "/coach-attendance", "/coach-attendance"],
  ["super_admin", "/attendance-history", "/attendance-history"],
])("%s has exactly one Attendance sidebar entry targeting %s", (role, expectedUrl, route) => {
  renderSidebar(role, route);
  const nav = screen.getByRole("navigation", { name: "Primary navigation" });
  const links = within(nav).getAllByRole("link", { name: "Attendance" });

  expect(links).toHaveLength(1);
  expect(links[0]).toHaveAttribute("href", expectedUrl);
  expect(links[0]).toHaveClass("app-nav-link-active");
  expect(within(nav).queryByRole("link", { name: "Attendance History" }))
    .not.toBeInTheDocument();
});

test.each([
  ["academy_owner"],
  ["coach"],
  ["super_admin"],
])("%s keeps Attendance selected when the existing History route is opened", (role) => {
  renderSidebar(role, "/attendance-history");
  const nav = screen.getByRole("navigation", { name: "Primary navigation" });
  expect(within(nav).getByRole("link", { name: "Attendance" }))
    .toHaveClass("app-nav-link-active");
});

test("Super Admin retains active Attendance highlighting on the legacy marking URL", () => {
  renderSidebar("super_admin", "/attendance");
  expect(screen.getByRole("link", { name: "Attendance" }))
    .toHaveClass("app-nav-link-active");
});

test("Parent has no attendance management sidebar entry", () => {
  renderSidebar("parent", "/parent-portal");
  expect(screen.queryByRole("link", { name: "Attendance" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Attendance History" })).not.toBeInTheDocument();
});
