import {
  normalizeIndianMobile,
  validateQuickEnquiry,
  validateEnquiryStatusUpdate,
} from "./enquiriesService";

describe("enquiriesService quick-capture validation", () => {
  test("normalizes a formatted Indian mobile number to digits", () => {
    expect(normalizeIndianMobile("+91 98765-43210")).toBe("919876543210");
    expect(normalizeIndianMobile("(98765) 43210")).toBe("9876543210");
  });

  test("requires a player name", () => {
    expect(validateQuickEnquiry({
      playerName: "   ",
      parentPhone: "9876543210",
      dob: "2015-05-12",
    })).toBe("Player name is required.");
  });

  test("rejects a phone number that does not normalize to 10 digits", () => {
    expect(validateQuickEnquiry({
      playerName: "Aarav",
      parentPhone: "+91 98765 43210",
      dob: "2015-05-12",
    })).toBe("Enter a valid 10-digit Indian parent contact number.");
  });

  test("requires a date of birth", () => {
    expect(validateQuickEnquiry({
      playerName: "Aarav",
      parentPhone: "9876543210",
      dob: "",
    })).toBe("Player date of birth is required.");
  });

  test("rejects a future date of birth", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    const dob = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}-${String(futureDate.getDate()).padStart(2, "0")}`;

    expect(validateQuickEnquiry({
      playerName: "Aarav",
      parentPhone: "9876543210",
      dob,
    })).toBe("Date of birth must be valid and cannot be in the future.");
  });

  test("accepts a valid quick-capture payload", () => {
    expect(validateQuickEnquiry({
      playerName: "  Aarav Shelke ",
      parentPhone: "(98765) 43210",
      dob: "2015-05-12",
    })).toBe("");
  });
});


describe("enquiriesService status and trial-date validation", () => {
  test("requires a trial date for Trial Scheduled", () => {
    expect(validateEnquiryStatusUpdate({
      status: "trial_scheduled",
      trialDate: "",
    })).toBe("A trial date is required for Trial Scheduled status.");
  });

  test("accepts a scheduled trial with a date", () => {
    expect(validateEnquiryStatusUpdate({
      status: "trial_scheduled",
      trialDate: "2026-10-20",
    })).toBe("");
  });

  test("allows other statuses without a trial date", () => {
    expect(validateEnquiryStatusUpdate({
      status: "contacted",
      trialDate: "",
    })).toBe("");
  });

  test("does not allow Converted through the ordinary status editor", () => {
    expect(validateEnquiryStatusUpdate({
      status: "converted",
      trialDate: "",
    })).toBe("Select a valid enquiry status.");
  });

  test("rejects an unknown status", () => {
    expect(validateEnquiryStatusUpdate({
      status: "unknown",
      trialDate: "",
    })).toBe("Select a valid enquiry status.");
  });
});
