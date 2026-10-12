import {
  formatSubmissionStatus,
  validateParentPaymentSubmission,
} from "./parentPaymentSubmissionService";

describe("Parent UPI payment submission validation", () => {
  const valid = {
    dueId: "due-1",
    amount: "2500.00",
    transactionReference: "UPI123456789",
    paymentDate: "2026-10-11",
  };

  test("accepts a complete valid claim", () => {
    expect(validateParentPaymentSubmission(valid)).toBeNull();
  });

  test.each([
    [{ ...valid, dueId: "" }, /Select a fee due/],
    [{ ...valid, amount: "0" }, /greater than zero/],
    [{ ...valid, amount: "not-a-number" }, /greater than zero/],
    [{ ...valid, transactionReference: "ab" }, /transaction reference/],
    [{ ...valid, paymentDate: "" }, /date you made/],
    [{ ...valid, paymentDate: "2999-01-01" }, /future/],
  ])("rejects invalid input %#", (input, expected) => {
    expect(validateParentPaymentSubmission(input)).toMatch(expected);
  });

  test("uses explicit status labels and keeps acceptance distinct from ledger recording", () => {
    expect(formatSubmissionStatus("pending")).toBe("Pending verification");
    expect(formatSubmissionStatus("accepted")).toMatch(/awaiting ledger recording/);
    expect(formatSubmissionStatus("rejected")).toBe("Rejected");
  });
});
