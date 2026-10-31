jest.mock("../supabaseClient", () => ({ supabase: { from: jest.fn() } }));
import { reconcileFinanceDues } from "./financeQualityService";
describe("F7 due ledger quality", () => {
  test("identifies paid dues without linked transactions", () => {
    expect(reconcileFinanceDues([{ id: "a", paid_amount: 100 }], [])).toMatchObject({
      dueCount: 1, mismatchCount: 1, difference: 100, paidWithoutEntries: 1, underlinkedCount: 1, overlinkedCount: 0, noLinkedTransactionAmount: 100, quality: "partial",
      historicalOutstandingAvailable: false, collectionEfficiencyAvailable: false
    });
  });
  test("signed adjustments reconcile against due paid amount", () => {
    expect(reconcileFinanceDues([{ id: "a", paid_amount: 90 }], [
      { due_id: "a", payment_entry_type: "payment", amount_paid: 100 },
      { due_id: "a", payment_entry_type: "adjustment", amount_paid: -10 }
    ])).toMatchObject({ mismatchCount: 0, difference: 0, quality: "reconciled" });
  });
  test("identifies overlinked due entries without misclassifying missing payments", () => {
    expect(reconcileFinanceDues([{ id: "a", paid_amount: 1500 }], [{ due_id: "a", payment_entry_type: "payment", amount_paid: 2000 }]))
      .toMatchObject({ mismatchCount: 1, difference: -500, overlinkedCount: 1, underlinkedCount: 0, paidWithoutEntries: 0 });
  });
  test("rejects invalid transaction types", () => {
    expect(() => reconcileFinanceDues([], [{ due_id: "a", payment_entry_type: "other", amount_paid: 10 }])).toThrow();
  });
});
