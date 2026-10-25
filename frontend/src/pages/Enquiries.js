import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { useSearchParams } from "react-router-dom";
import { getLoggedInUser, isSuperAdmin } from "../utils/auth";
import { isAcademyOwner, isCoach } from "../utils/roles";
import { getAccessibleAcademies, getAccessibleBatches, getAccessibleCenters } from "../utils/dataScope";
import {
  createEnquiry,
  ENQUIRY_SOURCES,
  ENQUIRY_STATUSES,
  fetchEnquiries,
  findPotentialDuplicateEnquiries,
  validateQuickEnquiry,
  validateEnquiryStatusUpdate,
  updateEnquiryStatus,
  updateEnquiry,
  deleteEnquiry,
  convertEnquiryToPlayer,
  validateEnquiryConversion,
} from "../services/enquiriesService";
import "./Enquiries.css";

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const EMPTY_FORM = {
  playerName: "",
  parentPhone: "",
  dob: "",
  source: "",
  centerId: "",
  notes: "",
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const statusLabel = (value) =>
  ENQUIRY_STATUSES.find((status) => status.value === value)?.label || value || "New";

function Enquiries() {
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [academies, setAcademies] = useState([]);
  const [centers, setCenters] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [academyFilter, setAcademyFilter] = useState("");
  const [centerFilter, setCenterFilter] = useState(() => searchParams.get("centerId") || "");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [duplicateCandidates, setDuplicateCandidates] = useState([]);
  const [pendingPayload, setPendingPayload] = useState(null);
  const [editingEnquiryId, setEditingEnquiryId] = useState(null);
  const [editStatus, setEditStatus] = useState("new");
  const [editTrialDate, setEditTrialDate] = useState("");
  const [statusSavingId, setStatusSavingId] = useState(null);
  const [statusError, setStatusError] = useState("");
  const [editingEnquiry, setEditingEnquiry] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deletingEnquiryId, setDeletingEnquiryId] = useState(null);
  const [conversionEnquiry, setConversionEnquiry] = useState(null);
  const [conversionForm, setConversionForm] = useState({
    parentName: "",
    parentEmail: "",
    parentAddress: "",
    gender: "",
    joiningDate: today(),
    centerId: "",
    batchId: "",
  });
  const [conversionBatches, setConversionBatches] = useState([]);
  const [conversionLoadingBatches, setConversionLoadingBatches] = useState(false);
  const [conversionSaving, setConversionSaving] = useState(false);
  const [conversionError, setConversionError] = useState("");

  const isAdmin = isSuperAdmin(user);
  const isOwner = isAcademyOwner(user);
  const isCoachUser = isCoach(user);
  const canCreate = isOwner || isCoachUser;

  const loadEnquiries = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await fetchEnquiries();
      setEnquiries(rows);
    } catch (loadError) {
      setError(loadError.message || "Unable to load enquiries. Please retry.");
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

        if (
          !currentUser ||
          (!isSuperAdmin(currentUser) && !isAcademyOwner(currentUser) && !isCoach(currentUser))
        ) {
          setError("You do not have permission to access Enquiries.");
          setLoading(false);
          return;
        }

        setUser(currentUser);
        setAcademyFilter(isSuperAdmin(currentUser) ? "" : currentUser.academy_id || "");

        const [nextAcademies, nextCenters, nextEnquiries] = await Promise.all([
          getAccessibleAcademies(currentUser),
          getAccessibleCenters(currentUser),
          fetchEnquiries(),
        ]);
        if (!active) return;

        setAcademies(nextAcademies || []);
        setCenters(nextCenters || []);
        setEnquiries(nextEnquiries || []);

        if (isCoach(currentUser) && nextCenters?.length === 1) {
          setForm((current) => ({ ...current, centerId: nextCenters[0].id }));
        }
      } catch (initializeError) {
        if (active) {
          setError(initializeError.message || "Unable to initialize Enquiries.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    initialize();
    return () => { active = false; };
  }, []);

  const academyNames = useMemo(
    () => new Map(academies.map((academy) => [academy.id, academy.academy_name])),
    [academies]
  );
  const centerNames = useMemo(
    () => new Map(centers.map((center) => [center.id, center.center_name])),
    [centers]
  );

  const filterCenters = useMemo(
    () => centers.filter((center) => !academyFilter || center.academy_id === academyFilter),
    [centers, academyFilter]
  );

  const visibleEnquiries = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase();
    return enquiries.filter((enquiry) => {
      if (academyFilter && enquiry.academy_id !== academyFilter) return false;
      if (centerFilter && enquiry.assigned_center_id !== centerFilter) return false;
      if (statusFilter && enquiry.status !== statusFilter) return false;
      if (sourceFilter && enquiry.inquiry_source !== sourceFilter) return false;
      if (!term) return true;

      const name = String(enquiry.player_name || "").toLocaleLowerCase();
      const phone = String(enquiry.phone || "").toLocaleLowerCase();
      return name.includes(term) || phone.includes(term);
    });
  }, [enquiries, academyFilter, centerFilter, statusFilter, sourceFilter, searchTerm]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError("");
    setNotice("");
    setDuplicateCandidates([]);
    setPendingPayload(null);
  };

  const resetCreateForm = () => {
    setForm({
      ...EMPTY_FORM,
      centerId: isCoachUser && centers.length === 1 ? centers[0].id : "",
    });
    setFormError("");
    setDuplicateCandidates([]);
    setPendingPayload(null);
    setShowForm(false);
  };

  const saveEnquiry = async (payload) => {
    setSaving(true);
    setFormError("");
    setNotice("");
    try {
      await createEnquiry(payload);
      resetCreateForm();
      setNotice("Enquiry created successfully.");
      await loadEnquiries();
    } catch (saveError) {
      setFormError(saveError.message || "Unable to create the enquiry.");
    } finally {
      setSaving(false);
      setCheckingDuplicates(false);
    }
  };

  const handleCreateSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    setNotice("");

    const validationError = validateQuickEnquiry(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    if (isCoachUser && !form.centerId) {
      setFormError("Select one of your authorized centers before creating this enquiry.");
      return;
    }
    if (form.centerId && !centers.some((center) => center.id === form.centerId)) {
      setFormError("The selected center is not in your accessible center list. Refresh and try again.");
      return;
    }

    const payload = {
      ...form,
      playerName: form.playerName.trim(),
      parentPhone: form.parentPhone,
      source: form.source || null,
      centerId: form.centerId || null,
      notes: form.notes.trim(),
    };

    setCheckingDuplicates(true);
    try {
      const duplicates = await findPotentialDuplicateEnquiries({
        academyId: user?.academy_id,
        playerName: payload.playerName,
        parentPhone: payload.parentPhone,
        dob: payload.dob,
      });
      if (duplicates.length) {
        setDuplicateCandidates(duplicates);
        setPendingPayload(payload);
      } else {
        await saveEnquiry(payload);
      }
    } catch (duplicateError) {
      setFormError(duplicateError.message || "Unable to check possible duplicates. Please retry.");
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const handleCreateAnyway = async () => {
    if (!pendingPayload) return;
    const payload = pendingPayload;
    setDuplicateCandidates([]);
    setPendingPayload(null);
    await saveEnquiry(payload);
  };

  const startStatusEdit = (enquiry) => {
    setEditingEnquiryId(enquiry.id);
    setEditStatus(enquiry.status || "new");
    setEditTrialDate(enquiry.trial_date || "");
    setStatusError("");
  };

  const cancelStatusEdit = () => {
    setEditingEnquiryId(null);
    setStatusError("");
  };

  const saveStatusEdit = async (enquiry) => {
    const validationError = validateEnquiryStatusUpdate({
      status: editStatus,
      trialDate: editTrialDate,
    });
    if (validationError) {
      setStatusError(validationError);
      return;
    }

    setStatusSavingId(enquiry.id);
    setStatusError("");
    setNotice("");
    try {
      await updateEnquiryStatus(enquiry, editStatus, editTrialDate);
      setEditingEnquiryId(null);
      setNotice("Enquiry status updated successfully.");
      await loadEnquiries();
    } catch (updateError) {
      setStatusError(updateError.message || "Unable to update enquiry status. Please retry.");
    } finally {
      setStatusSavingId(null);
    }
  };

  const openEditEnquiry = (enquiry) => {
    setEditingEnquiry(enquiry);
    setEditForm({
      playerName: enquiry.player_name || "",
      parentPhone: enquiry.phone || "",
      dob: enquiry.dob || "",
      source: enquiry.inquiry_source || "",
      centerId: enquiry.assigned_center_id || "",
      notes: enquiry.notes || "",
    });
    setEditStatus(enquiry.status || "new");
    setEditTrialDate(enquiry.trial_date || "");
    setEditError("");
  };

  const saveEnquiryEdit = async (event) => {
    event.preventDefault();
    if (!editingEnquiry || !isOwner) return;
    const validationError = validateQuickEnquiry(editForm) || validateEnquiryStatusUpdate({
      status: editStatus,
      trialDate: editTrialDate,
    });
    if (validationError) {
      setEditError(validationError);
      return;
    }
    if (editForm.centerId && !centers.some((center) => center.id === editForm.centerId)) {
      setEditError("Select an active center in your academy.");
      return;
    }
    setEditSaving(true);
    setEditError("");
    setNotice("");
    try {
      await updateEnquiry(editingEnquiry, {
        ...editForm,
        status: editStatus,
        trialDate: editTrialDate,
      });
      setEditingEnquiry(null);
      setNotice("Enquiry updated successfully.");
      await loadEnquiries();
    } catch (updateError) {
      setEditError(updateError.message || "Unable to update enquiry. Please retry.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteEnquiry = async (enquiry) => {
    if (!isOwner || enquiry.status === "converted") return;
    const confirmed = window.confirm(`Delete the enquiry for ${enquiry.player_name}? This action cannot be undone.`);
    if (!confirmed) return;
    setDeletingEnquiryId(enquiry.id);
    setError("");
    setNotice("");
    try {
      await deleteEnquiry(enquiry.id);
      setNotice("Enquiry deleted successfully.");
      if (editingEnquiry?.id === enquiry.id) setEditingEnquiry(null);
      await loadEnquiries();
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete enquiry. Please retry.");
    } finally {
      setDeletingEnquiryId(null);
    }
  };

  const openConversionForm = (enquiry) => {
    const initialCenterId = enquiry.assigned_center_id || "";
    setConversionEnquiry(enquiry);
    setConversionForm({
      parentName: "",
      parentEmail: "",
      parentAddress: "",
      gender: "",
      joiningDate: today(),
      centerId: initialCenterId,
      batchId: "",
    });
    setConversionBatches([]);
    setConversionError("");
  };

  const closeConversionForm = () => {
    if (conversionSaving) return;
    setConversionEnquiry(null);
    setConversionBatches([]);
    setConversionError("");
  };

  useEffect(() => {
    let active = true;
    const loadConversionBatches = async () => {
      if (!conversionEnquiry || !conversionForm.centerId || !user || !isOwner) {
        setConversionBatches([]);
        setConversionLoadingBatches(false);
        return;
      }

      setConversionLoadingBatches(true);
      setConversionError("");
      try {
        const batchesForCenter = await getAccessibleBatches(user, conversionForm.centerId);
        if (active) setConversionBatches(batchesForCenter || []);
      } catch (batchError) {
        if (active) {
          setConversionBatches([]);
          setConversionError(batchError.message || "Unable to load active batches for this center.");
        }
      } finally {
        if (active) setConversionLoadingBatches(false);
      }
    };

    loadConversionBatches();
    return () => { active = false; };
  }, [conversionEnquiry, conversionForm.centerId, user, isOwner]);

  const updateConversionForm = (field, value) => {
    setConversionForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "centerId" ? { batchId: "" } : {}),
    }));
    setConversionError("");
  };

  const submitConversion = async (event) => {
    event.preventDefault();
    if (!conversionEnquiry || !isOwner) return;

    const validationError = validateEnquiryConversion(conversionForm);
    if (validationError) {
      setConversionError(validationError);
      return;
    }
    if (!centers.some((center) => center.id === conversionForm.centerId)) {
      setConversionError("Select an active center in your academy.");
      return;
    }
    if (!conversionBatches.some((batch) => batch.id === conversionForm.batchId)) {
      setConversionError("Select an active batch belonging to the selected center.");
      return;
    }
    if (
      conversionEnquiry.assigned_center_id &&
      conversionEnquiry.assigned_center_id !== conversionForm.centerId
    ) {
      setConversionError("The conversion center must match the enquiry center. Close this form and update the enquiry center first.");
      return;
    }

    setConversionSaving(true);
    setConversionError("");
    setNotice("");
    try {
      const result = await convertEnquiryToPlayer({
        enquiryId: conversionEnquiry.id,
        ...conversionForm,
      });
      setConversionEnquiry(null);
      setNotice(
        result?.alreadyConverted
          ? "This enquiry was already converted. No additional player was created."
          : "Enquiry converted successfully. The player and parent were created using the transactional enrollment workflow."
      );
      await loadEnquiries();
    } catch (conversionFailure) {
      setConversionError(conversionFailure.message || "Unable to convert this enquiry. No partial conversion should be committed.");
    } finally {
      setConversionSaving(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setCenterFilter("");
    setStatusFilter("");
    setSourceFilter("");
    setAcademyFilter(isAdmin ? "" : user?.academy_id || "");
  };

  const showAcademyFilter = isAdmin;

  return (
    <Layout>
      <section className="enquiries-page" aria-labelledby="enquiries-title">
        <header className="enquiries-page-header">
          <div>
            <span className="enquiries-eyebrow">Admissions</span>
            <h1 id="enquiries-title">Enquiries</h1>
            <p>Track prospective players before they are registered in AcadPro.</p>
          </div>
          <div className="enquiries-header-actions">
            <span className="enquiries-count" aria-live="polite">
              <strong>{visibleEnquiries.length}</strong>
              <span>{visibleEnquiries.length === 1 ? "enquiry" : "enquiries"}</span>
            </span>
            {canCreate && (
              <button
                type="button"
                className="enquiries-primary-button"
                onClick={() => {
                  setShowForm((current) => !current);
                  setFormError("");
                  setDuplicateCandidates([]);
                  setPendingPayload(null);
                }}
                aria-expanded={showForm}
              >
                {showForm ? "Close form" : "+ Add Enquiry"}
              </button>
            )}
          </div>
        </header>

        {notice && <div className="enquiries-alert enquiries-alert-success" role="status">{notice}</div>}
        {error && (
          <div className="enquiries-alert enquiries-alert-error" role="alert">
            <span>{error}</span>
            <button type="button" className="enquiries-secondary-button" onClick={loadEnquiries}>Retry list</button>
          </div>
        )}

        {showForm && canCreate && (
          <section className="enquiries-form-card" aria-labelledby="enquiry-form-title">
            <div className="enquiries-section-heading">
              <div>
                <h2 id="enquiry-form-title">Quick capture</h2>
                <p>Only player name, parent contact and date of birth are required.</p>
              </div>
            </div>

            <form onSubmit={handleCreateSubmit} noValidate>
              <div className="enquiries-form-grid">
                <label className="enquiries-field">
                  Player name <span aria-hidden="true">*</span>
                  <input
                    autoComplete="off"
                    maxLength={120}
                    value={form.playerName}
                    onChange={(event) => updateForm("playerName", event.target.value)}
                    required
                  />
                </label>
                <label className="enquiries-field">
                  Parent contact <span aria-hidden="true">*</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={20}
                    placeholder="10-digit mobile number"
                    value={form.parentPhone}
                    onChange={(event) => updateForm("parentPhone", event.target.value)}
                    required
                  />
                </label>
                <label className="enquiries-field">
                  Player date of birth <span aria-hidden="true">*</span>
                  <input
                    type="date"
                    max={today()}
                    value={form.dob}
                    onChange={(event) => updateForm("dob", event.target.value)}
                    required
                  />
                </label>
                <label className="enquiries-field">
                  Source <span className="enquiries-optional">(optional)</span>
                  <select value={form.source} onChange={(event) => updateForm("source", event.target.value)}>
                    <option value="">Not specified</option>
                    {ENQUIRY_SOURCES.map((source) => <option key={source} value={source}>{source}</option>)}
                  </select>
                </label>
                <label className="enquiries-field">
                  Center {isOwner && <span className="enquiries-optional">(optional)</span>}
                  {isCoachUser && <span aria-hidden="true">*</span>}
                  <select
                    value={form.centerId}
                    onChange={(event) => updateForm("centerId", event.target.value)}
                    disabled={isCoachUser && centers.length === 1}
                    required={isCoachUser}
                  >
                    {isOwner && <option value="">Not assigned yet</option>}
                    {isCoachUser && <option value="">Select authorized center</option>}
                    {centers.map((center) => (
                      <option key={center.id} value={center.id}>{center.center_name}</option>
                    ))}
                  </select>
                </label>
                <label className="enquiries-field enquiries-field-wide">
                  Internal note <span className="enquiries-optional">(optional)</span>
                  <textarea
                    rows={2}
                    maxLength={2000}
                    value={form.notes}
                    onChange={(event) => updateForm("notes", event.target.value)}
                    placeholder="Any useful context for follow-up"
                  />
                </label>
              </div>

              {formError && <div className="enquiries-alert enquiries-alert-error" role="alert">{formError}</div>}

              {duplicateCandidates.length > 0 && (
                <div className="enquiries-duplicate-warning" role="alert">
                  <h3>Possible duplicate enquiry</h3>
                  <p>We found existing enquiry records with the same parent contact and matching player name or date of birth. Review these before continuing. This warning does not automatically block a legitimate sibling enquiry.</p>
                  <ul>
                    {duplicateCandidates.map((candidate) => (
                      <li key={candidate.id}>
                        <strong>{candidate.player_name}</strong>
                        <span>DOB: {formatDate(candidate.dob)} · {statusLabel(candidate.status)} · {formatDate(candidate.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="enquiries-form-actions">
                    <button type="button" className="enquiries-secondary-button" onClick={() => {
                      setDuplicateCandidates([]);
                      setPendingPayload(null);
                    }} disabled={saving}>Review details</button>
                    <button type="button" className="enquiries-primary-button" onClick={handleCreateAnyway} disabled={saving}>
                      {saving ? "Creating…" : "Create anyway"}
                    </button>
                  </div>
                </div>
              )}

              <div className="enquiries-form-actions">
                <button type="button" className="enquiries-secondary-button" onClick={resetCreateForm} disabled={saving || checkingDuplicates}>Cancel</button>
                <button type="submit" className="enquiries-primary-button" disabled={saving || checkingDuplicates || duplicateCandidates.length > 0}>
                  {checkingDuplicates ? "Checking duplicates…" : saving ? "Saving…" : "Save Enquiry"}
                </button>
              </div>
            </form>
          </section>
        )}

        {conversionEnquiry && isOwner && (
          <div className="enquiries-modal-backdrop">
            <section
              className="enquiries-conversion-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="enquiry-conversion-title"
            >
              <header className="enquiries-section-heading">
                <div>
                  <span className="enquiries-eyebrow">Enrollment</span>
                  <h2 id="enquiry-conversion-title">Convert enquiry to Player</h2>
                  <p>Complete the enrollment details missing from this enquiry. Player creation and enquiry conversion happen in one database transaction.</p>
                </div>
                <button type="button" className="enquiries-secondary-button" onClick={closeConversionForm} disabled={conversionSaving}>Close</button>
              </header>

              <div className="enquiries-conversion-summary">
                <span>Player</span><strong>{conversionEnquiry.player_name}</strong>
                <span>Parent contact</span><strong>{conversionEnquiry.phone}</strong>
                <span>Date of birth</span><strong>{formatDate(conversionEnquiry.dob)}</strong>
              </div>

              <form onSubmit={submitConversion} noValidate>
                <div className="enquiries-form-grid">
                  <label className="enquiries-field">
                    Parent name <span aria-hidden="true">*</span>
                    <input
                      value={conversionForm.parentName}
                      onChange={(event) => updateConversionForm("parentName", event.target.value)}
                      maxLength={120}
                      autoComplete="name"
                      required
                      disabled={conversionSaving}
                    />
                  </label>
                  <label className="enquiries-field">
                    Parent email <span className="enquiries-optional">(optional)</span>
                    <input
                      type="email"
                      value={conversionForm.parentEmail}
                      onChange={(event) => updateConversionForm("parentEmail", event.target.value)}
                      autoComplete="email"
                      disabled={conversionSaving}
                    />
                  </label>
                  <label className="enquiries-field enquiries-field-wide">
                    Parent address <span className="enquiries-optional">(optional)</span>
                    <textarea
                      rows={2}
                      value={conversionForm.parentAddress}
                      onChange={(event) => updateConversionForm("parentAddress", event.target.value)}
                      maxLength={1000}
                      autoComplete="street-address"
                      disabled={conversionSaving}
                    />
                  </label>
                  <label className="enquiries-field">
                    Gender <span aria-hidden="true">*</span>
                    <select value={conversionForm.gender} onChange={(event) => updateConversionForm("gender", event.target.value)} required disabled={conversionSaving}>
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </label>
                  <label className="enquiries-field">
                    Joining date <span aria-hidden="true">*</span>
                    <input
                      type="date"
                      value={conversionForm.joiningDate}
                      onChange={(event) => updateConversionForm("joiningDate", event.target.value)}
                      required
                      disabled={conversionSaving}
                    />
                  </label>
                  <label className="enquiries-field">
                    Center <span aria-hidden="true">*</span>
                    <select
                      value={conversionForm.centerId}
                      onChange={(event) => updateConversionForm("centerId", event.target.value)}
                      required
                      disabled={conversionSaving || Boolean(conversionEnquiry.assigned_center_id)}
                    >
                      <option value="">Select center</option>
                      {centers.map((center) => (
                        <option key={center.id} value={center.id}>{center.center_name}</option>
                      ))}
                    </select>
                    {conversionEnquiry.assigned_center_id && <span className="enquiries-optional">Must match the enquiry's assigned center.</span>}
                  </label>
                  <label className="enquiries-field">
                    Batch <span aria-hidden="true">*</span>
                    <select
                      value={conversionForm.batchId}
                      onChange={(event) => updateConversionForm("batchId", event.target.value)}
                      required
                      disabled={conversionSaving || !conversionForm.centerId || conversionLoadingBatches}
                    >
                      <option value="">{conversionLoadingBatches ? "Loading batches…" : "Select batch"}</option>
                      {conversionBatches.map((batch) => (
                        <option key={batch.id} value={batch.id}>{batch.batch_name}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {conversionError && <div className="enquiries-alert enquiries-alert-error" role="alert">{conversionError}</div>}

                <div className="enquiries-form-actions">
                  <button type="button" className="enquiries-secondary-button" onClick={closeConversionForm} disabled={conversionSaving}>Cancel</button>
                  <button type="submit" className="enquiries-primary-button" disabled={conversionSaving || conversionLoadingBatches}>
                    {conversionSaving ? "Converting…" : "Confirm conversion"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        <section className="enquiries-list-section" aria-labelledby="enquiries-list-title">
          <div className="enquiries-list-heading">
            <div>
              <h2 id="enquiries-list-title">Enquiry list</h2>
              <p>Search by player name or parent contact, then narrow the list with filters.</p>
            </div>
            <button type="button" className="enquiries-secondary-button" onClick={clearFilters}>Clear filters</button>
          </div>

          <div className="enquiries-filters">
            <label className="enquiries-filter enquiries-search">
              <span>Search</span>
              <input
                type="search"
                placeholder="Player name or contact"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>
            {showAcademyFilter && (
              <label className="enquiries-filter">
                <span>Academy</span>
                <select value={academyFilter} onChange={(event) => {
                  setAcademyFilter(event.target.value);
                  setCenterFilter("");
                }}>
                  <option value="">All academies</option>
                  {academies.map((academy) => <option key={academy.id} value={academy.id}>{academy.academy_name}</option>)}
                </select>
              </label>
            )}
            <label className="enquiries-filter">
              <span>Center</span>
              <select value={centerFilter} onChange={(event) => setCenterFilter(event.target.value)}>
                <option value="">All accessible centers</option>
                {filterCenters.map((center) => <option key={center.id} value={center.id}>{center.center_name}</option>)}
              </select>
            </label>
            <label className="enquiries-filter">
              <span>Status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All statuses</option>
                {ENQUIRY_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
              </select>
            </label>
            <label className="enquiries-filter">
              <span>Source</span>
              <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
                <option value="">All sources</option>
                {ENQUIRY_SOURCES.map((source) => <option key={source} value={source}>{source}</option>)}
              </select>
            </label>
          </div>

          <div className="enquiries-table-meta">
            <span>{loading ? "Loading enquiries…" : `Showing ${visibleEnquiries.length} of ${enquiries.length} accessible enquiries`}</span>
            {isAdmin && <span>Read-only · Super Admin</span>}
            {isCoachUser && <span>Authorized centers only</span>}
          </div>

          {loading ? (
            <div className="enquiries-state" role="status">Loading enquiries…</div>
          ) : visibleEnquiries.length === 0 ? (
            <div className="enquiries-state">
              <strong>{enquiries.length === 0 ? "No enquiries yet" : "No matching enquiries"}</strong>
              <p>{enquiries.length === 0
                ? (canCreate ? "Add an enquiry when a prospective player or parent contacts the academy." : "Enquiries will appear here when they are recorded.")
                : "Try changing your search or filters."}</p>
              {enquiries.length > 0 && <button type="button" className="enquiries-secondary-button" onClick={clearFilters}>Clear filters</button>}
            </div>
          ) : (
            <div className="enquiries-table-wrap">
              <table className="enquiries-table">
                <thead>
                  <tr>
                    {isAdmin && <th scope="col">Academy</th>}
                    <th scope="col">Player</th>
                    <th scope="col">Parent contact</th>
                    <th scope="col">Date of birth</th>
                    <th scope="col">Source</th>
                    <th scope="col">Center</th>
                    <th scope="col">Status</th>
                    <th scope="col">Trial date</th>
                    <th scope="col">Created</th>
                    {!isAdmin && <th scope="col">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {visibleEnquiries.map((enquiry) => (
                    <tr key={enquiry.id}>
                      {isAdmin && <td>{academyNames.get(enquiry.academy_id) || "—"}</td>}
                      <td><strong>{enquiry.player_name}</strong></td>
                      <td>{enquiry.phone}</td>
                      <td>{formatDate(enquiry.dob)}</td>
                      <td>{enquiry.inquiry_source || "Not specified"}</td>
                      <td>{centerNames.get(enquiry.assigned_center_id) || "Unassigned"}</td>
                      <td>
                        {editingEnquiryId === enquiry.id ? (
                          <div className="enquiries-status-editor">
                            <label className="enquiries-inline-field">
                              <span>Status</span>
                              <select
                                value={editStatus}
                                onChange={(event) => {
                                  setEditStatus(event.target.value);
                                  setStatusError("");
                                }}
                                disabled={statusSavingId === enquiry.id}
                              >
                                {ENQUIRY_STATUSES
                                  .filter((item) => item.value !== "converted")
                                  .filter((item) => isOwner || enquiry.status !== "lost" || item.value === "lost")
                                  .map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                              </select>
                            </label>
                            <label className="enquiries-inline-field">
                              <span>Trial date {editStatus === "trial_scheduled" ? "*" : "(optional)"}</span>
                              <input
                                type="date"
                                value={editTrialDate}
                                onChange={(event) => {
                                  setEditTrialDate(event.target.value);
                                  setStatusError("");
                                }}
                                disabled={statusSavingId === enquiry.id}
                                required={editStatus === "trial_scheduled"}
                              />
                            </label>
                            {statusError && editingEnquiryId === enquiry.id && (
                              <div className="enquiries-inline-error" role="alert">{statusError}</div>
                            )}
                            <div className="enquiries-inline-actions">
                              <button type="button" className="enquiries-secondary-button" onClick={cancelStatusEdit} disabled={statusSavingId === enquiry.id}>Cancel</button>
                              <button type="button" className="enquiries-primary-button" onClick={() => saveStatusEdit(enquiry)} disabled={statusSavingId === enquiry.id}>
                                {statusSavingId === enquiry.id ? "Saving…" : "Save"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className={`enquiries-status enquiries-status-${enquiry.status || "new"}`}>{statusLabel(enquiry.status)}</span>
                        )}
                      </td>
                      <td>{formatDate(enquiry.trial_date)}</td>
                      <td>{formatDate(enquiry.created_at)}</td>
                      {!isAdmin && enquiry.status !== "converted" && (
                        <td>
                          <div className="enquiries-row-actions">
                            <button
                              type="button"
                              className="enquiries-secondary-button"
                              onClick={() => startStatusEdit(enquiry)}
                              disabled={Boolean(statusSavingId) || Boolean(deletingEnquiryId)}
                            >
                              Update status
                            </button>
                            {isOwner && (
                              <button
                                type="button"
                                className="enquiries-secondary-button"
                                onClick={() => openEditEnquiry(enquiry)}
                                disabled={Boolean(statusSavingId) || Boolean(deletingEnquiryId) || conversionSaving}
                              >
                                Edit enquiry
                              </button>
                            )}
                            {isOwner && enquiry.status !== "lost" && (
                              <button
                                type="button"
                                className="enquiries-primary-button"
                                onClick={() => openConversionForm(enquiry)}
                                disabled={Boolean(statusSavingId) || conversionSaving || Boolean(deletingEnquiryId)}
                              >
                                Convert to Player
                              </button>
                            )}
                            {isOwner && (
                              <button
                                type="button"
                                className="enquiries-secondary-button enquiries-delete-button"
                                onClick={() => handleDeleteEnquiry(enquiry)}
                                disabled={Boolean(statusSavingId) || conversionSaving || Boolean(deletingEnquiryId) || enquiry.status === "converted"}
                              >
                                {deletingEnquiryId === enquiry.id ? "Deleting…" : "Delete"}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
      {editingEnquiry && isOwner && (
        <div className="enquiries-modal-backdrop" role="presentation">
          <section className="enquiries-conversion-modal enquiries-edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-enquiry-title">
            <div className="enquiries-section-heading">
              <div>
                <h2 id="edit-enquiry-title">Edit enquiry</h2>
                <p>Update the prospective player's details and follow-up status.</p>
              </div>
              <button type="button" className="enquiries-secondary-button" onClick={() => setEditingEnquiry(null)} disabled={editSaving}>Close</button>
            </div>
            <form onSubmit={saveEnquiryEdit} noValidate>
              <div className="enquiries-form-grid">
                <label className="enquiries-field">Player name *
                  <input maxLength={120} value={editForm.playerName} onChange={(event) => setEditForm((current) => ({ ...current, playerName: event.target.value }))} required />
                </label>
                <label className="enquiries-field">Parent contact *
                  <input type="tel" inputMode="numeric" maxLength={20} value={editForm.parentPhone} onChange={(event) => setEditForm((current) => ({ ...current, parentPhone: event.target.value }))} required />
                </label>
                <label className="enquiries-field">Player date of birth *
                  <input type="date" max={today()} value={editForm.dob} onChange={(event) => setEditForm((current) => ({ ...current, dob: event.target.value }))} required />
                </label>
                <label className="enquiries-field">Source
                  <select value={editForm.source} onChange={(event) => setEditForm((current) => ({ ...current, source: event.target.value }))}>
                    <option value="">Not specified</option>
                    {ENQUIRY_SOURCES.map((source) => <option key={source} value={source}>{source}</option>)}
                  </select>
                </label>
                <label className="enquiries-field">Center
                  <select value={editForm.centerId} onChange={(event) => setEditForm((current) => ({ ...current, centerId: event.target.value }))}>
                    <option value="">Unassigned</option>
                    {centers.map((center) => <option key={center.id} value={center.id}>{center.center_name}</option>)}
                  </select>
                </label>
                <label className="enquiries-field">Status
                  <select value={editStatus} onChange={(event) => setEditStatus(event.target.value)}>
                    {ENQUIRY_STATUSES.filter((item) => item.value !== "converted").map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <label className="enquiries-field">Trial date {editStatus === "trial_scheduled" ? "*" : "(optional)"}
                  <input type="date" value={editTrialDate} onChange={(event) => setEditTrialDate(event.target.value)} required={editStatus === "trial_scheduled"} />
                </label>
                <label className="enquiries-field enquiries-field-wide">Internal note
                  <textarea rows={3} maxLength={2000} value={editForm.notes} onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))} />
                </label>
              </div>
              {editError && <div className="enquiries-alert enquiries-alert-error" role="alert">{editError}</div>}
              <div className="enquiries-form-actions">
                <button type="button" className="enquiries-secondary-button" onClick={() => setEditingEnquiry(null)} disabled={editSaving}>Cancel</button>
                <button type="submit" className="enquiries-primary-button" disabled={editSaving}>{editSaving ? "Saving…" : "Save changes"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </Layout>
  );
}

export default Enquiries;
