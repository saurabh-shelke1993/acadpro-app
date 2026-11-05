import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import AttendanceWorkspaceTabs from "./AttendanceWorkspaceTabs";

function CurrentLocation() {
  const { pathname, search } = useLocation();
  return <output data-testid="location">{pathname + search}</output>;
}

const renderViews = (path, role) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AttendanceWorkspaceTabs role={role} />
      <CurrentLocation />
    </MemoryRouter>
  );

test("AM5 Academy Owner has two canonical views with Mark selected", () => {
  renderViews("/attendance?view=mark", "academy_owner");
  const nav = screen.getByRole("navigation", { name: "Attendance views" });
  const mark = screen.getByRole("link", { name: "Mark Attendance" });
  const history = screen.getByRole("link", { name: "Attendance History" });

  expect(nav).toContainElement(mark);
  expect(nav).toContainElement(history);
  expect(mark).toHaveAttribute("href", "/attendance?view=mark");
  expect(history).toHaveAttribute("href", "/attendance?view=history");
  expect(mark).toHaveAttribute("aria-current", "page");
  expect(history).not.toHaveAttribute("aria-current", "page");
  expect(mark).toHaveClass("attendance-workspace-view-active");
  expect(screen.getAllByText("Selected")).toHaveLength(1);
});

test("AM5 Owner dashboard center/batch query keeps Mark selected", () => {
  renderViews("/attendance?view=mark&centerId=center-1&batchId=batch-1", "academy_owner");
  expect(screen.getByRole("link", { name: "Mark Attendance" }))
    .toHaveAttribute("aria-current", "page");
});

test("AM5 Coach uses canonical Mark URL while accepting session/date/batch context", () => {
  renderViews("/attendance?view=mark&scheduleId=session-1&date=2026-11-05&batchId=batch-1", "coach");
  expect(screen.getByRole("link", { name: "Mark Attendance" }))
    .toHaveAttribute("href", "/attendance?view=mark");
  expect(screen.getByRole("link", { name: "Mark Attendance" }))
    .toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Attendance History" }))
    .toHaveAttribute("href", "/attendance?view=history");
});

test.each(["academy_owner", "coach", "super_admin"])(
  "AM5 %s selects History on canonical history view",
  (role) => {
    renderViews("/attendance?view=history", role);
    expect(screen.getByRole("link", { name: "Attendance History" }))
      .toHaveAttribute("aria-current", "page");
    expect(screen.getAllByText("Selected")).toHaveLength(1);
  }
);

test("AM5 links switch views on the same /attendance path", () => {
  renderViews("/attendance?view=mark", "academy_owner");
  const mark = screen.getByRole("link", { name: "Mark Attendance" });
  const history = screen.getByRole("link", { name: "Attendance History" });
  fireEvent.click(history);
  expect(screen.getByTestId("location")).toHaveTextContent("/attendance?view=history");
  expect(history).toHaveAttribute("aria-current", "page");
  expect(mark).not.toHaveAttribute("aria-current", "page");
  fireEvent.click(mark);
  expect(screen.getByTestId("location")).toHaveTextContent("/attendance?view=mark");
  expect(mark).toHaveAttribute("aria-current", "page");
});

test("AM5 Super Admin is history-only and never sees a Mark link", () => {
  renderViews("/attendance?view=history", "super_admin");
  expect(screen.queryByRole("link", { name: "Mark Attendance" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Attendance History" }))
    .toHaveAttribute("aria-current", "page");
});

test.each([
  ["/attendance-history", "history"],
  ["/coach-attendance?scheduleId=s1", "mark"],
])("AM5 selector recognizes an old %s path during compatibility navigation", (path, selected) => {
  renderViews(path, "coach");
  expect(screen.getByRole("link", { name: selected === "mark" ? "Mark Attendance" : "Attendance History" }))
    .toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Attendance History" }))
    .toHaveAttribute("href", "/attendance?view=history");
});

test.each(["parent", undefined, "unknown"])(
  "AM5 role %s cannot view Attendance management navigation",
  (role) => {
    renderViews("/attendance?view=history", role);
    expect(screen.queryByRole("navigation", { name: "Attendance views" })).not.toBeInTheDocument();
  }
);
