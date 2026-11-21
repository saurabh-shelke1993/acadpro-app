import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AcademyOwnerDashboardPreview from "./AcademyOwnerDashboardPreview";

const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const fixture = freeze({
  academyName: "Fixture Football Academy",
  totals: { players: 2, centers: 3, batches: 3 },
  centers: [
    { id: "north &/?", academyId: "academy+a", name: "Ground", players: 2,
      ageGroups: [{ name: "Junior (U10)", players: 2 }, { name: "Empty squad", players: 0 }] },
    { id: "south", academyId: "academy+a", name: "Ground", players: 1,
      ageGroups: [{ name: "Senior (U16)", players: 1 }] },
    { id: "zero", academyId: "academy+a", name: "Empty Ground", players: 0, ageGroups: [] },
  ],
  todaySessions: [
    { id: "late", centerId: "north &/?", batchId: "batch&1", centerName: "Ground", batchName: "Junior",
      startTime: "17:00", endTime: "18:00", attendanceRecorded: true },
    { id: "early", centerId: "north &/?", batchId: "batch&1", centerName: "Ground", batchName: "Junior",
      startTime: "16:00", endTime: "17:00", attendanceRecorded: true },
    { id: "south-session", centerId: "south", batchId: "batch2", centerName: "Ground", batchName: "Senior",
      startTime: "18:00", endTime: "19:00", attendanceRecorded: false },
  ],
  attendanceByBatch: [
    { id: "b1", centerId: "north &/?", centerName: "Ground", batchName: "Junior", presentRecords: 8, totalRecords: 10 },
    { id: "b2", centerId: "south", centerName: "Ground", batchName: "Senior", presentRecords: 1, totalRecords: 2 },
    { id: "b3", centerId: "north &/?", centerName: "Ground", batchName: "Empty squad", presentRecords: 0, totalRecords: 0 },
  ],
  financial: { totalBilledThisMonth: 10000, collectionsThisMonth: 7000, expensesThisMonth: 900,
    outstandingAmount: 3000, pendingDues: 2, partialDues: 1, paidDues: 3, collectionRate: 70 },
  enquirySummary: { total: 7, groups: [
    { centerId: "north &/?", centerName: "Ground", total: 4 },
    { centerId: "south", centerName: "Ground", total: 2 },
    { centerId: "unassigned-center", centerName: "Unassigned center", total: 1 },
  ] },
});

let media;
let listeners;
beforeEach(() => {
  listeners = new Set();
  media = { matches: false, addEventListener: jest.fn((type, listener) => listeners.add(listener)),
    removeEventListener: jest.fn((type, listener) => listeners.delete(listener)) };
  window.matchMedia = jest.fn(() => media);
});
const mount = (data = fixture) => render(<MemoryRouter><AcademyOwnerDashboardPreview data={data} /></MemoryRouter>);
const region = (name) => screen.getByRole("region", { name });
const finance = () => region("Financial snapshot");
const attendance = () => region("Weekly attendance");
const resize = (stacked) => act(() => {
  media.matches = stacked;
  listeners.forEach((listener) => listener({ matches: stacked }));
});

test("renders the selected sections and existing total links with unique players separate from memberships", () => {
  mount();
  expect(screen.getByRole("heading", { level: 1, name: "Academy overview" })).toBeInTheDocument();
  expect(screen.getByText(/Fixture Football Academy/)).toBeInTheDocument();
  for (const name of ["Players overview", "Today's sessions", "Weekly attendance", "Financial snapshot", "Enquiries"]) {
    expect(region(name)).toBeInTheDocument();
  }
  const totals = screen.getByRole("navigation", { name: "Academy totals" });
  expect(within(totals).getByRole("link", { name: /Players/ })).toHaveAttribute("href", "/players");
  expect(within(within(totals).getByRole("link", { name: /Players/ })).getByText("2")).toBeInTheDocument();
  expect(within(totals).getByRole("link", { name: /Centers/ })).toHaveAttribute("href", "/centers");
  expect(within(totals).getByRole("link", { name: /Batches/ })).toHaveAttribute("href", "/batches");
  expect(within(region("Players overview")).getByRole("img", { name: /3 player-center memberships, not unique players/ })).toBeInTheDocument();
  expect(screen.queryByRole("group", { name: /palette/i })).not.toBeInTheDocument();
  expect(screen.getAllByRole("link").some((link) => link.getAttribute("href").includes("ui-c2"))).toBe(false);
});

test("center selection uses IDs, retains empty squads and centers, and never links aggregated batch labels", () => {
  mount();
  const overview = region("Players overview");
  expect(within(overview).getByText("Empty squad")).toBeInTheDocument();
  expect(within(within(overview).getByRole("list")).getByText("0")).toBeInTheDocument();
  expect(within(overview).queryByRole("link", { name: /Junior/ })).not.toBeInTheDocument();
  const initial = within(overview).getByRole("link", { name: /View center players/ });
  const initialParams = new URL(initial.getAttribute("href"), "https://example.invalid").searchParams;
  expect(initialParams.get("centerId")).toBe("north &/?");
  expect(initialParams.get("academyId")).toBe("academy+a");
  userEvent.click(within(overview).getByRole("button", { name: /center 2$/ }));
  expect(within(overview).getByText("Senior (U16)")).toBeInTheDocument();
  expect(within(overview).queryByText("Junior (U10)")).not.toBeInTheDocument();
  expect(within(overview).getByRole("link", { name: /View center players/ }).getAttribute("href")).toContain("centerId=south");
  userEvent.click(within(overview).getByRole("button", { name: /Empty Ground/ }));
  expect(within(overview).getByText("No active batches for this center")).toBeInTheDocument();
  expect(within(overview).getByRole("button", { name: /Empty Ground/ })).toHaveAttribute("aria-pressed", "true");
});

test("all sessions are ordered within ID groups and two schedules share only a qualified batch/date mark", () => {
  mount();
  const sessions = region("Today's sessions");
  expect(within(sessions).getByText("3 scheduled")).toBeInTheDocument();
  expect(within(sessions).getAllByText("Marks recorded for this batch today")).toHaveLength(2);
  expect(within(sessions).getByText("No marks recorded for this batch today")).toBeInTheDocument();
  expect(within(sessions).getByText(/not completion of each session/)).toBeInTheDocument();
  expect(within(sessions).queryByText(/sessions with marks|session complete/i)).not.toBeInTheDocument();
  const links = within(sessions).getAllByRole("link", { name: /Open attendance for/ });
  expect(links).toHaveLength(3);
  expect(links[0]).toHaveTextContent("4:00 PM – 5:00 PM");
  expect(links[1]).toHaveTextContent("5:00 PM – 6:00 PM");
  const params = new URL(links[0].getAttribute("href"), "https://example.invalid").searchParams;
  expect([...params]).toEqual([["view", "mark"], ["centerId", "north &/?"], ["batchId", "batch&1"]]);
  expect(within(sessions).getByRole("link", { name: /Attendance workspace/ })).toHaveAttribute("href", "/attendance?view=mark");
});

test("duplicate-name attendance centers remain distinct and filtering preserves weighted global totals", () => {
  const view = mount();
  const chart = attendance();
  expect(within(chart).getByText("75%")).toBeInTheDocument();
  expect(within(chart).getByText("2/3")).toBeInTheDocument();
  expect(within(chart).getByRole("img", { name: /Junior,.*80%.*8 of 10/ })).toBeInTheDocument();
  expect(within(chart).getByRole("img", { name: /Senior,.*50%.*1 of 2/ })).toBeInTheDocument();
  const select = within(chart).getByRole("combobox", { name: "Center" });
  expect(within(select).getAllByRole("option")).toHaveLength(3);
  userEvent.selectOptions(select, JSON.stringify("south"));
  expect(within(chart).getByText("Senior")).toBeInTheDocument();
  expect(within(chart).queryByText("Junior")).not.toBeInTheDocument();
  expect(within(chart).getByText("Showing 1 of 3 batches")).toBeInTheDocument();
  expect(within(chart).getByText("75%")).toBeInTheDocument();
  expect(within(chart).getByText("2/3")).toBeInTheDocument();
  view.rerender(<MemoryRouter><AcademyOwnerDashboardPreview data={{ ...fixture, attendanceByBatch: [...fixture.attendanceByBatch].reverse() }} /></MemoryRouter>);
  expect(select).toHaveValue(JSON.stringify("south"));
  expect(within(chart).getByText("Senior")).toBeInTheDocument();
  expect(within(chart).queryByText("Junior")).not.toBeInTheDocument();
});

test("null center bucket and a real center ID named null do not collide", () => {
  mount({ ...fixture, attendanceByBatch: [
    { id: "unknown", centerId: null, batchName: "Unknown batch", presentRecords: 0, totalRecords: 0 },
    { id: "real", centerId: "null", centerName: "Real Ground", batchName: "Real batch", presentRecords: 1, totalRecords: 1 },
  ] });
  const chart = attendance();
  userEvent.selectOptions(within(chart).getByRole("combobox", { name: "Center" }), "null");
  expect(within(chart).getByText("Unknown batch")).toBeInTheDocument();
  expect(within(chart).queryByText("Real batch")).not.toBeInTheDocument();
  expect(within(chart).getByText("1/2")).toBeInTheDocument();
});

test("no marks, recorded zero percent and missing counts have different chart equivalents", () => {
  mount({ ...fixture, attendanceByBatch: [
    { id: "no-marks", centerId: "north", batchName: "No data batch", presentRecords: 0, totalRecords: 0 },
    { id: "absent", centerId: "north", batchName: "Absent batch", presentRecords: 0, totalRecords: 3 },
    { id: "missing", centerId: "north", batchName: "Missing batch", totalRecords: 3 },
  ] });
  const chart = attendance();
  expect(within(chart).getByText("Attendance summary unavailable")).toBeInTheDocument();
  expect(within(chart).getByRole("img", { name: /No data batch,.*no recorded marks/ })).toBeInTheDocument();
  expect(within(chart).getByRole("img", { name: /Absent batch,.*0%.*0 of 3/ })).toBeInTheDocument();
  expect(within(chart).getByRole("img", { name: /Missing batch,.*counts unavailable/ })).toBeInTheDocument();
  expect(within(chart).getByText("No marks")).toBeInTheDocument();
  expect(within(chart).getByText("0%")).toBeInTheDocument();
  expect(within(chart).getByText("Unavailable")).toBeInTheDocument();
});

test("all-zero attendance retains batch rows without presenting an academy zero-percent rate", () => {
  mount({ ...fixture, attendanceByBatch: [{ id: "zero", centerId: "north", batchName: "Zero marks", presentRecords: 0, totalRecords: 0 }] });
  const chart = attendance();
  expect(within(chart).getByText("No recorded attendance marks")).toBeInTheDocument();
  expect(within(chart).getByText("Zero marks")).toBeInTheDocument();
  expect(within(chart).queryByText("0%")).not.toBeInTheDocument();
});

test("finance uses supplied amounts, outstanding across periods, existing destinations and uncapped rate", () => {
  mount({ ...fixture, financial: { ...fixture.financial, collectionRate: 175 } });
  const panel = finance();
  expect(within(panel).getByText("₹7,000")).toBeInTheDocument();
  expect(within(panel).getByText("₹3,000")).toBeInTheDocument();
  expect(within(panel).getByText("₹10,000")).toBeInTheDocument();
  expect(within(panel).getByText("₹900")).toBeInTheDocument();
  expect(within(panel).getByText("175%")).toBeInTheDocument();
  expect(within(panel).getByText(/Due status counts cover all returned periods/)).toBeInTheDocument();
  expect(within(panel).getByRole("link", { name: /Collected this month/ })).toHaveAttribute("href", "/payment-collections");
  expect(within(panel).getByRole("link", { name: /Current outstanding/ })).toHaveAttribute("href", "/payment-dues");
  expect(within(panel).getByRole("link", { name: /Expenses this month/ })).toHaveAttribute("href", "/expenses");
});

test("zero billing gives N/A while zero money and prior outstanding remain visible", () => {
  mount({ ...fixture, financial: { ...fixture.financial, totalBilledThisMonth: 0, collectionsThisMonth: 0, collectionRate: 0 } });
  expect(within(finance()).getByText("N/A")).toBeInTheDocument();
  expect(within(finance()).getAllByText("₹0")).toHaveLength(2);
  expect(within(finance()).getByText("₹3,000")).toBeInTheDocument();
});

test("partial and wholly unavailable finances never masquerade as zero money", () => {
  const view = mount({ ...fixture, financial: {} });
  expect(within(finance()).queryByText("₹0")).not.toBeInTheDocument();
  expect(within(finance()).getByText(/Collection rate unavailable/)).toBeInTheDocument();
  view.rerender(<MemoryRouter><AcademyOwnerDashboardPreview data={{ ...fixture, financial: null }} /></MemoryRouter>);
  expect(within(finance()).getByText("Finances unavailable")).toBeInTheDocument();
  expect(within(finance()).queryByRole("link")).not.toBeInTheDocument();
});

test("enquiries preserve received-month totals and scoped links, leaving synthetic unassigned filters unlinked", () => {
  mount();
  const panel = region("Enquiries");
  expect(within(panel).getByText("Received this month")).toBeInTheDocument();
  expect(within(panel).getByText("7")).toBeInTheDocument();
  expect(within(panel).queryByText("New enquiries")).not.toBeInTheDocument();
  const links = within(panel).getAllByRole("link", { name: "View enquiries for Ground" });
  expect(links).toHaveLength(2);
  expect(new URL(links[0].getAttribute("href"), "https://example.invalid").searchParams.get("centerId")).toBe("north &/?");
  expect(within(panel).getByText("Unassigned center")).toBeInTheDocument();
  expect(within(panel).queryByRole("link", { name: /Unassigned center/ })).not.toBeInTheDocument();
});

test("enquiries show the top four centers sorted by count and name without mutating frozen source", () => {
  const groups = freeze([
    { centerId: "z", centerName: "Zed", total: 1 }, { centerId: "d", centerName: "Delta", total: 4 },
    { centerId: "c", centerName: "Charlie", total: 3 }, { centerId: "b", centerName: "Bravo", total: 4 },
    { centerId: "a", centerName: "Alpha", total: 5 },
  ]);
  mount({ ...fixture, enquirySummary: { total: 17, groups } });
  const links = within(region("Enquiries")).getAllByRole("link", { name: /View enquiries for/ });
  expect(links.map((link) => link.getAttribute("aria-label"))).toEqual([
    "View enquiries for Alpha", "View enquiries for Bravo", "View enquiries for Delta", "View enquiries for Charlie",
  ]);
  expect(groups[0].centerId).toBe("z");
});

test("known empty datasets and zero totals stay distinct from unavailable datasets", () => {
  const view = mount({ academyName: "Empty Academy", totals: { players: 0, centers: 0, batches: 0 }, centers: [],
    todaySessions: [], attendanceByBatch: [], financial: { totalBilledThisMonth: 0, collectionRate: 0 }, enquirySummary: { total: 0, groups: [] } });
  expect(screen.getByText("No centers configured")).toBeInTheDocument();
  expect(screen.getByText("No training scheduled today")).toBeInTheDocument();
  expect(screen.getByText("No active batches found")).toBeInTheDocument();
  expect(screen.getByText("No enquiries received this month.")).toBeInTheDocument();
  expect(within(screen.getByRole("navigation", { name: "Academy totals" })).getAllByText("0")).toHaveLength(3);
  view.rerender(<MemoryRouter><AcademyOwnerDashboardPreview data={{}} /></MemoryRouter>);
  for (const message of ["Center information unavailable", "Training schedule unavailable", "Attendance unavailable", "Finances unavailable", "Enquiries unavailable"]) {
    expect(screen.getByText(message)).toBeInTheDocument();
  }
  expect(screen.queryByText("₹0")).not.toBeInTheDocument();
});

test("missing dashboard source, center identity and batch counts are explicit unavailable states", () => {
  const view = mount(null);
  expect(screen.getByRole("status")).toHaveTextContent("Dashboard unavailable");
  expect(screen.queryByRole("navigation", { name: "Academy totals" })).not.toBeInTheDocument();
  view.rerender(<MemoryRouter><AcademyOwnerDashboardPreview data={{ ...fixture, centers: [{ name: "Unknown" }] }} /></MemoryRouter>);
  expect(screen.getByText(/Center identity unavailable/)).toBeInTheDocument();
  expect(within(region("Players overview")).queryByRole("button")).not.toBeInTheDocument();
  expect(within(region("Players overview")).getByRole("img", { name: /memberships unavailable/ })).toBeInTheDocument();
});

test("missing session mark flag is unavailable rather than a claim that no marks exist", () => {
  mount({ ...fixture, todaySessions: [{ id: "missing", batchName: "Unknown", startTime: null }] });
  expect(within(region("Today's sessions")).getByText("Batch marks unavailable")).toBeInTheDocument();
  expect(within(region("Today's sessions")).getByRole("link", { name: /Open attendance for Unknown/ })).toHaveAttribute("href", "/attendance?view=mark");
});

test("stacked DOM order matches visual priority, preserving selected state, focus and filter across resize", () => {
  const view = mount();
  expect(screen.getAllByRole("region")[0]).toBe(region("Players overview"));
  const selected = within(region("Players overview")).getByRole("button", { name: /center 2$/ });
  userEvent.click(selected);
  const filter = within(attendance()).getByRole("combobox", { name: "Center" });
  userEvent.selectOptions(filter, JSON.stringify("south"));
  selected.focus();
  resize(true);
  expect(screen.getAllByRole("region")[0]).toBe(region("Today's sessions"));
  expect(within(region("Players overview")).getByRole("button", { name: /center 2$/ })).toBe(selected);
  expect(selected).toHaveAttribute("aria-pressed", "true");
  expect(selected).toHaveFocus();
  expect(filter).toHaveValue(JSON.stringify("south"));
  expect(within(region("Players overview")).getByText("Senior (U16)")).toBeInTheDocument();
  resize(false);
  expect(screen.getAllByRole("region")[0]).toBe(region("Players overview"));
  expect(selected).toHaveFocus();
  view.unmount();
  expect(media.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  expect(listeners.size).toBe(0);
});

test("initial stacked rendering has sessions first in the keyboard sequence after totals", () => {
  media.matches = true;
  mount();
  expect(screen.getAllByRole("region")[0]).toBe(region("Today's sessions"));
  for (let i = 0; i < 4; i += 1) userEvent.tab();
  expect(within(region("Today's sessions")).getByRole("link", { name: /Attendance workspace/ })).toHaveFocus();
  expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 1190px)");
});

test("filter resets safely if its selected center disappears from new props", () => {
  const view = mount();
  const filter = within(attendance()).getByRole("combobox", { name: "Center" });
  fireEvent.change(filter, { target: { value: JSON.stringify("south") } });
  view.rerender(<MemoryRouter><AcademyOwnerDashboardPreview data={{ ...fixture,
    attendanceByBatch: fixture.attendanceByBatch.filter((batch) => batch.centerId !== "south") }} /></MemoryRouter>);
  expect(filter).toHaveValue("");
  expect(within(attendance()).getByText("Showing 2 of 2 batches")).toBeInTheDocument();
});
