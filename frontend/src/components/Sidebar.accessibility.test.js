import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Sidebar from "./Sidebar";

const renderSidebar = (role) => {
  localStorage.setItem(
    "acadpro_user",
    JSON.stringify({
      full_name: "Test User",
      role,
    })
  );

  return render(
    <BrowserRouter>
      <Sidebar />
    </BrowserRouter>
  );
};

afterEach(() => {
  localStorage.clear();
});

describe("Sidebar cross-role accessibility and navigation visibility", () => {
  test("Super Admin exposes platform and management navigation", () => {
    renderSidebar("super_admin");

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Academies" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Payment Collections" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Attendance History" })).toBeInTheDocument();
  });

  test("Academy Owner exposes academy-scoped management without the Super Admin academy page", () => {
    renderSidebar("academy_owner");

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Centers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Payment Dues" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Academies" })).not.toBeInTheDocument();
  });

  test("Coach exposes assigned-scope navigation and no financial management links", () => {
    renderSidebar("coach");

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/coach-dashboard");
    expect(screen.getByRole("link", { name: "Attendance" })).toHaveAttribute("href", "/coach-attendance");
    expect(screen.getByRole("link", { name: "Players" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Payment Dues" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Payment Collections" })).not.toBeInTheDocument();
  });

  test("Parent exposes family navigation without management controls", () => {
    renderSidebar("parent");

    expect(screen.getByRole("link", { name: "Parent Portal" })).toHaveAttribute("href", "/parent-portal");
    expect(screen.getByRole("link", { name: "Performance Report" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Payment Collections" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Players" })).not.toBeInTheDocument();
  });

  test("navigation landmarks and logout remain keyboard-accessible for every role", () => {
    for (const role of ["super_admin", "academy_owner", "coach", "parent"]) {
      const { unmount } = renderSidebar(role);

      expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();

      unmount();
      localStorage.clear();
    }
  });
});
