import { useEffect, useState } from "react";
import {
  getAcademyPaymentSettings,
  getPublicQrUrl,
} from "../services/academyPaymentSettingsService";
import "./ParentUpiPaymentDetails.css";

function ParentUpiPaymentDetails({ academyId, academyName }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copyNotice, setCopyNotice] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!academyId) {
        setSettings(null);
        return;
      }
      setLoading(true);
      setCopyNotice("");
      try {
        const result = await getAcademyPaymentSettings(academyId);
        if (active) setSettings(result?.is_enabled ? result : null);
      } catch {
        // RLS remains the authorization boundary; avoid exposing internal errors in the parent UI.
        if (active) setSettings(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [academyId]);

  const copyUpiId = async () => {
    if (!settings?.upi_id || !navigator.clipboard?.writeText) {
      setCopyNotice("Copy is not available in this browser.");
      return;
    }
    try {
      await navigator.clipboard.writeText(settings.upi_id);
      setCopyNotice("UPI ID copied.");
    } catch {
      setCopyNotice("Unable to copy UPI ID. You can select it manually.");
    }
  };

  if (loading || !settings) {
    if (loading) {
      return (
        <section className="parent-upi-section" aria-label="Academy UPI payment details">
          <p className="parent-upi-muted">Loading academy payment details…</p>
        </section>
      );
    }
    return null;
  }

  const qrUrl = settings.qr_image_path ? getPublicQrUrl(settings.qr_image_path) : "";
  const shareMessage = [
    `UPI payment details for ${academyName || "your academy"}`,
    `Payee name: ${settings.payee_name}`,
    settings.upi_id ? `UPI ID: ${settings.upi_id}` : null,
    qrUrl ? `UPI QR image: ${qrUrl}` : null,
    "",
    "Please verify the transaction with the academy. Fee balances update only after the academy records the payment.",
  ].filter(Boolean).join(String.fromCharCode(10));
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;

  return (
    <section className="parent-upi-section" aria-labelledby="parent-upi-heading">
      <div className="parent-upi-heading">
        <div>
          <span className="parent-upi-eyebrow">Pay your academy</span>
          <h2 id="parent-upi-heading">UPI payment details</h2>
          <p>Use these details to make a fee payment to {academyName || "your academy"}.</p>
        </div>
        <span className="parent-upi-enabled-label">UPI available</span>
      </div>

      <div className="parent-upi-content">
        {qrUrl ? (
          <div className="parent-upi-qr">
            <img src={qrUrl} alt={`${academyName || "Academy"} UPI QR code`} />
            <a href={qrUrl} target="_blank" rel="noreferrer">Open QR image</a>
          </div>
        ) : null}
        <div className="parent-upi-details">
          <div>
            <span>Payee name</span>
            <strong>{settings.payee_name}</strong>
          </div>
          {settings.upi_id ? (
            <div>
              <span>UPI ID</span>
              <strong className="parent-upi-id">{settings.upi_id}</strong>
              <button type="button" className="parent-upi-copy" onClick={copyUpiId}>Copy UPI ID</button>
            </div>
          ) : null}
          {copyNotice ? <p className="parent-upi-copy-notice" role="status">{copyNotice}</p> : null}
          <a
            className="parent-upi-whatsapp-share"
            href={whatsappShareUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Share payment details on WhatsApp"
          >
            <span aria-hidden="true">↗</span> Share payment details on WhatsApp
          </a>
        </div>
      </div>

      <p className="parent-upi-disclaimer">
        Important: This section only displays payment details. Your fee balance will change only after the academy verifies and records the payment.
      </p>
    </section>
  );
}

export default ParentUpiPaymentDetails;
