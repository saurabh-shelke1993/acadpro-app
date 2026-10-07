import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import "./CoachBatchMapping.css";
import { supabase } from "../supabaseClient";
import { getCurrentUser, isSuperAdmin } from "../utils/auth";
import { isAcademyOwner } from "../utils/roles";

function CoachBatchMapping() {
  const [user, setUser] = useState(null);
  const [academies, setAcademies] = useState([]);
  const [centers, setCenters] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [batches, setBatches] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedAcademy, setSelectedAcademy] = useState("");
  const [selectedCenter, setSelectedCenter] = useState("");
  const [selectedCoach, setSelectedCoach] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");
  const [openFilter, setOpenFilter] = useState(null);
  const [columnFilters, setColumnFilters] = useState({
    coach: [], center: [], batch: [], status: []
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMappingId, setSelectedMappingId] = useState(null);
  const [editingMappingId, setEditingMappingId] = useState(null);
  const [mappingNotice, setMappingNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const PAGE_SIZE = 10;

  useEffect(() => { loadUser(); }, []);
  useEffect(() => { if (user) fetchAcademies(); }, [user]);

  useEffect(() => {
    if (!selectedAcademy) {
      setCenters([]); setCoaches([]); setBatches([]); setAssignments([]);
      return;
    }
    setSelectedCenter("");
    setSelectedBatch("");
    fetchWorkspaceData();
  }, [selectedAcademy]);

  useEffect(() => {
    if (!selectedCenter) {
      setBatches([]);
      setSelectedBatch("");
      return;
    }
    fetchBatches();
  }, [selectedCenter]);

  useEffect(() => {
    if (!openFilter) return;
    const handleOutsideClick = (event) => {
      if (!event.target.closest(".coach-mapping-column-filter")) setOpenFilter(null);
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") setOpenFilter(null);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openFilter]);

  const loadUser = async () => setUser(await getCurrentUser());

  const fetchAcademies = async () => {
    try {
      let query = supabase.from("academies").select("id, academy_name").eq("is_active", true).order("academy_name");
      if (!isSuperAdmin(user)) query = query.eq("id", user.academy_id);
      const { data, error } = await query;
      if (error) throw error;
      setAcademies(data || []);
      if (!isSuperAdmin(user) && data?.length) setSelectedAcademy(data[0].id);
    } catch (error) {
      console.error("Failed to load academies:", error);
      setLoadError("Unable to load academies.");
    }
  };

  const fetchWorkspaceData = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [coachResult, centerResult, assignmentResult] = await Promise.all([
        supabase.from("coaches").select("id, full_name, is_active").eq("academy_id", selectedAcademy).eq("is_active", true).order("full_name"),
        supabase.from("centers").select("id, center_name, is_active").eq("academy_id", selectedAcademy).eq("is_active", true).order("center_name"),
        supabase.from("coach_batch_assignments").select(`
          id, coach_id, batch_id, academy_id, is_active, created_at,
          coaches(full_name),
          batches(batch_name, age_group, start_time, end_time, center_id, centers(center_name))
        `).eq("academy_id", selectedAcademy).order("created_at", { ascending: false })
      ]);
      if (coachResult.error) throw coachResult.error;
      if (centerResult.error) throw centerResult.error;
      if (assignmentResult.error) throw assignmentResult.error;
      setCoaches(coachResult.data || []);
      setCenters(centerResult.data || []);
      setAssignments(assignmentResult.data || []);
      setCurrentPage(1);
      setSelectedMappingId(null);
    } catch (error) {
      console.error("Failed to load mapping workspace:", error);
      setLoadError(error.message || "Unable to load mapping data.");
      setCoaches([]); setCenters([]); setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBatches = async () => {
    try {
      const { data, error } = await supabase.from("batches")
        .select("id, batch_name, age_group, start_time, end_time, center_id")
        .eq("academy_id", selectedAcademy).eq("center_id", selectedCenter)
        .eq("is_active", true).order("batch_name");
      if (error) throw error;
      setBatches(data || []);
    } catch (error) {
      console.error("Failed to load batches:", error);
      setBatches([]);
    }
  };

  const resetAssignmentForm = () => {
    setSelectedCoach("");
    setSelectedCenter("");
    setSelectedBatch("");
    setEditingMappingId(null);
  };

  const startEditMapping = (mapping) => {
    const centerId = mapping.batches?.center_id || mapping.batches?.centers?.id || "";
    setEditingMappingId(mapping.id);
    setSelectedMappingId(mapping.id);
    setSelectedCoach(mapping.coach_id || "");
    setSelectedCenter(centerId);
    setSelectedBatch(mapping.batch_id || "");
    setMappingNotice(null);
    window.setTimeout(() => {
      document.getElementById("coach-mapping-assignment-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const updateMapping = async () => {
    setMappingNotice(null);
    if (!editingMappingId || !selectedAcademy || !selectedCoach || !selectedCenter || !selectedBatch) {
      setMappingNotice({ type: "error", message: "Select a coach, center, and batch before saving." });
      return;
    }

    const duplicate = assignments.find((item) =>
      item.id !== editingMappingId &&
      item.is_active &&
      item.coach_id === selectedCoach &&
      item.batch_id === selectedBatch
    );
    if (duplicate) {
      setMappingNotice({ type: "error", message: "This coach is already assigned to the selected batch." });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("coach_batch_assignments")
        .update({
          coach_id: selectedCoach,
          batch_id: selectedBatch
        })
        .eq("id", editingMappingId)
        .eq("academy_id", selectedAcademy);
      if (error) throw error;
      setMappingNotice({ type: "success", message: "Coach-batch mapping updated successfully." });
      resetAssignmentForm();
      await fetchWorkspaceData();
    } catch (error) {
      console.error("Failed to update mapping:", error);
      setMappingNotice({ type: "error", message: error.message || "Failed to update mapping." });
    } finally {
      setSaving(false);
    }
  };

  const deleteMapping = async (mapping) => {
    if (!window.confirm("Are you sure you want to delete this coach-batch mapping?")) return;

    setSaving(true);
    setMappingNotice(null);
    try {
      const { error } = await supabase.from("coach_batch_assignments")
        .delete()
        .eq("id", mapping.id)
        .eq("academy_id", selectedAcademy);
      if (error) throw error;
      setSelectedMappingId(null);
      setEditingMappingId(null);
      setMappingNotice({ type: "success", message: "Coach-batch mapping deleted successfully." });
      await fetchWorkspaceData();
    } catch (error) {
      console.error("Failed to delete mapping:", error);
      setMappingNotice({ type: "error", message: error.message || "Failed to delete mapping." });
    } finally {
      setSaving(false);
    }
  };

  const assignCoach = async () => {
    setMappingNotice(null);
    if (!selectedAcademy || !selectedCoach || !selectedCenter || !selectedBatch) {
      setMappingNotice({ type: "error", message: "Select an academy, coach, center, and batch before assigning." });
      return;
    }

    const existing = assignments.find((item) =>
      item.coach_id === selectedCoach && item.batch_id === selectedBatch
    );
    setSaving(true);

    try {
      if (existing?.is_active) {
        setMappingNotice({ type: "error", message: "This coach is already assigned to the selected batch." });
        return;
      }

      if (existing) {
        const { error } = await supabase.from("coach_batch_assignments")
          .update({ is_active: true }).eq("id", existing.id);
        if (error) throw error;
        setMappingNotice({ type: "success", message: "Existing coach-batch mapping reactivated." });
      } else {
        const { error } = await supabase.from("coach_batch_assignments").insert([{
          academy_id: selectedAcademy, coach_id: selectedCoach, batch_id: selectedBatch, is_active: true
        }]);
        if (error) throw error;
        setMappingNotice({ type: "success", message: "Coach assigned to batch successfully." });
      }
      resetAssignmentForm();
      await fetchWorkspaceData();
    } catch (error) {
      console.error("Failed to assign coach:", error);
      setMappingNotice({ type: "error", message: error.message || "Failed to create the mapping." });
    } finally {
      setSaving(false);
    }
  };

  const toggleMappingStatus = async (mapping) => {
    const nextStatus = !mapping.is_active;
    const action = nextStatus ? "reactivate" : "deactivate";
    if (!window.confirm("Are you sure you want to " + action + " this coach-batch mapping?")) return;

    setSaving(true);
    setMappingNotice(null);
    try {
      const { error } = await supabase.from("coach_batch_assignments")
        .update({ is_active: nextStatus }).eq("id", mapping.id);
      if (error) throw error;
      setSelectedMappingId(null);
      setMappingNotice({ type: "success", message: "Mapping " + (nextStatus ? "reactivated" : "deactivated") + " successfully." });
      await fetchWorkspaceData();
    } catch (error) {
      console.error("Failed to update mapping:", error);
      setMappingNotice({ type: "error", message: error.message || "Failed to update mapping." });
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (value) => {
    if (!value) return "—";
    const parts = String(value).split(":");
    const hour = Number(parts[0]);
    if (Number.isNaN(hour)) return value;
    return (hour % 12 || 12) + ":" + (parts[1] || "00") + " " + (hour >= 12 ? "PM" : "AM");
  };

  const formatSchedule = (batch) => {
    if (!batch || (!batch.start_time && !batch.end_time)) return "—";
    return formatTime(batch.start_time) + " – " + formatTime(batch.end_time);
  };

  const filterOptions = useMemo(() => ({
    coach: [...new Set(assignments.map((item) => item.coaches?.full_name || "—"))].sort(),
    center: [...new Set(assignments.map((item) => item.batches?.centers?.center_name || "—"))].sort(),
    batch: [...new Set(assignments.map((item) => item.batches?.batch_name || "—"))].sort(),
    status: ["Active", "Inactive"].filter((status) =>
      assignments.some((item) => (item.is_active ? "Active" : "Inactive") === status)
    )
  }), [assignments]);

  const toggleFilterValue = (column, value) => {
    setColumnFilters((current) => ({
      ...current,
      [column]: current[column].includes(value)
        ? current[column].filter((item) => item !== value)
        : [...current[column], value]
    }));
    setCurrentPage(1);
  };

  const clearColumnFilter = (column) => {
    setColumnFilters((current) => ({ ...current, [column]: [] }));
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setColumnFilters({ coach: [], center: [], batch: [], status: [] });
    setCurrentPage(1);
    setOpenFilter(null);
  };

  const filteredAssignments = assignments.filter((item) => {
    const matches = (column, value) =>
      columnFilters[column].length === 0 || columnFilters[column].includes(value);
    return matches("coach", item.coaches?.full_name || "—") &&
      matches("center", item.batches?.centers?.center_name || "—") &&
      matches("batch", item.batches?.batch_name || "—") &&
      matches("status", item.is_active ? "Active" : "Inactive");
  });

  const totalPages = Math.max(1, Math.ceil(filteredAssignments.length / PAGE_SIZE));
  const paginatedAssignments = filteredAssignments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const activeMappings = assignments.filter((item) => item.is_active).length;
  const activeFilterCount = Object.values(columnFilters).filter((values) => values.length > 0).length;

  const renderColumnFilter = (column, label, options) => {
    const isOpen = openFilter === column;
    const selectedValues = columnFilters[column] || [];
    return (
      <div className="coach-mapping-column-filter">
        <button
          type="button"
          className={"coach-mapping-filter-trigger" + (selectedValues.length ? " coach-mapping-filter-trigger-active" : "")}
          onClick={() => setOpenFilter(isOpen ? null : column)}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-label={"Filter " + label}
        >
          <span>{label}</span><span aria-hidden="true">⌄</span>
        </button>
        {isOpen && (
          <div className="coach-mapping-filter-popover" role="dialog" aria-label={label + " filter"}>
            <div className="coach-mapping-filter-popover-header">
              <strong>Filter {label}</strong>
              {selectedValues.length > 0 && (
                <button type="button" className="coach-mapping-filter-clear-button" onClick={() => clearColumnFilter(column)}>Clear</button>
              )}
            </div>
            <div className="coach-mapping-filter-options">
              {options.length === 0 ? (
                <span className="coach-mapping-filter-empty">No values available</span>
              ) : options.map((option) => (
                <label key={option} className="coach-mapping-filter-option">
                  <input type="checkbox" checked={selectedValues.includes(option)} onChange={() => toggleFilterValue(column, option)} />
                  <span>{option}</span>
                </label>
              ))}
            </div>
            <div className="coach-mapping-filter-popover-footer">
              <button type="button" className="coach-mapping-filter-done-button" onClick={() => setOpenFilter(null)}>Done</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleRowKeyDown = (event, mappingId) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedMappingId(selectedMappingId === mappingId ? null : mappingId);
    }
  };

  const canManageMappings = isSuperAdmin(user) || isAcademyOwner(user);

  return (
    <Layout>
      <div className={`coach-mapping-page${isAcademyOwner(user) ? " coach-mapping-page-owner" : ""}`}>
        <section className="coach-mapping-toolbar">
          <div>
            <span className="coach-mapping-eyebrow">Academy management</span>
            <h1>Coach Batch Mapping</h1>
            <p>Manage coach assignments across academy batches.</p>
          </div>
          <div className="coach-mapping-toolbar-controls">
            {isSuperAdmin(user) ? (
              <label className="coach-mapping-toolbar-field">
                <span>Academy</span>
                <select value={selectedAcademy} onChange={(event) => {
                  setSelectedAcademy(event.target.value);
                  setMappingNotice(null);
                  clearAllFilters();
                }}>
                  <option value="">Select Academy</option>
                  {academies.map((academy) => <option key={academy.id} value={academy.id}>{academy.academy_name}</option>)}
                </select>
              </label>
            ) : (
              <div className="coach-mapping-academy-context">
                <span>Academy</span>
                <strong>{academies.find((academy) => academy.id === selectedAcademy)?.academy_name || "Your academy"}</strong>
              </div>
            )}
            <div className="coach-mapping-summary-card"><strong>{activeMappings}</strong><span>active mappings</span></div>
          </div>
        </section>

        {mappingNotice && (
          <div className={"coach-mapping-notice " + (mappingNotice.type === "error" ? "coach-mapping-notice-error" : "coach-mapping-notice-success")} role="status">
            {mappingNotice.message}
          </div>
        )}

        {canManageMappings && selectedAcademy && (
          <section id="coach-mapping-assignment-card" className={"coach-mapping-assignment-card" + (editingMappingId ? " coach-mapping-assignment-card-editing" : "")}>
            <div className="coach-mapping-assignment-heading">
              <div><span className="coach-mapping-section-eyebrow">{editingMappingId ? "Edit mapping" : "Create mapping"}</span><h2>{editingMappingId ? "Edit Coach Mapping" : "Assign Coach"}</h2></div>
              <p>Coach → Center → Batch</p>
            </div>
            <div className="coach-mapping-form-grid">
              <label className="coach-mapping-field"><span>Coach *</span>
                <select value={selectedCoach} onChange={(event) => setSelectedCoach(event.target.value)} aria-required="true">
                  <option value="">Select Coach</option>
                  {coaches.map((coach) => <option key={coach.id} value={coach.id}>{coach.full_name}</option>)}
                </select>
              </label>
              <label className="coach-mapping-field"><span>Center *</span>
                <select value={selectedCenter} onChange={(event) => { setSelectedCenter(event.target.value); setSelectedBatch(""); }} aria-required="true">
                  <option value="">Select Center</option>
                  {centers.map((center) => <option key={center.id} value={center.id}>{center.center_name}</option>)}
                </select>
              </label>
              <label className="coach-mapping-field"><span>Batch *</span>
                <select value={selectedBatch} onChange={(event) => setSelectedBatch(event.target.value)} disabled={!selectedCenter} aria-required="true">
                  <option value="">{selectedCenter ? "Select Batch" : "Select Center first"}</option>
                  {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batch_name}{batch.age_group ? " · " + batch.age_group : ""}</option>)}
                </select>
              </label>
              <div className="coach-mapping-form-action">
                <div className="coach-mapping-form-actions">
                  {editingMappingId && (
                    <button className="coach-mapping-secondary-button" type="button" onClick={resetAssignmentForm} disabled={saving}>
                      Cancel
                    </button>
                  )}
                  <button className="coach-mapping-primary-button" type="button" onClick={editingMappingId ? updateMapping : assignCoach} disabled={saving || !selectedCoach || !selectedCenter || !selectedBatch}>
                    {saving ? "Saving..." : editingMappingId ? "Save Changes" : "Assign"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {!selectedAcademy && isSuperAdmin(user) ? (
          <section className="coach-mapping-empty-workspace">
            <strong>Select an academy to view coach mappings.</strong>
            <span>Choose an academy above to load coaches, batches, and assignments.</span>
          </section>
        ) : (
          <section className="coach-mapping-list-section">
            <div className="coach-mapping-list-header">
              <div>
                <span className="coach-mapping-section-eyebrow">Mapping directory</span>
                <h2>Current Mappings</h2>
                <p>{filteredAssignments.length} mapping{filteredAssignments.length === 1 ? "" : "s"} shown</p>
              </div>
              <div className="coach-mapping-list-summary">
                {activeFilterCount > 0 && (
                  <>
                    <span className="coach-mapping-active-filter-count">{activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}</span>
                    <button type="button" className="coach-mapping-secondary-button" onClick={clearAllFilters}>Clear all</button>
                  </>
                )}
                <span>Page {currentPage} of {totalPages}</span>
              </div>
            </div>

            {loadError && (
              <div className="coach-mapping-error-state">
                <strong>Unable to load mappings</strong><span>{loadError}</span>
                <button type="button" className="coach-mapping-secondary-button" onClick={fetchWorkspaceData}>Retry</button>
              </div>
            )}

            <div className="coach-mapping-table-wrap">
              <table className="coach-mapping-table">
                <caption className="sr-only">Coach to batch mappings, schedules, status, and actions</caption>
                <thead><tr>
                  <th scope="col">{renderColumnFilter("coach", "Coach", filterOptions.coach)}</th>
                  <th scope="col">{renderColumnFilter("center", "Center", filterOptions.center)}</th>
                  <th scope="col">{renderColumnFilter("batch", "Batch", filterOptions.batch)}</th>
                  <th scope="col">Schedule</th>
                  <th scope="col">{renderColumnFilter("status", "Status", filterOptions.status)}</th>
                  {canManageMappings && <th scope="col">Actions</th>}
                </tr></thead>
                <tbody>
                  {loading ? (
                    <tr><td className="coach-mapping-empty-state" colSpan={canManageMappings ? 6 : 5}><strong>Loading mappings…</strong><span>Fetching the selected academy workspace.</span></td></tr>
                  ) : paginatedAssignments.length > 0 ? paginatedAssignments.map((item) => {
                    const isSelected = selectedMappingId === item.id;
                    const batch = item.batches;
                    const initials = String(item.coaches?.full_name || "C").trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
                    return (
                      <>
                      <tr key={item.id} className={isSelected ? "coach-mapping-row-selected" : ""} tabIndex={0} aria-selected={isSelected}
                        onClick={() => setSelectedMappingId(isSelected ? null : item.id)}
                        onKeyDown={(event) => handleRowKeyDown(event, item.id)}>
                        <td className="coach-mapping-name-cell"><div className="coach-mapping-identity"><span className="coach-mapping-avatar" aria-hidden="true">{initials}</span><span>{item.coaches?.full_name || "—"}</span></div></td>
                        <td>{batch?.centers?.center_name || "—"}</td>
                        <td><strong>{batch?.batch_name || "—"}</strong>{batch?.age_group && <span className="coach-mapping-secondary-line">{batch.age_group}</span>}</td>
                        <td>{formatSchedule(batch)}</td>
                        <td><span className={item.is_active ? "mapping-status-badge" : "mapping-status-badge mapping-status-badge-inactive"}>{item.is_active ? "Active" : "Inactive"}</span></td>
                        {canManageMappings && <td className="coach-mapping-actions-cell"><div className="coach-mapping-row-actions">
                          <button type="button" className="coach-mapping-icon-button" onClick={(event) => { event.stopPropagation(); startEditMapping(item); }} disabled={saving} title="Edit mapping" aria-label={"Edit mapping for " + (item.coaches?.full_name || "mapping")}>
                            ✏️
                          </button>
                          <button type="button" className="coach-mapping-icon-button coach-mapping-delete-button" onClick={(event) => { event.stopPropagation(); deleteMapping(item); }} disabled={saving} title="Delete mapping" aria-label={"Delete mapping for " + (item.coaches?.full_name || "mapping")}>
                            🗑️
                          </button>
                        </div></td>}
                      </tr>
                      {isAcademyOwner(user) && isSelected && (
                        <tr className="coach-mapping-mobile-actions-row">
                          <td colSpan={3}>
                            <div className="coach-mapping-mobile-row-actions">
                              <button
                                type="button"
                                className="coach-mapping-icon-button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  startEditMapping(item);
                                }}
                                disabled={saving}
                                title="Edit mapping"
                                aria-label={"Edit mapping for " + (item.coaches?.full_name || "mapping")}
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                className="coach-mapping-icon-button coach-mapping-delete-button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  deleteMapping(item);
                                }}
                                disabled={saving}
                                title="Delete mapping"
                                aria-label={"Delete mapping for " + (item.coaches?.full_name || "mapping")}
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                      </>
                    );
                  }) : (
                    <tr><td className="coach-mapping-empty-state" colSpan={canManageMappings ? 6 : 5}>
                      <div className="coach-mapping-empty-icon">↔</div>
                      <strong>{activeFilterCount > 0 ? "No mappings match your filters" : "No coach-batch mappings"}</strong>
                      <span>{activeFilterCount > 0 ? "Try changing or clearing your filters." : "Create an assignment using the form above."}</span>
                      {activeFilterCount > 0 && <button type="button" className="coach-mapping-secondary-button" onClick={clearAllFilters}>Clear all filters</button>}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {filteredAssignments.length > 0 && <div className="coach-mapping-pagination">
              <span>Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredAssignments.length)} of {filteredAssignments.length} mappings</span>
              <div className="coach-mapping-pagination-controls">
                <button type="button" className="coach-mapping-secondary-button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>Previous</button>
                <span>Page {currentPage} of {totalPages}</span>
                <button type="button" className="coach-mapping-secondary-button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>Next</button>
              </div>
            </div>}
          </section>
        )}
      </div>
    </Layout>
  );
}

export default CoachBatchMapping;
