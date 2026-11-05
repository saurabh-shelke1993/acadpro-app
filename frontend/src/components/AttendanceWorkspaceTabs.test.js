import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AttendanceWorkspaceTabs from "./AttendanceWorkspaceTabs";

const renderViews = (path, role) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AttendanceWorkspaceTabs role={role} />
    </MemoryRouter>
  );

test("Academy Owner sees two views with Mark Attendance selected at the existing route", () => {
  renderViews("/attendance", "academy_owner");
  const nav = screen.getByRole("navigation", { name: "Attendance views" });
  const mark = screen.getByRole("link", { name: "Mark Attendance" });
  const history = screen.getByRole("link", { name: "Attendance History" });

  expect(nav).toContainElement(mark);
  expect(nav).toContainElement(history);
  expect(mark).toHaveAttribute("href", "/attendance");
  expect(history).toHaveAttribute("href", "/attendance-history");
  expect(mark).toHaveAttribute("aria-current", "page");
  expect(history).not.toHaveAttribute("aria-current", "page");
  expect(mark).toHaveClass("attendance-workspace-view-active");
  expect(screen.getAllByText("Selected")).toHaveLength(1);
});

test("Owner dashboard center/batch deep-link query retains Mark selected", () => {
  renderViews("/attendance?centerId=center-1&batchId=batch-1", "academy_owner");
  expect(screen.getByRole("link", { name: "Mark Attendance" }))
    .toHaveAttribute("aria-current", "page");
});

test("Coach uses the existing Coach Attendance route and retains session deep links", () => {
  renderViews("/coach-attendance?scheduleId=session-1&date=2026-11-05&batchId=batch-1", "coach");
  const mark = screen.getByRole("link", { name: "Mark Attendance" });
  expect(mark).toHaveAttribute("href", "/coach-attendance");
  expect(mark).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Attendance History" }))
    .toHaveAttribute("href", "/attendance-history");
  expect(screen.getAllByText("Selected")).toHaveLength(1);
});

test.each(["academy_owner", "coach"])(
  "%s has History selected on the legacy history route",
  (role) => {
    renderViews("/attendance-history", role);
    expect(screen.getByRole("link", { name: "Attendance History" }))
      .toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Mark Attendance" }))
      .not.toHaveAttribute("aria-current", "page");
  }
);

test("selection links switch between existing Owner routes without new queries", () => {
  renderViews("/attendance", "academy_owner");
  const mark = screen.getByRole("link", { name: "Mark Attendance" });
  const history = screen.getByRole("link", { name: "Attendance History" });
  fireEvent.click(history);
  expect(history).toHaveAttribute("aria-current", "page");
  expect(mark).not.toHaveAttribute("aria-current", "page");
  fireEvent.click(mark);
  expect(mark).toHaveAttribute("aria-current", "page");
  expect(screen.getAllByText("Selected")).toHaveLength(1);
});

test("Super Admin can only open Attendance History, never Mark", () => {
  renderViews("/attendance-history", "super_admin");
  const history = screen.getByRole("link", { name: "Attendance History" });
  expect(history).toHaveAttribute("aria-current", "page");
  expect(screen.queryByRole("link", { name: "Mark Attendance" })).not.toBeInTheDocument();
  expect(screen.getAllByText("Selected")).toHaveLength(1);
});

test.each(["parent", undefined, "unknown"])(
  "role %s cannot see attendance management navigation",
  (role) => {
    renderViews("/attendance-history", role);
    expect(screen.queryByRole("navigation", { name: "Attendance views" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Attendance History" })).not.toBeInTheDocument();
  }
);
