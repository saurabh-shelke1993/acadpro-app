import { useCallback, useEffect, useState } from "react";
import Layout from "../components/Layout";
import { getLoggedInUser } from "../utils/auth";
import { isAcademyOwner, isSuperAdmin } from "../utils/roles";
import {
  getAcademyPaymentSettings,
  getAcademyPaymentSettingsAcademies,
  getPublicQrUrl,
  saveAcademyPaymentSettings,
  validateQrFile,
  isValidUpiId,
} from "../services/academyPaymentSettingsService";
import "./AcademyUpiSettings.css";

function AcademyUpiSettings() {
  const [user, setUser] = useState(null);
  const [academies, setAcademies] = useState([]);
  const [academyId, setAcademyId] = useState("");
  const [settings, setSettings] = useState(null);
  const [upiId, setUpiId] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [qrFile, setQrFile] = useState(null);
  const [removeQr, setRemoveQr] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const canManage = isAcademyOwner(user);
  const isAdmin = isSuperAdmin(user);
  const selectedAcademy = academies.find((academy) => academy.id === academyId) || null;

  const loadSettings = useCallback(async (selectedAcademyId) => {
    if (!selectedAcademyId) {
      setSettings(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const nextSettings = await getAcademyPaymentSettings(selectedAcademyId);
      setSettings(nextSettings);
      setUpiId(nextSettings?.upi_id || "");
      setPayeeName(nextSettings?.payee_name || "");
      setIsEnabled(Boolean(nextSettings?.is_enabled));
      setQrFile(null);
      setRemoveQr(false);
    } catch (loadError) {
      setError(loadError.message || "Unable to load academy payment settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      setLoading(true);
      setError("");
      try {
        const currentUser = await getLoggedInUser();
        if (!active) return;
        if (!currentUser || (!isAcademyOwner(currentUser) && !isSuperAdmin(currentUser))) {
          setError("You do not have permission to access Academy UPI Settings.");
          setLoading(false);
          return;
        }

        const nextAcademies = await getAcademyPaymentSettingsAcademies(currentUser);
        if (!active) return;
        setUser(currentUser);
        setAcademies(nextAcademies);

        const initialAcademyId = isAcademyOwner(currentUser)
          ? currentUser.academy_id || ""
          : nextAcademies[0]?.id || "";
        setAcademyId(initialAcademyId);
        if (!initialAcademyId) setLoading(false);
      } catch (loadError) {
        if (active) {
          setError(loadError.message || "Unable to initialize Academy UPI Settings.");
          setLoading(false);
        }
      }
    };

    initialize();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (academyId) loadSettings(academyId);
  }, [academyId, loadSettings]);

  const handleQrChange = (event) => {
    const file = event.target.files?.[0] || null;
    const fileError = validateQrFile(file);
    setError(fileError || "");
    setNotice("");
    setQrFile(fileError ? null : file);
    if (!fileError && file) setRemoveQr(false);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!canManage || !academyId) return;
    setError("");
    setNotice("");

    if (!isValidUpiId(upiId)) {
      setError("Enter a valid UPI ID, for example name@bank.");
      return;
    }

    setSaving(true);
    try {
      const result = await saveAcademyPaymentSettings({
        user,
        academyId,
        currentSettings: settings,
        upiId,
        payeeName,
        isEnabled,
        qrFile,
        removeQr,
      });
      setSettings(result.data);
      setUpiId(result.data.upi_id || "");
      setPayeeName(result.data.payee_name || "");
      setIsEnabled(Boolean(result.data.is_enabled));
      setQrFile(null);
      setRemoveQr(false);
      setNotice(result.warning || "Academy UPI settings saved.");
    } catch (saveError) {
      setError(saveError.message || "Unable to save academy UPI settings.");
    } finally {
      setSaving(false);
    }
  };

  const qrUrl = settings?.qr_image_path ? getPublicQrUrl(settings.qr_image_path) : "";

  return (
    <Layout>
      <main className="academy-upi-page">
        <header className="academy-upi-header">
          <div>
            <span className="academy-upi-eyebrow">Finance · P1.2</span>
            <h1>Academy UPI Settings</h1>
            <p>Configure the UPI details and QR code parents can use to pay academy fees.</p>
          </div>
          {canManage ? (
            <span className={isEnabled ? "academy-upi-status academy-upi-status-enabled" : "academy-upi-status"}>
              {isEnabled ? "Enabled for parents" : "Disabled for parents"}
            </span>
          ) : null}
        </header>

        {error ? <div className="academy-upi-alert academy-upi-alert-error" role="alert">{error}</div> : null}
        {notice ? <div className="academy-upi-alert academy-upi-alert-success" role="status">{notice}</div> : null}

        {isAdmin ? (
          <section className="academy-upi-panel academy-upi-admin-note">
            <label className="academy-upi-field">
              <span>Academy</span>
              <select value={academyId} onChange={(event) => setAcademyId(event.target.value)}>
                {academies.map((academy) => (
                  <option key={academy.id} value={academy.id}>{academy.academy_name}</option>
                ))}
              </select>
            </label>
            <p>Super Admin access is read-only. Payment settings are managed by each Academy Owner.</p>
          </section>
        ) : null}

        {loading ? (
          <section className="academy-upi-panel academy-upi-state">
            <span className="academy-upi-spinner" aria-hidden="true" />
            <strong>Loading payment settings…</strong>
          </section>
        ) : !selectedAcademy ? (
          <section className="academy-upi-panel academy-upi-state">
            <h2>No academy available</h2>
            <p>There is no academy linked to this account.</p>
          </section>
        ) : (
          <div className="academy-upi-grid">
            <section className="academy-upi-panel">
              <div className="academy-upi-panel-heading">
                <div>
                  <span className="academy-upi-eyebrow">Payment destination</span>
                  <h2>{selectedAcademy.academy_name}</h2>
                </div>
                {settings?.is_enabled ? <span className="academy-upi-pill">Enabled</span> : <span className="academy-upi-pill academy-upi-pill-muted">Disabled</span>}
              </div>

              <form onSubmit={handleSave}>
                <label className="academy-upi-field">
                  <span>Payee / account holder name {canManage ? "*" : ""}</span>
                  <input
                    value={payeeName}
                    onChange={(event) => setPayeeName(event.target.value)}
                    placeholder="Name shown in the UPI app"
                    disabled={!canManage || saving}
                    maxLength={120}
                  />
                </label>

                <label className="academy-upi-field">
                  <span>UPI ID</span>
                  <input
                    value={upiId}
                    onChange={(event) => setUpiId(event.target.value)}
                    placeholder="academy@bank"
                    disabled={!canManage || saving}
                    maxLength={100}
                    aria-invalid={upiId.length > 0 && !isValidUpiId(upiId)}
                  />
                  <small>Optional when a QR code is configured.</small>
                </label>

                <div className="academy-upi-qr-row">
                  <div className="academy-upi-qr-preview">
                    {qrFile ? (
                      <img src={URL.createObjectURL(qrFile)} alt="Selected UPI QR preview" />
                    ) : qrUrl && !removeQr ? (
                      <img src={qrUrl} alt="Academy UPI QR code" />
                    ) : (
                      <div className="academy-upi-qr-placeholder"><span aria-hidden="true">▦</span><small>No QR image</small></div>
                    )}
                  </div>
                  <div className="academy-upi-qr-controls">
                    <strong>UPI QR image</strong>
                    <p>PNG, JPG or WebP · maximum 2 MB.</p>
                    {canManage ? (
                      <>
                        <label className="academy-upi-file-button">
                          {qrFile ? "Choose a different image" : "Upload QR image"}
                          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleQrChange} disabled={saving} />
                        </label>
                        {settings?.qr_image_path && !removeQr && !qrFile ? (
                          <button type="button" className="academy-upi-text-button" onClick={() => setRemoveQr(true)} disabled={saving}>Remove current QR</button>
                        ) : null}
                        {removeQr ? (
                          <button type="button" className="academy-upi-text-button" onClick={() => setRemoveQr(false)} disabled={saving}>Keep current QR</button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>

                {canManage ? (
                  <>
                    <label className="academy-upi-toggle">
                      <input type="checkbox" checked={isEnabled} onChange={(event) => setIsEnabled(event.target.checked)} disabled={saving} />
                      <span>
                        <strong>Show payment details to parents</strong>
                        <small>Only parents linked to a child in this academy can view enabled settings.</small>
                      </span>
                    </label>
                    <div className="academy-upi-form-footer">
                      <span>Changes take effect after saving.</span>
                      <button className="academy-upi-button" type="submit" disabled={saving}>
                        {saving ? "Saving…" : "Save settings"}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="academy-upi-readonly-note">Read-only view. Only this academy's owner can change payment settings.</p>
                )}
              </form>
            </section>

            <aside className="academy-upi-panel academy-upi-guidance">
              <span className="academy-upi-eyebrow">How it works</span>
              <h2>Manual UPI collection</h2>
              <ol>
                <li>Parents view these details in their Financial Overview.</li>
                <li>Parents make the payment in their own UPI app.</li>
                <li>The Academy Owner verifies the transaction in the bank or UPI app and records the collection through the existing payment workflow.</li>
              </ol>
              <p>Displaying UPI details does not mark any fee as paid. Payment submissions and UTR verification are not part of this phase.</p>
            </aside>
          </div>
        )}
      </main>
    </Layout>
  );
}

export default AcademyUpiSettings;
