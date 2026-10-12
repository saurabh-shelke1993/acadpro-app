import {
  normalizeIndianMobile,
  validateQuickEnquiry,
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
