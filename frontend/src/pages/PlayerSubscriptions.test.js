import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PlayerSubscriptions from "./PlayerSubscriptions";
import { getLoggedInUser } from "../utils/auth";
import { supabase } from "../services/supabase";

jest.mock("../components/Layout", () => ({ children }) => <div>{children}</div>);
jest.mock("../components/SubscriptionsWorkspaceTabs", () => ({ currentView }) => (
  <nav data-testid="subscriptions-view">{currentView}</nav>
));
jest.mock("../utils/auth", () => ({
  getLoggedInUser: jest.fn(),
  isSuperAdmin: (user) => user?.role === "super_admin",
  getAcademyId: (user) => user?.academy_id,
}));
jest.mock("../services/supabase", () => ({ supabase: { from: jest.fn() } }));

const data = {
  academies: [{ id: "academy-1", academy_name: "Test Academy" }],
  centers: [{ id: "center-1", center_name: "Main Center", academy_id: "academy-1" }],
  batches: [{ id: "batch-1", batch_name: "Juniors", center_id: "center-1" }],
  players: [{ id: "player-1", full_name: "Test Junior", academy_id: "academy-1", center_id: "center-1", batch_id: "batch-1" }],
  subscription_plans: [{ id: "plan-1", plan_name: "Monthly", amount: 1500, billing_cycle: "monthly", academy_id: "academy-1", is_active: true }],
  player_subscriptions: [],
  lastInserted: null,
};
const queryFor = (table) => {
  const filters = [];
  let query;
  query = {
    select: jest.fn(() => query),
    eq: jest.fn((field, value) => { filters.push([field, value]); return query; }),
    order: jest.fn(() => query),
    insert: jest.fn(async (rows) => {
      data.lastInserted = rows[0];
      return { data: null, error: null };
    }),
    then: (resolve, reject) => Promise.resolve({
      data: (data[table] || []).filter((item) =>
        filters.every(([key, value]) => item[key] === undefined || item[key] === value)),
      error: null,
    }).then(resolve, reject),
  };
  return query;
};
beforeEach(() => {
  data.lastInserted = null;
  jest.clearAllMocks();
  supabase.from.mockImplementation(queryFor);
  getLoggedInUser.mockResolvedValue({ id: "owner-1", role: "academy_owner", academy_id: "academy-1" });
});
afterEach(() => {
  data.player_subscriptions = [];
  data.subscription_plans = data.subscription_plans.filter((plan) => plan.id === "plan-1");
  data.lastInserted = null;
  jest.restoreAllMocks();
});

test("RC1.3 Owner sees compact Center Batch Player without redundant academy banner", async () => {
  render(<PlayerSubscriptions />);
  await waitFor(() => expect(screen.getByLabelText("Player").querySelector('option[value="player-1"]')).not.toBeNull());
  expect(screen.queryByText("Test Academy")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Academy")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Assign a plan to a player" })).toBeInTheDocument();
  expect(screen.getByLabelText("Center")).toBeInTheDocument();
  expect(screen.getByLabelText("Batch")).toBeInTheDocument();
  expect(screen.getByLabelText("Player")).toBeInTheDocument();
  expect(screen.getByLabelText("Plan")).toBeInTheDocument();
  expect(screen.getByLabelText("Start date")).toBeInTheDocument();
  expect(screen.getByLabelText("End date")).toHaveAttribute("readonly");
  const contextRow = screen.getByLabelText("Center").closest(".player-subscriptions-context-grid");
  expect(contextRow).toContainElement(screen.getByLabelText("Batch"));
  expect(contextRow).toContainElement(screen.getByLabelText("Player"));
  expect(screen.getByRole("button", { name: "Create subscription" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Clear form" })).not.toBeInTheDocument();
  expect(screen.getByTestId("subscriptions-view")).toHaveTextContent("players");
});

test("PS1 Clear form resets a partially completed assignment without writing", async () => {
  render(<PlayerSubscriptions />);
  await waitFor(() => expect(screen.getByLabelText("Player").querySelector('option[value="player-1"]')).not.toBeNull());
  await waitFor(() => expect(screen.getByLabelText("Player").querySelector('option[value="player-1"]')).not.toBeNull());
  fireEvent.change(screen.getByLabelText("Player"), { target: { value: "player-1" } });
  expect(screen.getByRole("button", { name: "Clear form" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear form" }));
  expect(screen.getByLabelText("Player")).toHaveValue("");
  expect(screen.queryByRole("button", { name: "Clear form" })).not.toBeInTheDocument();
  expect(supabase.from).not.toHaveBeenCalledWith("payment_collections");
});

test("PS1 Super Admin keeps Academy selector and original filters", async () => {
  getLoggedInUser.mockResolvedValue({ id: "admin-1", role: "super_admin", academy_id: null });
  render(<PlayerSubscriptions />);
  await waitFor(() => expect(screen.getByLabelText("Academy")).toBeInTheDocument());
  expect(screen.getByLabelText("Academy")).toHaveValue("");
  expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("active");
  expect(screen.getByText(/matching/)).toBeInTheDocument();
});

test("RC1.1 existing active player-plan offers Edit rather than creating a duplicate", async () => {
  data.player_subscriptions = [{
    id: "subscription-1",
    player_id: "player-1",
    subscription_plan_id: "plan-1",
    start_date: "2026-11-01",
    end_date: null,
    status: "active",
    players: data.players[0],
    subscription_plans: data.subscription_plans[0],
  }];
  const originalAnimationFrame = window.requestAnimationFrame;
  window.requestAnimationFrame = jest.fn(() => 1);
  try {
    render(<PlayerSubscriptions />);
    await waitFor(() => expect(screen.getByText(/1 matching/)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Player"), { target: { value: "player-1" } });
    fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "plan-1" } });
    expect(screen.getByText("Active subscription already assigned")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create subscription" })).toBeDisabled();
    expect(screen.getByText(/fee preview is not saved and will not change payment dues/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit existing subscription" }));
    expect(screen.getByRole("heading", { name: "Update player subscription" })).toBeInTheDocument();
    expect(screen.getByLabelText("Start date")).toHaveValue("2026-11-01");
    expect(screen.getByRole("button", { name: "Update subscription" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Edit existing subscription" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "First-period fee preview" })).not.toBeInTheDocument();
    expect(supabase.from).not.toHaveBeenCalledWith("payment_dues");
  } finally {
    window.requestAnimationFrame = originalAnimationFrame;
  }
});

test("RC1.1 an inactive subscription does not block new assignment", async () => {
  data.player_subscriptions = [{
    id: "subscription-inactive",
    player_id: "player-1",
    subscription_plan_id: "plan-1",
    start_date: "2026-08-01",
    end_date: null,
    status: "inactive",
    players: data.players[0],
    subscription_plans: data.subscription_plans[0],
  }];
  render(<PlayerSubscriptions />);
  await waitFor(() => expect(screen.getByText(/1 inactive/)).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText("Player"), { target: { value: "player-1" } });
  fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "plan-1" } });
  expect(screen.queryByText("Active subscription already assigned")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Create subscription" })).toBeEnabled();
});

test("RC1.3 monthly and quarterly calendar ends appear before saving, without changing dates on legacy edits", async () => {
  data.subscription_plans = [
    ...data.subscription_plans,
    { id: "plan-2", plan_name: "Quarterly", amount: 4000, billing_cycle: "quarterly", academy_id: "academy-1", is_active: true },
  ];
  render(<PlayerSubscriptions />);
  await waitFor(() => expect(screen.getByLabelText("Plan").querySelector('option[value="plan-2"]')).not.toBeNull());
  fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "plan-1" } });
  fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-11-12" } });
  expect(screen.getByLabelText("End date")).toHaveValue("2026-11-30");
  fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "plan-2" } });
  expect(screen.getByLabelText("End date")).toHaveValue("2027-01-31");
  fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-12-12" } });
  expect(screen.getByLabelText("End date")).toHaveValue("2027-02-28");
});

test("RC1.3 saving a new monthly subscription persists the computed calendar end but no payment due", async () => {
  render(<PlayerSubscriptions />);
  await waitFor(() => expect(screen.getByLabelText("Player").querySelector('option[value="player-1"]')).not.toBeNull());
  fireEvent.change(screen.getByLabelText("Player"), { target: { value: "player-1" } });
  fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "plan-1" } });
  fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-11-12" } });
  expect(screen.getByLabelText("End date")).toHaveValue("2026-11-30");
  fireEvent.click(screen.getByRole("button", { name: "Create subscription" }));
  await waitFor(() => expect(data.lastInserted).toMatchObject({
    player_id: "player-1",
    subscription_plan_id: "plan-1",
    start_date: "2026-11-12",
    end_date: "2026-11-30",
    status: "active",
  }));
  expect(supabase.from).not.toHaveBeenCalledWith("payment_dues");
});

test("SP2 One-time plan requires a manually entered camp end date and never shows monthly fee preview", async () => {
  data.subscription_plans.push({
    id: "camp-plan", academy_id: "academy-1", plan_name: "Summer Camp U12",
    amount: 3000, billing_cycle: "one_time", is_active: true,
  });
  render(<PlayerSubscriptions />);
  await waitFor(() => expect(screen.getByLabelText("Plan").querySelector('option[value="camp-plan"]')).not.toBeNull());
  fireEvent.change(screen.getByLabelText("Player"), { target: { value: "player-1" } });
  fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "camp-plan" } });
  fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2027-05-12" } });

  expect(screen.getByLabelText("End date")).toHaveValue("");
  expect(screen.getByLabelText("End date")).not.toHaveAttribute("readonly");
  expect(screen.getByLabelText("End date")).toHaveAttribute("min", "2027-05-12");
  expect(screen.getByText(/One-time camp: enter the final camp date/)).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "First-period fee preview" })).not.toBeInTheDocument();
  expect(screen.getByRole("option", { name: /Summer Camp U12/ })).toHaveTextContent("one-time");

  fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2027-05-25" } });
  expect(screen.getByLabelText("End date")).toHaveValue("2027-05-25");
  fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "plan-1" } });
  expect(screen.getByLabelText("End date")).toHaveAttribute("readonly");
  expect(screen.getByLabelText("End date")).toHaveValue("2027-05-31");
  fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "camp-plan" } });
  expect(screen.getByLabelText("End date")).toHaveValue("");
});

test("SP2 creating One-time camp saves only explicit dates without posting dues, payments or renewals", async () => {
  data.subscription_plans.push({
    id: "camp-plan", academy_id: "academy-1", plan_name: "Winter Camp",
    amount: 2500, billing_cycle: "one_time", is_active: true,
  });
  render(<PlayerSubscriptions />);
  await waitFor(() => expect(screen.getByLabelText("Plan").querySelector('option[value="camp-plan"]')).not.toBeNull());
  fireEvent.change(screen.getByLabelText("Player"), { target: { value: "player-1" } });
  fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "camp-plan" } });
  fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-12-20" } });
  fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2027-01-05" } });
  fireEvent.click(screen.getByRole("button", { name: "Create subscription" }));
  await waitFor(() => expect(data.lastInserted).toEqual({
    player_id: "player-1", subscription_plan_id: "camp-plan",
    start_date: "2026-12-20", end_date: "2027-01-05", status: "active"
  }));
  expect(screen.getByText(/One-time camp assignment created/)).toBeInTheDocument();
  expect(supabase.from).not.toHaveBeenCalledWith("payment_dues");
  expect(supabase.from).not.toHaveBeenCalledWith("payments");
  expect(supabase.from).not.toHaveBeenCalledWith("payment_collections");
});

test("SP2 a One-time camp can be assigned alongside a different existing monthly plan", async () => {
  data.subscription_plans.push({
    id: "camp-plan", academy_id: "academy-1", plan_name: "Winter Camp",
    amount: 3000, billing_cycle: "one_time", is_active: true,
  });
  data.player_subscriptions = [{
    id: "regular-monthly", player_id: "player-1", subscription_plan_id: "plan-1",
    start_date: "2026-11-01", end_date: "2026-11-30", status: "active",
    players: data.players[0], subscription_plans: data.subscription_plans[0]
  }];
  render(<PlayerSubscriptions />);
  await waitFor(() => expect(screen.getByLabelText("Plan").querySelector('option[value="camp-plan"]')).not.toBeNull());
  fireEvent.change(screen.getByLabelText("Player"), { target: { value: "player-1" } });
  fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "camp-plan" } });
  expect(screen.getByRole("button", { name: "Create subscription" })).toBeEnabled();
  fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-12-20" } });
  fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2026-12-30" } });
  fireEvent.click(screen.getByRole("button", { name: "Create subscription" }));
  await waitFor(() => expect(data.lastInserted).toMatchObject({
    subscription_plan_id: "camp-plan", start_date: "2026-12-20", end_date: "2026-12-30"
  }));
  expect(supabase.from).not.toHaveBeenCalledWith("payment_dues");
});

test("SP2 refuses cross-academy One-time plan/participant pairing even in Super Admin UI", async () => {
  data.subscription_plans.push({
    id: "foreign-camp", academy_id: "academy-2", plan_name: "Foreign Camp",
    amount: 3000, billing_cycle: "one_time", is_active: true,
  });
  getLoggedInUser.mockResolvedValue({ id: "admin-1", role: "super_admin", academy_id: null });
  render(<PlayerSubscriptions />);
  await waitFor(() => expect(screen.getByLabelText("Plan").querySelector('option[value="foreign-camp"]')).not.toBeNull());
  fireEvent.change(screen.getByLabelText("Player"), { target: { value: "player-1" } });
  fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "foreign-camp" } });
  fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2027-05-12" } });
  fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2027-05-25" } });
  fireEvent.click(screen.getByRole("button", { name: "Create subscription" }));
  expect(await screen.findByText(/must belong to the same academy/)).toBeInTheDocument();
  expect(data.lastInserted).toBeNull();
});

test("SP2 invalid or missing One-time end dates must never insert an agreement", async () => {
  data.subscription_plans.push({
    id: "camp-plan", academy_id: "academy-1", plan_name: "Summer Camp U12",
    amount: 3000, billing_cycle: "one_time", is_active: true,
  });
  render(<PlayerSubscriptions />);
  await waitFor(() => expect(screen.getByLabelText("Plan").querySelector('option[value="camp-plan"]')).not.toBeNull());
  fireEvent.change(screen.getByLabelText("Player"), { target: { value: "player-1" } });
  fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "camp-plan" } });
  fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2027-05-12" } });
  fireEvent.click(screen.getByRole("button", { name: "Create subscription" }));
  expect(await screen.findByText(/Enter an end date for the One-time camp/)).toBeInTheDocument();
  expect(data.lastInserted).toBeNull();

  // HTML date field also advertises a minimum, but correctness is rechecked on save.
  fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2027-05-11" } });
  fireEvent.click(screen.getByRole("button", { name: "Create subscription" }));
  expect(await screen.findByText(/end date cannot be before/)).toBeInTheDocument();
  expect(data.lastInserted).toBeNull();
});

test("SP2 a matching active One-time camp cannot be duplicated and its saved end stays protected in Edit", async () => {
  data.subscription_plans.push({
    id: "camp-plan", academy_id: "academy-1", plan_name: "Summer Camp U12",
    amount: 3000, billing_cycle: "one_time", is_active: true,
  });
  data.player_subscriptions = [{
    id: "camp-enrollment", player_id: "player-1", subscription_plan_id: "camp-plan",
    start_date: "2027-05-12", end_date: "2027-05-25", status: "active",
    players: data.players[0], subscription_plans: data.subscription_plans[1]
  }];
  const originalRAF = window.requestAnimationFrame;
  window.requestAnimationFrame = jest.fn(() => 1);
  try {
    render(<PlayerSubscriptions />);
    await waitFor(() => expect(screen.getByLabelText("Plan").querySelector('option[value="camp-plan"]')).not.toBeNull());
    fireEvent.change(screen.getByLabelText("Player"), { target: { value: "player-1" } });
    fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "camp-plan" } });
    expect(screen.getByRole("button", { name: "Create subscription" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Edit existing subscription" }));
    expect(screen.getByLabelText("End date")).toHaveValue("2027-05-25");
    expect(screen.getByLabelText("End date")).toHaveAttribute("readonly");
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2027-06-12" } });
    fireEvent.click(screen.getByRole("button", { name: "Update subscription" }));
    expect(await screen.findByText(/has a recorded end date/)).toBeInTheDocument();
    expect(data.lastInserted).toBeNull();
  } finally {
    window.requestAnimationFrame = originalRAF;
  }
});

test("SP2 existing undated monthly subscription cannot be converted into a One-time camp in Edit", async () => {
  data.subscription_plans.push({
    id: "camp-plan", academy_id: "academy-1", plan_name: "Summer Camp",
    amount: 3000, billing_cycle: "one_time", is_active: true,
  });
  data.player_subscriptions = [{
    id: "legacy-monthly", player_id: "player-1", subscription_plan_id: "plan-1",
    start_date: "2026-08-01", end_date: null, status: "active",
    players: data.players[0], subscription_plans: data.subscription_plans[0]
  }];
  const originalRAF = window.requestAnimationFrame;
  window.requestAnimationFrame = jest.fn(() => 1);
  try {
    render(<PlayerSubscriptions />);
    await waitFor(() => expect(screen.getByText(/1 matching/)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Player"), { target: { value: "player-1" } });
    fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "plan-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Edit existing subscription" }));
    fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "camp-plan" } });
    expect(screen.getByLabelText("End date")).toHaveAttribute("readonly");
    fireEvent.click(screen.getByRole("button", { name: "Update subscription" }));
    expect(await screen.findByText(/cannot be converted to a One-time plan/)).toBeInTheDocument();
    expect(data.lastInserted).toBeNull();
  } finally {
    window.requestAnimationFrame = originalRAF;
  }
});

test("RC1.3 existing legacy subscriptions with missing end date are not silently backfilled", async () => {
  data.player_subscriptions = [{
    id: "subscription-legacy",
    player_id: "player-1",
    subscription_plan_id: "plan-1",
    start_date: "2026-08-01",
    end_date: null,
    status: "active",
    players: data.players[0],
    subscription_plans: data.subscription_plans[0],
  }];
  const originalRAF = window.requestAnimationFrame;
  window.requestAnimationFrame = jest.fn(() => 1);
  try {
    render(<PlayerSubscriptions />);
    await waitFor(() => expect(screen.getByText(/1 matching/)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Player"), { target: { value: "player-1" } });
    fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "plan-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Edit existing subscription" }));
    expect(screen.getByLabelText("End date")).toHaveValue("");
    expect(screen.getByText(/Empty legacy end dates remain unchanged/)).toBeInTheDocument();
  } finally {
    window.requestAnimationFrame = originalRAF;
  }
});

test("RC1.3 a recorded end date cannot silently survive a conflicting plan/start change", async () => {
  data.player_subscriptions = [{
    id: "subscription-new",
    player_id: "player-1",
    subscription_plan_id: "plan-1",
    start_date: "2026-11-12",
    end_date: "2026-11-30",
    status: "active",
    players: data.players[0],
    subscription_plans: data.subscription_plans[0],
  }];
  const originalRAF = window.requestAnimationFrame;
  window.requestAnimationFrame = jest.fn(() => 1);
  try {
    render(<PlayerSubscriptions />);
    await waitFor(() => expect(screen.getByText(/1 matching/)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Player"), { target: { value: "player-1" } });
    fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "plan-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Edit existing subscription" }));
    expect(screen.getByLabelText("End date")).toHaveValue("2026-11-30");
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-12-12" } });
    fireEvent.click(screen.getByRole("button", { name: "Update subscription" }));
    expect(await screen.findByText(/has a recorded end date/)).toBeInTheDocument();
    expect(supabase.from).not.toHaveBeenCalledWith("payment_dues");
  } finally {
    window.requestAnimationFrame = originalRAF;
  }
});

test("PS-L1P2 preview is read-only when a player and monthly plan are selected", async () => {
  render(<PlayerSubscriptions />);
  await waitFor(() => expect(screen.getByLabelText("Player").querySelector('option[value="player-1"]')).not.toBeNull());
  await waitFor(() => expect(screen.getByLabelText("Player").querySelector('option[value="player-1"]')).not.toBeNull());
  fireEvent.change(screen.getByLabelText("Player"), { target: { value: "player-1" } });
  fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "plan-1" } });
  expect(screen.getByRole("region",{name:"First-period fee preview"})).toBeInTheDocument();
  expect(screen.getByText(/calendar-aligned end date is saved separately/)).toBeInTheDocument();
  expect(screen.getByRole("button",{name:"Create subscription"})).toBeInTheDocument();
  expect(supabase.from).not.toHaveBeenCalledWith("payment_dues");
});
