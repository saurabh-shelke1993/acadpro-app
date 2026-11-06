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
};
const queryFor = (table) => {
  const filters = [];
  let query;
  query = {
    select: jest.fn(() => query),
    eq: jest.fn((field, value) => { filters.push([field, value]); return query; }),
    order: jest.fn(() => query),
    then: (resolve, reject) => Promise.resolve({
      data: (data[table] || []).filter((item) =>
        filters.every(([key, value]) => item[key] === undefined || item[key] === value)),
      error: null,
    }).then(resolve, reject),
  };
  return query;
};
beforeEach(() => {
  jest.clearAllMocks();
  supabase.from.mockImplementation(queryFor);
  getLoggedInUser.mockResolvedValue({ id: "owner-1", role: "academy_owner", academy_id: "academy-1" });
});
afterEach(() => jest.restoreAllMocks());

test("PS1 Owner sees compact academy scope and all original assignment controls", async () => {
  render(<PlayerSubscriptions />);
  expect(await screen.findByText("Test Academy")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Assign a plan to a player" })).toBeInTheDocument();
  expect(screen.getByLabelText("Center")).toBeInTheDocument();
  expect(screen.getByLabelText("Batch")).toBeInTheDocument();
  expect(screen.getByLabelText("Player")).toBeInTheDocument();
  expect(screen.getByLabelText("Plan")).toBeInTheDocument();
  expect(screen.getByLabelText("Start date")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Create subscription" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Clear form" })).not.toBeInTheDocument();
  expect(screen.getByTestId("subscriptions-view")).toHaveTextContent("players");
});

test("PS1 Clear form resets a partially completed assignment without writing", async () => {
  render(<PlayerSubscriptions />);
  await screen.findByText("Test Academy");
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
