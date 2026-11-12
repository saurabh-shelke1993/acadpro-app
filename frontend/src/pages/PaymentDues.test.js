import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import PaymentDues from "./PaymentDues";
import { getLoggedInUser } from "../utils/auth";
import { supabase } from "../supabaseClient";
import {
  fetchPaymentDuesService, createPaymentDueService
} from "../services/paymentService";
import {
  createOneTimeCampDueService, isOneTimeCampDueEnabled
} from "../services/oneTimeCampDueService";
import {
  getAccessibleAcademies, getAccessibleCenters,
  getAccessibleBatches, getAccessiblePlayers
} from "../utils/dataScope";

jest.mock("../components/Layout", () => ({ children }) => <div>{children}</div>);
jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }));
jest.mock("../utils/auth", () => ({ getLoggedInUser: jest.fn() }));
jest.mock("../supabaseClient", () => ({ supabase: { from: jest.fn() } }));
jest.mock("../services/oneTimeCampDueService", () => ({
  createOneTimeCampDueService: jest.fn(),
  isOneTimeCampDueEnabled: jest.fn()
}));
jest.mock("../utils/dataScope", () => ({
  getAccessibleAcademies: jest.fn(), getAccessibleCenters: jest.fn(),
  getAccessibleBatches: jest.fn(), getAccessiblePlayers: jest.fn()
}));
jest.mock("../services/paymentService", () => ({
  fetchPaymentDuesService: jest.fn(),
  createPaymentDueService: jest.fn(),
  updatePaymentDueService: jest.fn(),
  deletePaymentDueService: jest.fn()
}));

const player = { id: "player-1", full_name: "Test Junior", academy_id: "academy-1", center_id: "center-1", batch_id: "batch-1" };
const sub = {
  id: "subscription-1", player_id: player.id, status: "active", start_date: "2026-11-06",
  players: { full_name: player.full_name, academy_id: "academy-1" },
  subscription_plans: {
    plan_name: "Monthly", amount: 1500, academy_id: "academy-1", billing_cycle: "monthly"
  }
};
let existingDues = [];
let activeSubscription = sub;

const queryFor = (table) => {
  const filters = [];
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn((column, value) => { filters.push([column, value]); return query; }),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    single: jest.fn(async () => ({ data: table === "player_subscriptions" ? activeSubscription : null, error: null })),
    then: (resolve, reject) => {
      const rows = table === "player_subscriptions" ? [activeSubscription]
        : table === "payment_dues" ? existingDues : [];
      return Promise.resolve({
        data: rows.filter((row) => filters.every(([key, value]) => row[key] === value)),
        error: null
      }).then(resolve, reject);
    }
  };
  return query;
};

beforeEach(() => {
  existingDues = [];
  activeSubscription = sub;
  jest.clearAllMocks();
  isOneTimeCampDueEnabled.mockReturnValue(false);
  createOneTimeCampDueService.mockResolvedValue({
    id: "camp-due-1", created: true, due_type: "one_time", due_date: "2026-11-06",
    total_amount: 3000, paid_amount: 0, remaining_amount: 3000, due_status: "pending"
  });
  getLoggedInUser.mockResolvedValue({ id: "owner-1", role: "academy_owner", academy_id: "academy-1" });
  getAccessibleAcademies.mockResolvedValue([{ id: "academy-1", academy_name: "Test Academy" }]);
  getAccessibleCenters.mockResolvedValue([{ id: "center-1", center_name: "Main Center", academy_id: "academy-1" }]);
  getAccessibleBatches.mockResolvedValue([{ id: "batch-1", batch_name: "Juniors", center_id: "center-1" }]);
  getAccessiblePlayers.mockResolvedValue([{ players: player }]);
  supabase.from.mockImplementation(queryFor);
  fetchPaymentDuesService.mockImplementation(async (query) => (await query).data);
  createPaymentDueService.mockResolvedValue([{ id: "new-due" }]);
  jest.spyOn(window, "alert").mockImplementation(() => {});
  jest.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => jest.restoreAllMocks());

async function selectSubscription({ dueDate = "2026-11-06", dueType = "monthly" } = {}) {
  render(<PaymentDues />);
  const generateTrigger = await screen.findByRole("button", { name: /Generate Due/ });
  fireEvent.click(generateTrigger);
  const dialog = screen.getByRole("dialog", { name: "Generate Payment Due" });
  const d = within(dialog);

  await waitFor(() => expect(d.getByLabelText("Academy").querySelector('option[value="academy-1"]')).not.toBeNull());
  fireEvent.change(d.getByLabelText("Academy"), { target: { value: "academy-1" } });
  await waitFor(() => expect(d.getByLabelText("Center").querySelector('option[value="center-1"]')).not.toBeNull());
  fireEvent.change(d.getByLabelText("Center"), { target: { value: "center-1" } });
  await waitFor(() => expect(d.getByLabelText("Batch").querySelector('option[value="batch-1"]')).not.toBeNull());
  fireEvent.change(d.getByLabelText("Batch"), { target: { value: "batch-1" } });
  await waitFor(() => expect(d.getByLabelText("Player").querySelector('option[value="player-1"]')).not.toBeNull());
  fireEvent.change(d.getByLabelText("Player"), { target: { value: "player-1" } });
  await waitFor(() => expect(d.getByLabelText("Subscription").querySelector('option[value="subscription-1"]')).not.toBeNull());
  fireEvent.change(d.getByLabelText("Subscription"), { target: { value: "subscription-1" } });
  fireEvent.change(d.getByLabelText("Due Type"), { target: { value: dueType } });
  fireEvent.change(d.getByLabelText("Due Date"), { target: { value: dueDate } });
  return d;
}

test("RC1.2 an Owner can confirm one pending first-month due for INR 1269.23", async () => {
  const d = await selectSubscription();
  await waitFor(() => expect(d.getByText(/Use an Owner-approved first-period amount/)).toBeInTheDocument());
  fireEvent.click(d.getByLabelText("Use an Owner-approved first-period amount"));
  fireEvent.change(d.getByLabelText("Approved first-period fee"), { target: { value: "1269.23" } });
  fireEvent.change(d.getByLabelText("First-period fee adjustment reason"), {
    target: { value: "Joined after first two scheduled sessions" }
  });
  await waitFor(() => expect(d.getByRole("button", { name: "Generate Due" })).toBeEnabled());
  fireEvent.click(d.getByRole("button", { name: "Generate Due" }));
  await waitFor(() => expect(createPaymentDueService).toHaveBeenCalledTimes(1));
  expect(window.confirm).toHaveBeenCalledTimes(1);
  expect(createPaymentDueService).toHaveBeenCalledWith(expect.objectContaining({
    player_id: "player-1", subscription_id: "subscription-1",
    due_type: "monthly", due_date: "2026-11-06",
    total_amount: 1269.23, paid_amount: 0, due_status: "pending",
    remarks: expect.stringContaining("Standard rate INR 1500.00; one-time due INR 1269.23")
  }));
  expect(supabase.from).not.toHaveBeenCalledWith("subscription_plans");
});

test("RC1.2 standard Generate Due still uses full plan rate with no adjustment remarks", async () => {
  const d = await selectSubscription();
  await waitFor(() => expect(d.getByRole("button", { name: "Generate Due" })).toBeEnabled());
  fireEvent.click(d.getByRole("button", { name: "Generate Due" }));
  await waitFor(() => expect(createPaymentDueService).toHaveBeenCalledTimes(1));
  expect(createPaymentDueService).toHaveBeenCalledWith(expect.objectContaining({ total_amount: 1500 }));
  expect(createPaymentDueService.mock.calls[0][0]).not.toHaveProperty("remarks");
  expect(window.confirm).not.toHaveBeenCalled();
});

test("RC1.2 rejects manual fee above the standard price without writing", async () => {
  const d = await selectSubscription();
  fireEvent.click(d.getByLabelText("Use an Owner-approved first-period amount"));
  fireEvent.change(d.getByLabelText("Approved first-period fee"), { target: { value: "1800" } });
  fireEvent.change(d.getByLabelText("First-period fee adjustment reason"), { target: { value: "Joined midway through the month" } });
  await waitFor(() => expect(d.getByRole("button", { name: "Generate Due" })).toBeEnabled());
  fireEvent.click(d.getByRole("button", { name: "Generate Due" }));
  await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/lower than the standard monthly rate/)));
  expect(createPaymentDueService).not.toHaveBeenCalled();
});

test("RC1.2 does not provide manual adjustment on dates other than subscription start", async () => {
  const d = await selectSubscription({ dueDate: "2026-11-10" });
  expect(d.queryByLabelText("Use an Owner-approved first-period amount")).not.toBeInTheDocument();
  expect(d.queryByLabelText("Approved first-period fee")).not.toBeInTheDocument();
});

test("RC1.2 prevents an adjusted first-period due if the subscription already has a monthly due", async () => {
  existingDues = [{ id: "historic-due", subscription_id: "subscription-1", due_type: "monthly",
    due_date: "2026-12-01", total_amount: 1500, due_status: "paid", paid_amount: 1500 }];
  const d = await selectSubscription();
  fireEvent.click(d.getByLabelText("Use an Owner-approved first-period amount"));
  fireEvent.change(d.getByLabelText("Approved first-period fee"), { target: { value: "1269.23" } });
  fireEvent.change(d.getByLabelText("First-period fee adjustment reason"), { target: { value: "Joined after first two scheduled sessions" } });
  await waitFor(() => expect(d.getByRole("button", { name: "Generate Due" })).toBeEnabled());
  fireEvent.click(d.getByRole("button", { name: "Generate Due" }));
  await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/monthly due already exists/)));
  expect(createPaymentDueService).not.toHaveBeenCalled();
});

test("RC1.2 a saved decimal due shows its exact paise and adjustment note when selected", async () => {
  existingDues = [{
    id: "display-due", subscription_id: "subscription-1",
    due_type: "monthly", due_date: "2026-11-06",
    total_amount: 1269.23, paid_amount: 0, remaining_amount: 1269.23, due_status: "pending",
    remarks: "Owner-entered first-period monthly tuition adjustment.",
    players: {
      ...player,
      academies: { academy_name: "Test Academy" },
      centers: { center_name: "Main Center" },
      batches: { batch_name: "Juniors" }
    },
    player_subscriptions: { subscription_plans: { plan_name: "Monthly" } }
  }];
  render(<PaymentDues />);
  await waitFor(() => expect(screen.getByRole("cell", { name: "Test Junior" })).toBeInTheDocument());
  expect(screen.getAllByText("₹1,269.23").length).toBeGreaterThanOrEqual(2);
  fireEvent.click(screen.getByRole("cell", { name: "Test Junior" }));
  expect(screen.getByText(/Due notes:/)).toBeInTheDocument();
  expect(screen.getByText(/Owner-entered first-period monthly tuition adjustment/)).toBeInTheDocument();
});

test("SP3 One-time camp is visible as a locked, server-managed due until the backend is deployed", async () => {
  activeSubscription = {
    ...sub,
    subscription_plans: {
      ...sub.subscription_plans,
      plan_name: "Summer Camp",
      billing_cycle: "one_time"
    }
  };
  const d = await selectSubscription();
  expect(d.getByText(/One-time camp payment dues are not enabled yet/)).toBeInTheDocument();
  expect(d.getByText(/approved database safeguards must be installed/)).toBeInTheDocument();
  expect(d.getByLabelText("Due Type")).toHaveValue("one_time");
  expect(d.getByLabelText("Due Type")).toBeDisabled();
  expect(d.getByLabelText("Due Date")).toHaveValue("2026-11-06");
  expect(d.getByLabelText("Due Date")).toHaveAttribute("readonly");
  expect(d.getByRole("button", { name: "Generate Due" })).toBeDisabled();
  expect(d.queryByLabelText("Use an Owner-approved first-period amount")).not.toBeInTheDocument();
  expect(createPaymentDueService).not.toHaveBeenCalled();
  expect(createOneTimeCampDueService).not.toHaveBeenCalled();
});

test("SP3 enabled One-time camp uses server RPC and does not pass amount, due type or date from browser", async () => {
  isOneTimeCampDueEnabled.mockReturnValue(true);
  activeSubscription = {
    ...sub, subscription_plans: {
      ...sub.subscription_plans, plan_name: "Summer Camp U12",
      amount: 3000, billing_cycle: "one_time"
    }
  };
  const d = await selectSubscription();
  expect(d.getByLabelText("Due Type")).toHaveValue("one_time");
  expect(d.getByText(/one fee per player per camp plan/i)).toBeInTheDocument();
  await waitFor(() => expect(d.getByRole("button", { name: "Generate Due" })).toBeEnabled());
  fireEvent.click(d.getByRole("button", { name: "Generate Due" }));
  await waitFor(() => expect(createOneTimeCampDueService).toHaveBeenCalledWith("subscription-1"));
  expect(window.confirm).toHaveBeenCalledTimes(1);
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("ONE pending One-time camp due"));
  expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("One-time camp due generated"));
  expect(createPaymentDueService).not.toHaveBeenCalled();
});

test("SP3 already charged camp is idempotent and reports no duplicate", async () => {
  isOneTimeCampDueEnabled.mockReturnValue(true);
  activeSubscription = {
    ...sub, subscription_plans: {
      ...sub.subscription_plans, amount: 3000, billing_cycle: "one_time"
    }
  };
  createOneTimeCampDueService.mockResolvedValue({
    id: "camp-due-existing", created: false, due_type: "one_time",
    due_date: "2026-11-06", total_amount: 3000, paid_amount: 0,
    remaining_amount: 3000, due_status: "pending"
  });
  const d = await selectSubscription();
  await waitFor(() => expect(d.getByRole("button", { name: "Generate Due" })).toBeEnabled());
  fireEvent.click(d.getByRole("button", { name: "Generate Due" }));
  await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("No duplicate charge")));
  expect(createOneTimeCampDueService).toHaveBeenCalledTimes(1);
  expect(createPaymentDueService).not.toHaveBeenCalled();
});

test("SP3 cancel before authorization never submits a One-time charge", async () => {
  isOneTimeCampDueEnabled.mockReturnValue(true);
  activeSubscription = {
    ...sub, subscription_plans: {
      ...sub.subscription_plans, amount: 3000, billing_cycle: "one_time"
    }
  };
  window.confirm.mockReturnValue(false);
  const d = await selectSubscription();
  await waitFor(() => expect(d.getByRole("button", { name: "Generate Due" })).toBeEnabled());
  fireEvent.click(d.getByRole("button", { name: "Generate Due" }));
  expect(createOneTimeCampDueService).not.toHaveBeenCalled();
  expect(createPaymentDueService).not.toHaveBeenCalled();
});

test("RC1.2 Coach cannot generate manual or standard dues", async () => {
  getLoggedInUser.mockResolvedValue({ id: "coach-1", role: "coach", academy_id: "academy-1" });
  render(<PaymentDues />);
  await waitFor(() => expect(getLoggedInUser).toHaveBeenCalled());
  expect(screen.queryByRole("button", { name: /Generate Due/ })).not.toBeInTheDocument();
});
