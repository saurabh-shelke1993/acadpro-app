jest.mock("../supabaseClient", () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock("../utils/roles", () => ({
  isAcademyOwner: (user) => user?.role === "academy_owner",
  isSuperAdmin: (user) => user?.role === "super_admin",
}));

import { supabase } from "../supabaseClient";
import { fetchExpectedIncome, fetchPaymentIncome, saveExpense } from "./expensesService";

const makeQueryBuilder = (data = []) => {
  const builder = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    lt: jest.fn(() => builder),
    order: jest.fn(() => builder),
    then: (resolve, reject) => Promise.resolve({ data, error: null }).then(resolve, reject),
  };
  return builder;
};

describe("Expenses service recurring occurrence and income scope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("records a linked recurring expense through the atomic RPC", async () => {
    const user = { id: "user-1", role: "academy_owner", academy_id: "academy-1" };
    const expense = {
      expense_date: "2026-10-12",
      category: "Rent",
      description: "October ground rent",
      vendor: "Ground owner",
      amount_paid: "12000",
      payment_method: "UPI",
      reference_number: "UTR-123",
      reminder_id: "reminder-1",
      notes: "Paid manually",
    };
    const response = { id: "expense-1", reminder_id: "reminder-1" };
    supabase.rpc.mockResolvedValue({ data: response, error: null });

    await expect(saveExpense(user, expense)).resolves.toEqual(response);
    expect(supabase.rpc).toHaveBeenCalledWith("record_expense_occurrence", {
      p_reminder_id: "reminder-1",
      p_expense_date: "2026-10-12",
      p_amount_paid: 12000,
      p_description: "October ground rent",
      p_vendor: "Ground owner",
      p_payment_method: "UPI",
      p_reference_number: "UTR-123",
      p_notes: "Paid manually",
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test("scopes collected income to the Academy Owner's academy and period", async () => {
    const user = { id: "owner-1", role: "academy_owner", academy_id: "academy-1" };
    const builder = makeQueryBuilder([{ id: "payment-1", amount_paid: 1000, payment_entry_type: "payment" }]);
    supabase.from.mockReturnValue(builder);

    const data = await fetchPaymentIncome(user, {
      fromDateTime: "2026-10-01T00:00:00.000Z",
      toDateTimeExclusive: "2026-11-01T00:00:00.000Z",
    });

    expect(data).toHaveLength(1);
    expect(supabase.from).toHaveBeenCalledWith("payments");
    expect(builder.eq).toHaveBeenCalledWith("payment_entry_type", "payment");
    expect(builder.eq).toHaveBeenCalledWith("players.academy_id", "academy-1");
    expect(builder.gte).toHaveBeenCalledWith("payment_date", "2026-10-01T00:00:00.000Z");
    expect(builder.lt).toHaveBeenCalledWith("payment_date", "2026-11-01T00:00:00.000Z");
  });

  test("allows Super Admin to select an academy for income reporting", async () => {
    const user = { id: "admin-1", role: "super_admin" };
    const builder = makeQueryBuilder([]);
    supabase.from.mockReturnValue(builder);

    await fetchPaymentIncome(user, { academyId: "academy-2" });

    expect(builder.eq).toHaveBeenCalledWith("players.academy_id", "academy-2");
  });


  test("scopes expected income by due date and academy", async () => {
    const user = { id: "owner-1", role: "academy_owner", academy_id: "academy-1" };
    const builder = makeQueryBuilder([{ id: "due-1", total_amount: 8000, due_date: "2026-10-15" }]);
    supabase.from.mockReturnValue(builder);

    const data = await fetchExpectedIncome(user, {
      fromDate: "2026-10-01",
      toDate: "2026-10-31",
    });

    expect(data).toHaveLength(1);
    expect(supabase.from).toHaveBeenCalledWith("payment_dues");
    expect(builder.eq).toHaveBeenCalledWith("players.academy_id", "academy-1");
    expect(builder.gte).toHaveBeenCalledWith("due_date", "2026-10-01");
    expect(builder.lte).toHaveBeenCalledWith("due_date", "2026-10-31");
  });

  test("rejects Coach access before querying the database", async () => {
    await expect(fetchPaymentIncome({ id: "coach-1", role: "coach" })).rejects.toThrow(
      "You do not have permission to view Expenses."
    );
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
