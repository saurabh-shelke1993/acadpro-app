import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ParentUpiPaymentSubmission from "./ParentUpiPaymentSubmission";
import { getAcademyPaymentSettings } from "../services/academyPaymentSettingsService";
import {
  getParentPaymentSubmissions,
  submitParentUpiPayment,
} from "../services/parentPaymentSubmissionService";

jest.mock("../services/academyPaymentSettingsService", () => ({
  getAcademyPaymentSettings: jest.fn(),
}));

jest.mock("../services/parentPaymentSubmissionService", () => ({
  formatSubmissionStatus: jest.fn((status) => status === "pending" ? "Pending verification" : status),
  getParentPaymentSubmissions: jest.fn(),
  submitParentUpiPayment: jest.fn(),
}));

const dues = [{
  id: "due-1",
  due_type: "monthly",
  due_date: "2026-10-15",
  total_amount: 5000,
  paid_amount: 1000,
  remaining_amount: 4000,
  due_status: "partial",
}];

describe("ParentUpiPaymentSubmission", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAcademyPaymentSettings.mockResolvedValue({ is_enabled: true });
    getParentPaymentSubmissions.mockResolvedValue([]);
    submitParentUpiPayment.mockResolvedValue({ id: "claim-1", status: "pending" });
  });

  test("does not render submission form when academy UPI settings are disabled", async () => {
    getAcademyPaymentSettings.mockResolvedValue({ is_enabled: false });
    render(<ParentUpiPaymentSubmission playerId="player-1" academyId="academy-1" pendingDues={dues} />);
    await waitFor(() => expect(getAcademyPaymentSettings).toHaveBeenCalledWith("academy-1"));
    expect(screen.queryByRole("heading", { name: /submit payment for verification/i })).not.toBeInTheDocument();
  });

  test("submits the selected due and transaction reference without claiming the balance changed", async () => {
    render(<ParentUpiPaymentSubmission playerId="player-1" academyId="academy-1" pendingDues={dues} />);

    fireEvent.change(await screen.findByLabelText("Fee due"), { target: { value: "due-1" } });
    fireEvent.change(screen.getByLabelText(/Amount paid/), { target: { value: "2500" } });
    fireEvent.change(screen.getByLabelText("UPI transaction reference / UTR"), { target: { value: "UPI123456789" } });
    fireEvent.change(screen.getByLabelText("Payment date"), { target: { value: "2026-10-11" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit payment for verification" }));

    await waitFor(() => expect(submitParentUpiPayment).toHaveBeenCalledWith({
      dueId: "due-1",
      amount: "2500",
      transactionReference: "UPI123456789",
      paymentDate: "2026-10-11",
      parentNote: "",
    }));
    expect(await screen.findByRole("status")).toHaveTextContent(/fee balance has not changed/i);
  });

  test("blocks an amount greater than the selected due remaining balance", async () => {
    render(<ParentUpiPaymentSubmission playerId="player-1" academyId="academy-1" pendingDues={dues} />);
    fireEvent.change(await screen.findByLabelText("Fee due"), { target: { value: "due-1" } });
    fireEvent.change(screen.getByLabelText("Amount paid (₹)"), { target: { value: "4500" } });
    fireEvent.change(screen.getByLabelText("UPI transaction reference / UTR"), { target: { value: "UPI123456789" } });
    fireEvent.change(screen.getByLabelText("Payment date"), { target: { value: "2026-10-11" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit payment for verification" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot exceed the current remaining due/i);
    expect(submitParentUpiPayment).not.toHaveBeenCalled();
  });
});
