import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SubscriptionFeePreview from "./SubscriptionFeePreview";
import { getPlayerScheduleEnrollments } from "../services/playerScheduleService";
jest.mock("../services/playerScheduleService", () => ({ getPlayerScheduleEnrollments: jest.fn() }));

const player = { id: "player-1", academy_id: "academy-1", center_id: "center-1", batch_id: "batch-1" };
const plan = { id: "plan-1", academy_id: "academy-1", billing_cycle: "monthly", amount: "1500.00" };
const enrollment = (id, day, extras = {}) => ({
  academy_id: "academy-1", player_id: "player-1", is_active: true,
  enrolled_from: "2027-01-15", enrolled_until: null,
  batch_schedules: { id, day_of_week: day, batch_id: "batch-1", center_id: "center-1", is_active: true },
  ...extras,
});
const pick = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
beforeEach(() => {
  jest.clearAllMocks();
  getPlayerScheduleEnrollments.mockResolvedValue([enrollment("mon",1),enrollment("wed",3),enrollment("fri",5)]);
});

test("monthly only; no save or charge actions", () => {
  const { rerender } = render(<SubscriptionFeePreview player={player} plan={plan} joinDate="2027-01-15" />);
  expect(screen.getByRole("region",{name:"First-period fee preview"})).toBeInTheDocument();
  expect(screen.getByText(/calendar-aligned end date is saved separately/)).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  rerender(<SubscriptionFeePreview player={player} plan={{...plan,billing_cycle:"quarterly"}} joinDate="2027-01-15" />);
  expect(screen.queryByRole("region",{name:"First-period fee preview"})).not.toBeInTheDocument();
});

test("fixed-month calendar days: 17/31 and ₹822.58; no schedule read", () => {
  render(<SubscriptionFeePreview player={player} plan={plan} joinDate="2027-01-15" />);
  pick("Billing model (preview only)","fixed_calendar_month");
  expect(screen.getByText(/Choose a proration basis/)).toBeInTheDocument();
  pick("Proration basis (preview only)","calendar_days");
  expect(screen.getByText("17 of 31 calendar days")).toBeInTheDocument();
  expect(screen.getByText("2027-01-15 – 2027-01-31")).toBeInTheDocument();
  expect(screen.getByText("2027-02-01")).toBeInTheDocument();
  expect(screen.getByText(/822\.58/)).toBeInTheDocument();
  expect(getPlayerScheduleEnrollments).not.toHaveBeenCalled();
});

test("anniversary month: 15 Jan to 14 Feb full amount", () => {
  render(<SubscriptionFeePreview player={player} plan={plan} joinDate="2027-01-15" />);
  pick("Billing model (preview only)","anniversary_month");
  expect(screen.getByText("2027-01-15 – 2027-02-14")).toBeInTheDocument();
  expect(screen.getByText("2027-02-15")).toBeInTheDocument();
  expect(screen.getAllByText(/1,500\.00/)).toHaveLength(2);
  expect(getPlayerScheduleEnrollments).not.toHaveBeenCalled();
});

test("RC1.3 anniversary preview clearly says dates are not the saved calendar end", () => {
  render(<SubscriptionFeePreview player={player} plan={plan} joinDate="2027-01-15" />);
  pick("Billing model (preview only)", "anniversary_month");
  expect(screen.getByText(/alternative simulation and may differ from the fixed-calendar end date/)).toBeInTheDocument();
});

test("session-based quote uses scoped player enrollments and 7/13 occurrences", async () => {
  getPlayerScheduleEnrollments.mockResolvedValue([
    enrollment("mon",1),enrollment("wed",3),enrollment("fri",5),
    enrollment("other",1,{academy_id:"academy-2"}),
    enrollment("inactive",5,{is_active:false}),
  ]);
  render(<SubscriptionFeePreview player={player} plan={plan} joinDate="2027-01-15" />);
  pick("Billing model (preview only)","fixed_calendar_month");
  pick("Proration basis (preview only)","scheduled_sessions");
  expect(await screen.findByText("7 of 13 scheduled sessions")).toBeInTheDocument();
  expect(screen.getByText(/807\.69/)).toBeInTheDocument();
  expect(getPlayerScheduleEnrollments).toHaveBeenCalledWith({
    academyId:"academy-1",centerId:"center-1",batchId:"batch-1",playerId:"player-1",
  });
});

test("cross-academy plan shows no quote or schedule query", () => {
  render(<SubscriptionFeePreview player={player} plan={{...plan,academy_id:"academy-2"}} joinDate="2027-01-15" />);
  expect(screen.getByRole("alert")).toHaveTextContent(/same academy/);
  expect(screen.queryByLabelText("Billing model (preview only)")).not.toBeInTheDocument();
  expect(getPlayerScheduleEnrollments).not.toHaveBeenCalled();
});

test("no enrollment fails closed without a guessed session estimate", async () => {
  getPlayerScheduleEnrollments.mockResolvedValue([]);
  render(<SubscriptionFeePreview player={player} plan={plan} joinDate="2027-01-15" />);
  pick("Billing model (preview only)","fixed_calendar_month");
  pick("Proration basis (preview only)","scheduled_sessions");
  expect(await screen.findByRole("alert")).toHaveTextContent(/requires authorized active session slots/);
});

test("RLS/error on schedule read does not silently fall back to day pricing", async () => {
  getPlayerScheduleEnrollments.mockRejectedValue(new Error("Denied"));
  render(<SubscriptionFeePreview player={player} plan={plan} joinDate="2027-01-15" />);
  pick("Billing model (preview only)","fixed_calendar_month");
  pick("Proration basis (preview only)","scheduled_sessions");
  await waitFor(()=>expect(screen.getByRole("alert")).toHaveTextContent(/Could not load assigned sessions/));
  expect(screen.queryByText(/807\.69/)).not.toBeInTheDocument();
});

test("joining-date changes recalculate the preview", () => {
  const {rerender}=render(<SubscriptionFeePreview player={player} plan={plan} joinDate="2027-01-15" />);
  pick("Billing model (preview only)","fixed_calendar_month");
  pick("Proration basis (preview only)","calendar_days");
  expect(screen.getByText(/822\.58/)).toBeInTheDocument();
  rerender(<SubscriptionFeePreview player={player} plan={plan} joinDate="2027-01-31" />);
  expect(screen.getByText(/48\.39/)).toBeInTheDocument();
});

test("invalid monetary precision refuses preview", () => {
  render(<SubscriptionFeePreview player={player} plan={{...plan,amount:"1500.009"}} joinDate="2027-01-15" />);
  pick("Billing model (preview only)","fixed_calendar_month");
  pick("Proration basis (preview only)","calendar_days");
  expect(screen.getByRole("alert")).toHaveTextContent(/more than two decimal places/);
});

test("billing-model change clears earlier pricing method", () => {
  render(<SubscriptionFeePreview player={player} plan={plan} joinDate="2027-01-15" />);
  pick("Billing model (preview only)","fixed_calendar_month");
  pick("Proration basis (preview only)","calendar_days");
  expect(screen.getByText(/822\.58/)).toBeInTheDocument();
  pick("Billing model (preview only)","anniversary_month");
  pick("Billing model (preview only)","fixed_calendar_month");
  expect(screen.getByText(/Choose a proration basis/)).toBeInTheDocument();
});
