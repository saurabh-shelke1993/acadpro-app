import { isValidUpiId, normalizeUpiId, validateQrFile } from "./academyPaymentSettingsService";

describe("Academy UPI settings validation", () => {
  test("normalizes UPI IDs before validation", () => {
    expect(normalizeUpiId("  academy@okaxis  ")).toBe("academy@okaxis");
    expect(isValidUpiId("  academy@okaxis  ")).toBe(true);
  });

  test.each(["academy@okaxis", "name.surname-2@okhdfcbank", "academy_1@bank"])(
    "accepts reasonable UPI ID format: %s",
    (upiId) => {
      expect(isValidUpiId(upiId)).toBe(true);
    }
  );

  test.each(["academy", "academy@", "@bank", "two words@bank", "name@bank space"])(
    "rejects malformed UPI ID: %s",
    (upiId) => {
      expect(isValidUpiId(upiId)).toBe(false);
    }
  );

  test("allows an empty UPI ID because QR-only configuration is supported", () => {
    expect(isValidUpiId("")).toBe(true);
  });

  test("accepts PNG, JPEG and WebP files within 2 MB", () => {
    expect(validateQrFile({ type: "image/png", size: 1024 })).toBeNull();
    expect(validateQrFile({ type: "image/jpeg", size: 1024 })).toBeNull();
    expect(validateQrFile({ type: "image/webp", size: 1024 })).toBeNull();
  });

  test("rejects unsupported file types and images over 2 MB", () => {
    expect(validateQrFile({ type: "image/svg+xml", size: 1024 })).toMatch(/PNG, JPG, or WebP/);
    expect(validateQrFile({ type: "image/png", size: 2 * 1024 * 1024 + 1 })).toMatch(/2 MB or smaller/);
  });

  test("treats no selected QR file as valid", () => {
    expect(validateQrFile(null)).toBeNull();
  });
});
