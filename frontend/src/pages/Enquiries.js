import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { getLoggedInUser, isSuperAdmin } from "../utils/auth";
import { isAcademyOwner, isCoach } from "../utils/roles";
import { getAccessibleAcademies, getAccessibleCenters } from "../utils/dataScope";
import {
  createEnquiry,
  ENQUIRY_SOURCES,
  ENQUIRY_STATUSES,
  fetchEnquiries,
  findPotentialDuplicateEnquiries,
  validateQuickEnquiry,
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
  const [user, setUser] = useState(null);
  const [academies, setAcademies] = useState([]);
  const [centers, setCenters] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [academyFilter, setAcademyFilter] = useState("");
  const [centerFilter, setCenterFilter] = useState("");
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
                      <td><span className={`enquiries-status enquiries-status-${enquiry.status || "new"}`}>{statusLabel(enquiry.status)}</span></td>
                      <td>{formatDate(enquiry.trial_date)}</td>
                      <td>{formatDate(enquiry.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </Layout>
  );
}

export default Enquiries;
