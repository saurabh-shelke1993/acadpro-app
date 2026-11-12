import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ParentFinancialOverview from "./ParentFinancialOverview";
import { getChildFinancialData, getParentContext } from "../services/parentPortalService";

jest.mock("../components/Layout", () => ({ children }) => <div>{children}</div>);
jest.mock("react-router-dom", () => {
  const searchParams = new URLSearchParams();
  return { useSearchParams: () => [searchParams, jest.fn()] };
});
jest.mock("../services/parentPortalService", () => ({
  getParentContext: jest.fn(),
  getChildFinancialData: jest.fn(),
}));
jest.mock("../components/ParentUpiPaymentDetails", () => () => <div data-testid="payment-settings" />);
jest.mock("../components/ParentUpiPaymentSubmission", () => () => <div data-testid="claim-workflow" />);

const oneTime = {
  id: "camp-due-1", player_id: "player-1", subscription_id: "camp-sub-1",
  due_type: "one_time", due_date: "2027-05-12",
  total_amount: 3000, paid_amount: 1000, remaining_amount: 2000, due_status: "partial",
  player_subscriptions: {
    subscription_plans: { plan_name: "Summer Camp U12", billing_cycle: "one_time" }
  }
};
const payment = {
  id: "payment-1", player_id: "player-1", due_id: "camp-due-1",
  payment_date: "2027-05-12T12:00:00+05:30", amount_paid: 1000,
  payment_mode: "cash", transaction_reference: "TXN-100",
  receipt_number: "RCPT-100", remarks: "Camp fee",
  payment_dues: {
    due_type: "one_time",
    player_subscriptions: {
      subscription_plans: { plan_name: "Summer Camp U12", billing_cycle: "one_time" }
    }
  }
};

beforeEach(() => {
  jest.clearAllMocks();
  getParentContext.mockResolvedValue({
    children: [{
      id: "player-1", full_name: "Test Junior", academy_id: "academy-1",
      academy: { academy_name: "Test Academy" },
      center: { center_name: "Main" },
      batch: { batch_name: "Juniors" },
      player_status: "Active"
    }]
  });
  getChildFinancialData.mockResolvedValue({
    pendingDues: [oneTime], paymentHistory: [payment], errors: []
  });
});

test("SP3 parent financial overview displays the camp name and One-time amount alongside existing receipts", async () => {
  render(<ParentFinancialOverview />);
  expect(await screen.findByText("Summer Camp U12 · One-time")).toBeInTheDocument();
  expect(screen.getByText("Outstanding dues")).toBeInTheDocument();
  expect(screen.getAllByText("₹2,000.00").length).toBeGreaterThan(0);
  expect(screen.getAllByText("₹3,000.00").length).toBeGreaterThan(0);
  expect(screen.getByTestId("payment-settings")).toBeInTheDocument();
  expect(screen.getByTestId("claim-workflow")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("RCPT-100")).toBeInTheDocument());
  fireEvent.click(screen.getByText("RCPT-100").closest("button"));
  expect(screen.getByText("Camp")).toBeInTheDocument();
  expect(screen.getByText("Summer Camp U12")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Print \/ Save PDF/ })).toBeInTheDocument();
});
