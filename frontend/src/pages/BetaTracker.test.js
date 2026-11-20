import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BetaTracker, { BetaTaskDetails } from "./BetaTracker";

jest.mock("../components/Layout", () => ({ children }) => <main>{children}</main>);

const metric = (name) => screen.getByText(name, { selector: "dt" }).nextElementSibling;

test("shows unfiltered evidence-based summary and grouped 5/7/7 roadmap records", () => {
  render(<BetaTracker />);
  expect(screen.getByRole("heading", { level: 1, name: "Beta Launch Tracker" })).toBeInTheDocument();
  expect(metric("Total development tasks")).toHaveTextContent("19");
  expect(metric("Approved completed tasks")).toHaveTextContent("1");
  expect(metric("Tasks in progress")).toHaveTextContent("1");
  expect(metric("Blocked tasks")).toHaveTextContent("0");
  expect(metric("Current active milestone")).toHaveTextContent("BETA-02");
  const groups = [
    ["Phase 1 — Foundation & Consolidation", 5],
    ["Phase 2 — Product Completion", 7],
    ["Phase 3 — Production & Beta Launch", 7],
  ];
  groups.forEach(([name, count]) => {
    expect(screen.getByRole("region", { name }).querySelectorAll("details")).toHaveLength(count);
  });
  expect(screen.getAllByRole("progressbar")).toHaveLength(3);
  expect(screen.getAllByRole("progressbar").map((p) => p.getAttribute("value"))).toEqual(["1", "0", "0"]);
  expect(screen.getByText("Production NO-GO")).toBeInTheDocument();
  expect(screen.getByText(/No release date approved/)).toBeInTheDocument();
});

test("combines phase/status filters, handles empty results and keeps global summary stable", () => {
  render(<BetaTracker />);
  const phase = screen.getByRole("combobox", { name: "Phase" });
  const status = screen.getByRole("combobox", { name: "Status" });
  userEvent.selectOptions(phase, "phase-2");
  expect(screen.getByRole("status")).toHaveTextContent("Showing 7 of 19 tasks");
  expect(screen.queryByText("BETA-01", { selector: ".beta-tracker-task-id" })).not.toBeInTheDocument();
  userEvent.selectOptions(status, "IN_PROGRESS");
  expect(screen.getByText("No tasks match these filters.")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Showing 0 of 19 tasks");
  userEvent.selectOptions(phase, "ALL");
  expect(screen.getByRole("status")).toHaveTextContent("Showing 1 of 19 tasks");
  expect(screen.getByText("BETA-02", { selector: ".beta-tracker-task-id" })).toBeInTheDocument();
  userEvent.selectOptions(status, "COMPLETE");
  expect(screen.getByRole("status")).toHaveTextContent("Showing 1 of 19 tasks");
  expect(screen.getByText("BETA-01", { selector: ".beta-tracker-task-id" })).toBeInTheDocument();
  userEvent.selectOptions(status, "BLOCKED");
  expect(screen.getByRole("status")).toHaveTextContent("Showing 0 of 19 tasks");
  userEvent.selectOptions(status, "PLANNED");
  expect(screen.getByRole("status")).toHaveTextContent("Showing 17 of 19 tasks");
  userEvent.selectOptions(status, "ALL");
  expect(screen.getByRole("status")).toHaveTextContent("Showing 19 of 19 tasks");
  expect(metric("Approved completed tasks")).toHaveTextContent("1");
  expect(metric("Total development tasks")).toHaveTextContent("19");
});

test("expands and collapses native details with all required evidence fields", () => {
  render(<BetaTracker />);
  const details = screen.getByText("BETA-01", { selector: ".beta-tracker-task-id" }).closest("details");
  const summary = details.querySelector("summary");
  expect(details).not.toHaveAttribute("open");
  userEvent.click(summary);
  expect(details).toHaveAttribute("open");
  ["Implementation status", "Automated-test status", "Manual acceptance", "Deployment verification",
    "Branch / commit reference", "Blocker or dependency", "Next action", "Last verified date"].forEach((label) => {
    expect(within(details).getByText(label, { selector: "dt" })).toBeVisible();
  });
  expect(within(details).getByText(/43 remote GitHub branches/)).toBeVisible();
  expect(within(details).getByText("Not run")).toBeVisible();
  expect(within(details).getByText("Approved", { selector: "strong" })).toBeVisible();
  expect(within(details).getByText("Not deployed")).toBeVisible();
  expect(within(details).getByText("2026-11-20", { selector: "time" })).toHaveAttribute("dateTime", "2026-11-20");
  userEvent.click(summary);
  expect(details).not.toHaveAttribute("open");
});

test("labels keyboard-focusable filters and names all three progress indicators", () => {
  render(<BetaTracker />);
  userEvent.tab();
  expect(screen.getByRole("combobox", { name: "Phase" })).toHaveFocus();
  userEvent.tab();
  expect(screen.getByRole("combobox", { name: "Status" })).toHaveFocus();
  // user-event v13's simulated tab list omits native summary elements.
  const summary = screen.getByText("BETA-01", { selector: ".beta-tracker-task-id" }).closest("summary");
  summary.focus();
  expect(summary).toHaveFocus();
  [1, 2, 3].forEach((number) => expect(screen.getByRole("progressbar", {
    name: `Phase ${number} approved completion`,
  })).toBeInTheDocument());
});

test.each([
  {},
  { branchReference: "", blocker: " ", nextAction: null, notes: [], lastVerifiedOn: "", implementation: {}, automatedTests: {}, acceptance: {}, deployment: {} },
])("renders absent/empty optional task fields without inferring success: %j", (fields) => {
  render(<BetaTaskDetails task={{ id: "FIXTURE", name: "Missing evidence", ...fields }} />);
  expect(screen.getAllByText("Not recorded")).toHaveLength(7);
  expect(screen.getAllByText("No evidence recorded.")).toHaveLength(4);
  expect(screen.getByText("Not verified")).toBeInTheDocument();
  expect(screen.queryByText("Deployed", { exact: true })).not.toBeInTheDocument();
  expect(screen.queryByText("Approved", { exact: true })).not.toBeInTheDocument();
});
