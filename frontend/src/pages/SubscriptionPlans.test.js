import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SubscriptionPlans from "./SubscriptionPlans";
import { getLoggedInUser } from "../utils/auth";
import { supabase } from "../services/supabase";

jest.mock("../components/Layout", () => ({ children }) => <div>{children}</div>);
jest.mock("../components/SubscriptionsWorkspaceTabs", () => ({ currentView }) => (
  <nav data-testid="subscriptions-view">{currentView}</nav>
));
jest.mock("../utils/auth", () => ({
  getLoggedInUser: jest.fn(),
  isSuperAdmin: (user) => user?.role === "super_admin",
  getAcademyId: (user) => user?.academy_id
}));
jest.mock("../services/supabase", () => ({ supabase: { from: jest.fn() } }));

const data = {
  academies: [{ id: "academy-1", academy_name: "Test Academy", is_active: true }],
  subscription_plans: [
    {
      id: "plan-monthly",
      academy_id: "academy-1",
      plan_name: "Monthly",
      billing_cycle: "monthly",
      amount: 1500,
      registration_fee: 1000,
      is_active: true,
      created_at: "2026-11-01T00:00:00Z"
    },
    {
      id: "plan-quarterly",
      academy_id: "academy-1",
      plan_name: "Quarterly",
      billing_cycle: "quarterly",
      amount: 6000,
      registration_fee: 0,
      is_active: true,
      created_at: "2026-11-02T00:00:00Z"
    }
  ],
  inserted: null
};

const queryFor = (table) => {
  const filters = [];
  let query;
  query = {
    select: jest.fn(() => query),
    eq: jest.fn((column, value) => {
      filters.push([column, value]);
      return query;
    }),
    order: jest.fn(() => query),
    insert: jest.fn(async (rows) => {
      data.inserted = rows[0];
      return { data: null, error: null };
    }),
    then: (resolve, reject) => Promise.resolve({
      data: (data[table] || []).filter((row) =>
        filters.every(([column, value]) => row[column] === value)),
      error: null,
    }).then(resolve, reject)
  };
  return query;
};

beforeEach(() => {
  jest.clearAllMocks();
  data.inserted = null;
  getLoggedInUser.mockResolvedValue({ id: "owner-1", role: "academy_owner", academy_id: "academy-1" });
  supabase.from.mockImplementation(queryFor);
  window.scrollTo = jest.fn();
});
afterEach(() => {
  data.inserted = null;
  jest.restoreAllMocks();
});

test("SP1 renders monthly, quarterly, half-yearly and One-time, and uses Amount in form/table", async () => {
  render(<SubscriptionPlans />);
  await waitFor(() => expect(screen.getByLabelText("Academy")).toHaveValue("academy-1"));

  const cycle = screen.getByRole("combobox", { name: "Billing cycle" });
  expect(cycle).toBeInTheDocument();
  expect(Array.from(cycle.options).map((option) => [option.value, option.text])).toEqual([
    ["", "Select billing cycle"],
    ["monthly", "Monthly"],
    ["quarterly", "Quarterly"],
    ["half_yearly", "Half Yearly"],
    ["one_time", "One-time"]
  ]);
  expect(screen.getByLabelText("Amount")).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "Amount" })).toBeInTheDocument();
  expect(screen.queryByText("Recurring amount")).not.toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "Billing cycle" })).toBeInTheDocument();
  expect(screen.getByText("Monthly")).toBeInTheDocument();
  expect(screen.getByText("Quarterly")).toBeInTheDocument();
});

test("SP1 an Academy Owner can prepare a One-time plan payload without creating dues or enrollments", async () => {
  render(<SubscriptionPlans />);
  await waitFor(() => expect(screen.getByLabelText("Academy")).toHaveValue("academy-1"));

  fireEvent.change(screen.getByLabelText("Plan name"), { target: { value: "Summer Camp U12" } });
  fireEvent.change(screen.getByLabelText("Billing cycle"), { target: { value: "one_time" } });
  expect(screen.getByText(/One-time plan setup only/)).toBeInTheDocument();
  expect(screen.getByText(/will be supported in SP2 and SP3/)).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "3000" } });
  fireEvent.change(screen.getByLabelText("Registration fee"), { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: "Create plan" }));

  await waitFor(() => expect(data.inserted).toEqual({
    academy_id: "academy-1",
    plan_name: "Summer Camp U12",
    billing_cycle: "one_time",
    amount: 3000,
    registration_fee: 0
  }));
  expect(supabase.from).not.toHaveBeenCalledWith("player_subscriptions");
  expect(supabase.from).not.toHaveBeenCalledWith("payment_dues");
  expect(supabase.from).not.toHaveBeenCalledWith("payments");
});

test("SP1 monthly plan remains valid and does not show One-time-only note", async () => {
  render(<SubscriptionPlans />);
  await waitFor(() => expect(screen.getByLabelText("Academy")).toHaveValue("academy-1"));

  fireEvent.change(screen.getByLabelText("Plan name"), { target: { value: "Monthly Juniors" } });
  fireEvent.change(screen.getByLabelText("Billing cycle"), { target: { value: "monthly" } });
  expect(screen.queryByText(/One-time plan setup only/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "1500" } });
  fireEvent.change(screen.getByLabelText("Registration fee"), { target: { value: "1000" } });
  fireEvent.click(screen.getByRole("button", { name: "Create plan" }));

  await waitFor(() => expect(data.inserted).toMatchObject({
    plan_name: "Monthly Juniors",
    billing_cycle: "monthly",
    amount: 1500,
    registration_fee: 1000
  }));
});

test("SP1 Super Admin still requires an academy before a new plan can be created", async () => {
  getLoggedInUser.mockResolvedValue({ id: "admin-1", role: "super_admin", academy_id: null });
  render(<SubscriptionPlans />);
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Billing cycle" })).toBeInTheDocument());

  fireEvent.change(screen.getByLabelText("Plan name"), { target: { value: "Winter Camp" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Billing cycle" }), { target: { value: "one_time" } });
  fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "2500" } });
  fireEvent.change(screen.getByLabelText("Registration fee"), { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: "Create plan" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Select an academy");
  expect(data.inserted).toBeNull();
});
