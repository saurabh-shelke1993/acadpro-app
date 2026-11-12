import { getChildFinancialData } from "./parentPortalService";
import { supabase } from "../services/supabase";

jest.mock("../services/supabase", () => ({ supabase: { from: jest.fn() } }));

const due = {
  id: "camp-due", player_id: "child-1", due_type: "one_time",
  due_date: "2027-05-12", total_amount: 3000,
  paid_amount: 1000, remaining_amount: 2000, due_status: "partial",
  player_subscriptions: {
    subscription_plans: { plan_name: "Summer Camp U12", billing_cycle: "one_time" }
  }
};
const payment = {
  id: "payment-1", due_id: "camp-due", player_id: "child-1",
  receipt_number: "RCPT-100", amount_paid: 1000,
  payment_dues: {
    due_type: "one_time",
    player_subscriptions: {
      subscription_plans: { plan_name: "Summer Camp U12", billing_cycle: "one_time" }
    }
  }
};
const queries = [];
beforeEach(() => {
  jest.clearAllMocks();
  queries.length = 0;
  supabase.from.mockImplementation((table) => {
    const query = {
      select: jest.fn((fields) => { queries.push({ table, fields }); return query; }),
      eq: jest.fn(() => query),
      order: jest.fn(async () => ({
        data: table === "payments" ? [payment] : [due],
        error: null
      }))
    };
    return query;
  });
});

test("SP3 parent financial loader preserves the camp plan name in dues and receipts", async () => {
  const result = await getChildFinancialData("child-1");
  expect(result.pendingDues).toEqual([due]);
  expect(result.paymentHistory).toEqual([payment]);
  expect(result.errors).toEqual([]);
  expect(queries.find((item) => item.table === "payment_dues")?.fields).toContain(
    "player_subscriptions ( subscription_plans ( plan_name, billing_cycle ) )"
  );
  expect(queries.find((item) => item.table === "payments")?.fields).toContain(
    "payment_dues ( due_type, player_subscriptions ( subscription_plans ( plan_name, billing_cycle ) ) )"
  );
});

test("SP3 parent finance has no dues or history when child is not selected", async () => {
  expect(await getChildFinancialData("")).toEqual({
    paymentHistory: [], pendingDues: [], errors: []
  });
  expect(supabase.from).not.toHaveBeenCalled();
});
