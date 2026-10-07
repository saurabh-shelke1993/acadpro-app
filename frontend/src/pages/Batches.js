import React, {
  useCallback,
  useEffect,
  useState
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import { supabase } from "../services/supabase";
import {
  getLoggedInUser,
  isSuperAdmin
} from "../utils/auth";

import {
  isAcademyOwner,
  isCoach
} from "../utils/roles";

import {
  getAccessibleCenters,
  getAccessibleBatches,
  getAccessibleAcademies
} from "../utils/dataScope";
import "./Batches.css";

const Batches = () => {

  const [searchParams] = useSearchParams();
  const academyContextId = searchParams.get("academyId") || "";
  const centerContextId = searchParams.get("centerId") || "";

  const [academies, setAcademies] =
    useState([]);
  
  
  const [user, setUser] = useState(null);

  const [centers, setCenters] =
    useState([]);

  const [filteredCenters, setFilteredCenters] =
    useState([]);

  const [batches, setBatches] =
    useState([]);

  const [selectedAcademy, setSelectedAcademy] =
    useState(academyContextId);

  const [selectedCenter, setSelectedCenter] =
    useState(centerContextId);

  const [batchName, setBatchName] =
    useState("");

  const [batchSearchTerm, setBatchSearchTerm] = useState("");
  const [batchColumnFilters, setBatchColumnFilters] = useState({
    academy: [],
    center: [],
    ageGroup: []
  });
  const [openFilter, setOpenFilter] = useState(null);

  const [editingBatchId, setEditingBatchId] =
    useState(null);

  const [selectedBatchId, setSelectedBatchId] =
    useState(null);

  const [currentPage, setCurrentPage] =
    useState(1);

  const PAGE_SIZE = 6;

  const filteredBatches = batches.filter((batch) => {
    const matchesContext =
      (!academyContextId || batch.academy_id === academyContextId) &&
      (!centerContextId || batch.center_id === centerContextId);

    const matchesBatch =
      !batchSearchTerm.trim() ||
      String(batch.batch_name || "").toLowerCase().includes(
        batchSearchTerm.trim().toLowerCase()
      );

    const matchesColumn = (column, value) =>
      batchColumnFilters[column].length === 0 ||
      batchColumnFilters[column].includes(value);

    return (
      matchesContext &&
      matchesBatch &&
      matchesColumn("academy", batch.academies?.academy_name || "—") &&
      matchesColumn("center", batch.centers?.center_name || "—") &&
      matchesColumn("ageGroup", batch.age_group || "—")
    );
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredBatches.length / PAGE_SIZE)
  );

  const pageStartIndex = (currentPage - 1) * PAGE_SIZE;

  const paginatedBatches = filteredBatches.slice(
    pageStartIndex,
    pageStartIndex + PAGE_SIZE
  );

const [startTime, setStartTime] =
  useState("");

const [endTime, setEndTime] =
  useState("");

const [ageGroup, setAgeGroup] =
  useState("");

  const AGE_GROUPS = [
  "U6",
  "U8",
  "U10",
  "U12",
  "U14",
  "U16",
  "U18",
  "Adults",
  "Elite"
];


useEffect(() => {

  loadUser();

}, []);

// useEffect(() => {

//   if (!user) return;

//   fetchAcademies();
//   fetchCenters();

// }, [user, fetchAcademies, fetchCenters]);

// useEffect(() => {
//   fetchBatches();
// }, [fetchBatches]);
  // =========================
  // FETCH ACADEMIES
  // =========================
const loadUser = async () => {

  const currentUser =
    await getLoggedInUser();

  setUser(currentUser);
};

const fetchAcademies = useCallback(async () => {
  if (!user) return;

  try {
    const data = await getAccessibleAcademies(user);
    setAcademies(data || []);
  } catch (error) {
    console.error("Failed to load accessible academies:", error);
    setAcademies([]);
  }
}, [user]);
  // =========================
  // FETCH CENTERS
  // =========================

const fetchCenters = useCallback(async () => {

  try {
    const data = await getAccessibleCenters(user);

    setCenters(data || []);
    setFilteredCenters(data || []);

setSelectedCenter((currentCenter) => {

  if (
    currentCenter &&
    !(data || []).some(
      (center) => center.id === currentCenter
    )
  ) {
    return "";
  }

  return currentCenter;
});

  } catch (error) {

    console.error(
      "Failed to load accessible centers:",
      error
    );

    setCenters([]);
    setFilteredCenters([]);
  }

}, [user]);
  // =========================
  // FETCH BATCHES
  // =========================
const fetchBatches = useCallback(async () => {

  if (!user) {
    return;
  }

  try {

    // ========================================
    // SUPER ADMIN
    // ========================================

    if (isSuperAdmin(user)) {

      let query = supabase
        .from("batches")
        .select("*")
        .eq("is_active", true)
        .order("batch_name");

      const {
        data,
        error
      } = await query;

      if (error) {
        throw error;
      }

      const centerById = new Map(
        (centers || []).map(
          (center) => [
            center.id,
            center
          ]
        )
      );

      const academyById = new Map(
        (academies || []).map(
          (academy) => [
            academy.id,
            academy
          ]
        )
      );

      const displayBatches =
        (data || []).map(
          (batch) => ({

            ...batch,

            centers:
              centerById.get(
                batch.center_id
              ) || null,

            academies:
              academyById.get(
                batch.academy_id
              ) || null

          })
        );

      setBatches(displayBatches);
      setCurrentPage(1);
      setSelectedBatchId(null);

      return;
    }

    // ========================================
    // ACADEMY OWNER / COACH
    // ========================================

const scopedBatches =
  await getAccessibleBatches(
    user,
    null
  );

    const centerById = new Map(
      (centers || []).map(
        (center) => [
          center.id,
          center
        ]
      )
    );

    const academyById = new Map(
      (academies || []).map(
        (academy) => [
          academy.id,
          academy
        ]
      )
    );

    const displayBatches =
      scopedBatches.map(
        (batch) => ({

          ...batch,

          centers:
            centerById.get(
              batch.center_id
            ) || null,

          academies:
            academyById.get(
              batch.academy_id
            ) || null

        })
      );

    setBatches(displayBatches);
    setCurrentPage(1);
    setSelectedBatchId(null);

  } catch (error) {

    console.error(
      "Failed to load batches:",
      error
    );

     setBatches([]);
     setCurrentPage(1);
     setSelectedBatchId(null);

  }

}, [
  user,
  centers,
  academies
]);

useEffect(() => {

  if (!user) return;

  fetchAcademies();
  fetchCenters();

}, [user, fetchAcademies, fetchCenters]);

useEffect(() => {
  fetchBatches();
}, [fetchBatches]);
  // =========================
  // ACADEMY CHANGE
  // =========================

const handleAcademyChange = (academyId) => {
  setSelectedAcademy(academyId);
  setSelectedCenter("");

  if (!academyId) {
    setFilteredCenters(centers || []);
    return;
  }

  setFilteredCenters(
    (centers || []).filter(
      (center) => center.academy_id === academyId
    )
  );
};

  // =========================
  // CREATE / UPDATE
  // =========================

  const handleSaveBatch = async () => {

      if (!isSuperAdmin(user) && !isAcademyOwner(user)) {
    alert("You do not have permission to manage batches.");
    return;
  }

if (
  !selectedCenter ||
  !batchName ||
  !ageGroup ||
  !startTime ||
  !endTime
) {

  alert(
    "Please fill all fields"
  );

  return;
}

if (
  startTime >= endTime
) {

  alert(
    "End time must be after start time"
  );

  return;
}

let academyId = selectedAcademy;

if (!isSuperAdmin(user)) {
  academyId = user?.academy_id;
}

const duplicateBatch =
  batches.find(
    batch =>
      batch.center_id ===
        selectedCenter &&
      batch.batch_name
        .trim()
        .toLowerCase() ===
      batchName
        .trim()
        .toLowerCase() &&
      batch.id !==
        editingBatchId
  );

if (duplicateBatch) {

  alert(
    "Batch already exists in this center"
  );

  return;
}

    // =====================
    // UPDATE
    // =====================

    if (editingBatchId) {

      const { error } = await supabase
        .from("batches")
.update({
  center_id: selectedCenter,
  batch_name: batchName,
  age_group: ageGroup,
  start_time: startTime,
  end_time: endTime
})
        .eq("id", editingBatchId);

      if (error) {

        alert(error.message);

        return;
      }

      alert("Batch Updated");

      setEditingBatchId(null);
    }

    // =====================
    // CREATE
    // =====================

    else {

      const { error } = await supabase
        .from("batches")
        .insert([
{
  academy_id: academyId,
  center_id: selectedCenter,
  batch_name: batchName,
  age_group: ageGroup,
  start_time: startTime,
  end_time: endTime,
  is_active: true
}
        ]);

      if (error) {

        alert(error.message);

        return;
      }

      alert("Batch Created");
    }

setBatchName("");

setAgeGroup("");

setStartTime("");

setEndTime("");

setSelectedCenter("");

setEditingBatchId(null);
setSelectedBatchId(null);
setCurrentPage(1);

    fetchBatches();
  };

  // =========================
  // EDIT
  // =========================

const handleEdit = (
  batch
) => {

  if (!isSuperAdmin(user) && !isAcademyOwner(user)) {
    return;
  }

setAgeGroup(
  batch.age_group || ""
);

setStartTime(
  batch.start_time || ""
);

setEndTime(
  batch.end_time || ""
);

    setEditingBatchId(
      batch.id
    );

    setBatchName(
      batch.batch_name
    );

    handleAcademyChange(batch.academy_id);
    setSelectedCenter(batch.center_id);
  };

  // =========================
  // DELETE
  // =========================

const handleDelete = async (
  id
) => {

  if (!isSuperAdmin(user) && !isAcademyOwner(user)) {
    alert("You do not have permission to manage batches.");
    return;
  }


    const confirmDelete =
      window.confirm(
        "Delete this batch?"
      );

    if (!confirmDelete) {
      return;
    }

    const { error } = await supabase
      .from("batches")
      .update({
        is_active: false
      })
      .eq("id", id);

    if (error) {

      alert(error.message);

      return;
    }

    alert("Batch Deleted");

    if (selectedBatchId === id) {
      setSelectedBatchId(null);
    }

    setCurrentPage(1);
    fetchBatches();
  };


  useEffect(() => {
    if (!openFilter) return;

    const handleOutsideClick = (event) => {
      if (!event.target.closest(".batches-column-filter")) {
        setOpenFilter(null);
      }
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

  const getUniqueFilterValues = (getter) =>
    [...new Set(batches.map(getter).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b)));

  const batchFilterOptions = {
    academy: getUniqueFilterValues(
      (batch) => batch.academies?.academy_name || "—"
    ),
    center: getUniqueFilterValues(
      (batch) => batch.centers?.center_name || "—"
    ),
    ageGroup: getUniqueFilterValues(
      (batch) => batch.age_group || "—"
    )
  };

  const toggleBatchFilterValue = (column, value) => {
    setBatchColumnFilters((current) => ({
      ...current,
      [column]: current[column].includes(value)
        ? current[column].filter((item) => item !== value)
        : [...current[column], value]
    }));
    setCurrentPage(1);
  };

  const clearBatchColumnFilter = (column) => {
    setBatchColumnFilters((current) => ({
      ...current,
      [column]: []
    }));
    setCurrentPage(1);
  };

  const clearAllBatchFilters = () => {
    setBatchSearchTerm("");
    setBatchColumnFilters({
      academy: [],
      center: [],
      ageGroup: []
    });
    setCurrentPage(1);
    setOpenFilter(null);
  };

  const activeBatchFilterCount =
    (batchSearchTerm.trim() ? 1 : 0) +
    Object.values(batchColumnFilters).filter(
      (values) => values.length > 0
    ).length;

  const renderBatchColumnFilter = (
    column,
    label,
    options,
    type = "list"
  ) => {
    const isOpen = openFilter === column;
    const selectedValues = batchColumnFilters[column] || [];

    return (
      <div className="batches-column-filter">
        <button
          type="button"
          className={"batches-filter-trigger" + (
            selectedValues.length ||
            (column === "batch" && batchSearchTerm.trim())
              ? " batches-filter-trigger-active"
              : ""
          )}
          onClick={() => setOpenFilter(isOpen ? null : column)}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-label={"Filter " + label}
        >
          <span>{label}</span>
          <span aria-hidden="true">⌄</span>
        </button>

        {isOpen && (
          <div
            className="batches-filter-popover"
            role="dialog"
            aria-label={label + " filter"}
          >
            {type === "text" ? (
              <div className="batches-filter-search">
                <input
                  autoFocus
                  type="search"
                  placeholder={"Search " + label.toLowerCase() + "..."}
                  value={batchSearchTerm}
                  onChange={(event) => {
                    setBatchSearchTerm(event.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            ) : (
              <>
                <div className="batches-filter-popover-header">
                  <strong>Filter {label}</strong>
                  {selectedValues.length > 0 && (
                    <button
                      type="button"
                      className="batches-filter-clear-button"
                      onClick={() => clearBatchColumnFilter(column)}
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="batches-filter-options">
                  {options.length === 0 ? (
                    <span className="batches-filter-empty">No values available</span>
                  ) : (
                    options.map((option) => (
                      <label key={option} className="batches-filter-option">
                        <input
                          type="checkbox"
                          checked={selectedValues.includes(option)}
                          onChange={() => toggleBatchFilterValue(column, option)}
                        />
                        <span>{option}</span>
                      </label>
                    ))
                  )}
                </div>
              </>
            )}

            <div className="batches-filter-popover-footer">
              <button
                type="button"
                className="batches-filter-done-button"
                onClick={() => setOpenFilter(null)}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

if (!user) {
  return (
    <Layout>
      <div className="batches-page-loading">Loading...</div>
    </Layout>
  );
}

const formatBatchTime = (time) => {
  if (!time) return "—";
  const [hourPart, minutePart] = String(time).split(":");
  const hour = Number(hourPart);
  const minute = Number(minutePart || 0);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return time;
  }

  const date = new Date();
  date.setHours(hour, minute, 0, 0);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
};

const formatBatchSchedule = (startTimeValue, endTimeValue) => {
  const start = formatBatchTime(startTimeValue);
  const end = formatBatchTime(endTimeValue);

  if (start === "—" && end === "—") return "—";
  if (start === "—") return end;
  if (end === "—") return start;

  return `${start} – ${end}`;
};

return (
  <Layout>
    <div className={`batches-page${isCoach(user) ? " batches-page-coach" : ""}${isAcademyOwner(user) ? " batches-page-owner" : ""}`}>
      <div className="batches-page-header">
        <div>
          <span className="batches-page-eyebrow">Academy management</span>
          <h1>Batches</h1>
          <p>Manage coaching batches, age groups, and schedules.</p>
        </div>
        <div className="batches-page-count">
          <strong>{batches.length}</strong>
          <span>visible batches</span>
        </div>
      </div>

      {(isSuperAdmin(user) || isAcademyOwner(user)) && (
        <section className="batches-form-card batches-create-card">
          <div className="batches-section-heading">
            <div>
              <span className="batches-section-kicker">
                {editingBatchId ? "Batch management" : "Create batch"}
              </span>
              <h2>{editingBatchId ? "Edit Batch" : "New Batch"}</h2>
            </div>
            <p>
              {editingBatchId
                ? "Update the batch schedule, age group, or center."
                : "Add a coaching batch with its academy, center, age group, and schedule."}
            </p>
          </div>

          <div className="batches-form-grid">
            {isSuperAdmin(user) && (
              <div className="batches-field">
                <label htmlFor="batch-academy">Academy</label>
                <select
                  id="batch-academy"
                  value={selectedAcademy}
                  onChange={(e) => handleAcademyChange(e.target.value)}
                  aria-required="true"
                >
                  <option value="">Select academy</option>
                  {academies.map((academy) => (
                    <option key={academy.id} value={academy.id}>
                      {academy.academy_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="batches-field">
              <label htmlFor="batch-center">Center</label>
              <select
                id="batch-center"
                value={selectedCenter}
                onChange={(e) => setSelectedCenter(e.target.value)}
                disabled={!selectedAcademy && isSuperAdmin(user)}
                aria-required="true"
              >
                <option value="">Select center</option>
                {(isSuperAdmin(user)
                  ? filteredCenters
                  : centers.filter(
                      (center) => center.academy_id === user?.academy_id
                    )
                ).map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.center_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="batches-field">
              <label htmlFor="batch-name">Batch name</label>
              <input
                id="batch-name"
                type="text"
                placeholder="e.g. 5–6 PM"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                aria-required="true"
              />
            </div>

            <div className="batches-field">
              <label htmlFor="batch-age-group">Age group</label>
              <select
                id="batch-age-group"
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                aria-required="true"
              >
                <option value="">Select age group</option>
                {AGE_GROUPS.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </div>

            <div className="batches-field">
              <label htmlFor="batch-start-time">Start time</label>
              <input
                id="batch-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                aria-required="true"
              />
            </div>

            <div className="batches-field">
              <label htmlFor="batch-end-time">End time</label>
              <input
                id="batch-end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                aria-required="true"
              />
            </div>
          </div>

          <div className="batches-form-actions">
            {editingBatchId && (
              <button
                type="button"
                className="batches-secondary-button"
                onClick={() => {
                  setEditingBatchId(null);
                  setSelectedBatchId(null);
                  setBatchName("");
                  setAgeGroup("");
                  setStartTime("");
                  setEndTime("");
                }}
              >
                Cancel
              </button>
            )}

            <button
              type="button"
              className="batches-primary-button"
              onClick={handleSaveBatch}
            >
              {editingBatchId ? "Update Batch" : "Create Batch"}
            </button>
          </div>
        </section>
      )}

      <section className="batches-results-section">
        <div className="batches-results-header">
          <div>
            <span className="batches-section-kicker">Active batches</span>
            <h2>Batch List</h2>
          </div>
          <div className="batches-list-filter-summary">
            {activeBatchFilterCount > 0 && (
              <>
                <span>
                  {activeBatchFilterCount} active filter
                  {activeBatchFilterCount === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  className="batches-secondary-button"
                  onClick={clearAllBatchFilters}
                >
                  Clear all
                </button>
              </>
            )}
            <span>
              {filteredBatches.length}{" "}
              {filteredBatches.length === 1 ? "batch" : "batches"} shown
            </span>
            <span>Page {currentPage} of {totalPages}</span>
          </div>
        </div>

        <div className="batches-table-wrap">
          <table className="batches-table">
            <caption className="sr-only">
              Active batches, academy, center, age group, schedule, and available management actions
            </caption>
            <thead>
              <tr>
                <th scope="col">
                  {renderBatchColumnFilter("academy", "Academy", batchFilterOptions.academy)}
                </th>
                <th scope="col">
                  {renderBatchColumnFilter("center", "Center", batchFilterOptions.center)}
                </th>
                <th scope="col">
                  {renderBatchColumnFilter("batch", "Batch", [], "text")}
                </th>
                <th scope="col">
                  {renderBatchColumnFilter("ageGroup", "Age Group", batchFilterOptions.ageGroup)}
                </th>
                <th scope="col">Schedule</th>
                {(isSuperAdmin(user) || isAcademyOwner(user)) && (
                  <th scope="col" className="batches-actions-heading">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredBatches.length === 0 ? (
                <tr>
                  <td
                    className="batches-empty-state"
                    colSpan={isSuperAdmin(user) || isAcademyOwner(user) ? 6 : 5}
                  >
                    <strong>No active batches</strong>
                    <span>
                      {activeBatchFilterCount > 0
                        ? "No batches match the current filters."
                        : "No active batches are available."}
                    </span>
                  </td>
                </tr>
              ) : (
                paginatedBatches.map((batch) => {
                  const academyName =
                    batch.academies?.academy_name ||
                    academies.find((academy) => academy.id === batch.academy_id)?.academy_name ||
                    user?.academy_name ||
                    "—";

                  const centerName =
                    batch.centers?.center_name ||
                    centers.find((center) => center.id === batch.center_id)?.center_name ||
                    "—";

                  const isSelected = selectedBatchId === batch.id;

                  return (
                    <React.Fragment key={batch.id}>
                    <tr
                      key={batch.id}
                      className={isSelected ? "batches-row-selected" : ""}
                      tabIndex={0}
                      onClick={() => setSelectedBatchId(batch.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedBatchId(batch.id);
                        }
                      }}
                    >
                      <td className="batches-academy-cell">{academyName}</td>
                      <td className="batches-center-cell">{centerName}</td>
                      <td className="batches-name-cell">
                        <Link
                          className="batches-drilldown-link"
                          to={"/players?academyId=" + batch.academy_id + "&centerId=" + batch.center_id + "&batchId=" + batch.id}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={"Open players in " + (batch.batch_name || "batch")}
                        >
                          {batch.batch_name || "—"}
                        </Link>
                      </td>
                      <td>{batch.age_group || "—"}</td>
                      <td className="batches-schedule-cell">
                        {formatBatchSchedule(batch.start_time, batch.end_time)}
                      </td>
                      {(isSuperAdmin(user) || isAcademyOwner(user)) && (
                        <td className="batches-actions-cell">
                          <div className="batches-row-actions">
                            <button
                              type="button"
                              className="batches-edit-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleEdit(batch);
                              }}
                              aria-label={`Edit ${batch.batch_name || "batch"}`}
                            >
                              <span className="batches-action-icon" aria-hidden="true">✎</span><span className="batches-action-label">Edit</span>
                            </button>
                            <button
                              type="button"
                              className="batches-delete-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDelete(batch.id);
                              }}
                              aria-label={`Delete ${batch.batch_name || "batch"}`}
                            >
                              <span className="batches-action-icon" aria-hidden="true">×</span><span className="batches-action-label">Delete</span>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                    {(isSuperAdmin(user) || isAcademyOwner(user)) && isSelected && (
                      <tr
                        key={batch.id + "-mobile-actions"}
                        className="batches-mobile-actions-row"
                        aria-label={"Actions for " + (batch.batch_name || "batch")}
                      >
                        <td colSpan={6}>
                          <div className="batches-mobile-row-actions">
                            <button
                              type="button"
                              className="batches-edit-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleEdit(batch);
                              }}
                              aria-label={"Edit " + (batch.batch_name || "batch")}
                            >
                              <span aria-hidden="true">✏️</span>
                            </button>
                            <button
                              type="button"
                              className="batches-delete-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDelete(batch.id);
                              }}
                              aria-label={"Delete " + (batch.batch_name || "batch")}
                            >
                              <span aria-hidden="true">🗑️</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>

          {filteredBatches.length > 0 && (
            <div className="batches-pagination" aria-label="Batches pagination">
              <span className="batches-pagination-summary">
                Showing {pageStartIndex + 1}–{Math.min(pageStartIndex + PAGE_SIZE, filteredBatches.length)} of {filteredBatches.length} batches
              </span>
              <div className="batches-pagination-controls">
                <button
                  type="button"
                  className="batches-pagination-button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  aria-label="Previous batches page"
                >
                  Previous
                </button>
                <span className="batches-pagination-page">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="batches-pagination-button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Next batches page"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  </Layout>
);
};

export default Batches;
