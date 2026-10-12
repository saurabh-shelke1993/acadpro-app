import React from "react";
import { render, screen } from "@testing-library/react";
import ParentUpiPaymentDetails from "./ParentUpiPaymentDetails";
import {
  getAcademyPaymentSettings,
  getPublicQrUrl,
} from "../services/academyPaymentSettingsService";

jest.mock("../services/academyPaymentSettingsService", () => ({
  getAcademyPaymentSettings: jest.fn(),
  getPublicQrUrl: jest.fn(),
}));

describe("ParentUpiPaymentDetails", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPublicQrUrl.mockReturnValue("https://example.test/academy-qr.png");
  });

  test("shows enabled UPI details, QR image and WhatsApp share link for the selected academy", async () => {
    getAcademyPaymentSettings.mockResolvedValue({
      academy_id: "academy-123",
      is_enabled: true,
      payee_name: "Thane City FC",
      upi_id: "thanecity@okaxis",
      qr_image_path: "academy-123/qr.png",
    });

    render(
      <ParentUpiPaymentDetails
        academyId="academy-123"
        academyName="Thane City FC"
      />
    );

    expect(await screen.findByText("thanecity@okaxis")).toBeInTheDocument();
    expect(screen.getByAltText("Thane City FC UPI QR code")).toHaveAttribute(
      "src",
      "https://example.test/academy-qr.png"
    );
    expect(getAcademyPaymentSettings).toHaveBeenCalledWith("academy-123");

    const shareLink = screen.getByRole("link", {
      name: "Share payment details on WhatsApp",
    });
    expect(shareLink).toHaveAttribute("target", "_blank");
    expect(shareLink).toHaveAttribute("rel", "noreferrer");
    expect(shareLink.href).toContain("https://wa.me/?text=");

    const shareMessage = decodeURIComponent(shareLink.href.split("?text=")[1]);
    expect(shareMessage).toContain("UPI payment details for Thane City FC");
    expect(shareMessage).toContain(["UPI payment details for Thane City FC", "Payee name: Thane City FC"].join(String.fromCharCode(10)));
    expect(shareMessage).toContain("Payee name: Thane City FC");
    expect(shareMessage).toContain("UPI ID: thanecity@okaxis");
    expect(shareMessage).toContain("UPI QR image: https://example.test/academy-qr.png");
    expect(shareMessage).toContain("Fee balances update only after the academy records the payment.");
  });

  test("shows QR-only payment details without inventing a UPI ID", async () => {
    getAcademyPaymentSettings.mockResolvedValue({
      academy_id: "academy-456",
      is_enabled: true,
      payee_name: "Academy Account",
      upi_id: null,
      qr_image_path: "academy-456/qr.webp",
    });

    render(
      <ParentUpiPaymentDetails
        academyId="academy-456"
        academyName="Academy Two"
      />
    );

    const shareLink = await screen.findByRole("link", {
      name: "Share payment details on WhatsApp",
    });
    const shareMessage = decodeURIComponent(shareLink.href.split("?text=")[1]);

    expect(shareMessage).toContain("UPI payment details for Academy Two");
    expect(shareMessage).not.toContain("UPI ID:");
    expect(shareMessage).toContain("UPI QR image: https://example.test/academy-qr.png");
  });

  test("does not show payment details when the academy has disabled them", async () => {
    getAcademyPaymentSettings.mockResolvedValue({
      academy_id: "academy-123",
      is_enabled: false,
      payee_name: "Hidden Payee",
      upi_id: "hidden@bank",
      qr_image_path: null,
    });

    render(
      <ParentUpiPaymentDetails
        academyId="academy-123"
        academyName="Thane City FC"
      />
    );

    expect(await screen.queryByText("Hidden Payee")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", {
      name: "Share payment details on WhatsApp",
    })).not.toBeInTheDocument();
  });

  test("does not query settings when no academy is selected", async () => {
    render(<ParentUpiPaymentDetails academyId="" academyName="" />);
    expect(getAcademyPaymentSettings).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", {
      name: "Share payment details on WhatsApp",
    })).not.toBeInTheDocument();
  });
});
