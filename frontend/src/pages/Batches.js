import React, {
  useCallback,
  useEffect,
  useState
} from "react";
import Layout from "../components/Layout";
import { supabase } from "../services/supabase";
import {
  getLoggedInUser,
  isSuperAdmin
} from "../utils/auth";

import {
  isAcademyOwner
} from "../utils/roles";

import {
  getAccessibleCenters,
  getAccessibleBatches,
  getAccessibleAcademies
} from "../utils/dataScope";
import "./Batches.css";

const Batches = () => {

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
    useState("");

  const [selectedCenter, setSelectedCenter] =
    useState("");

  const [batchName, setBatchName] =
    useState("");

  const [editingBatchId, setEditingBatchId] =
    useState(null);

  const [selectedBatchId, setSelectedBatchId] =
    useState(null);

  const [currentPage, setCurrentPage] =
    useState(1);

  const PAGE_SIZE = 10;

  const totalPages = Math.max(1, Math.ceil(batches.length / PAGE_SIZE));

  const pageStartIndex =
    (currentPage - 1) * PAGE_SIZE;

  const paginatedBatches =
    batches.slice(pageStartIndex, pageStartIndex + PAGE_SIZE);

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

      // Academy filter
      if (selectedAcademy) {
        query = query.eq(
          "academy_id",
          selectedAcademy
        );
      }

      // Center filter
      if (selectedCenter) {
        query = query.eq(
          "center_id",
          selectedCenter
        );
      }

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
    selectedCenter || null
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
  selectedAcademy,
  selectedCenter,
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

const handleAcademyChange = (
  academyId
) => {

  setSelectedAcademy(academyId);
  setSelectedCenter("");
  setCurrentPage(1);

  if (!academyId) {

    setFilteredCenters(
      centers || []
    );

    return;
  }

  const relatedCenters =
    centers.filter(
      (center) =>
        center.academy_id === academyId
    );

  setFilteredCenters(
    relatedCenters
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

    setSelectedAcademy(
      batch.academy_id
    );

    setSelectedCenter(
      batch.center_id
    );
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
    <div className="batches-page">
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

      <section className="batches-filter-card">
        <div className="batches-section-heading">
          <div>
            <span className="batches-section-kicker">Filters</span>
            <h2>Batch filters</h2>
          </div>
          <p>Use academy and center to narrow the batch list.</p>
        </div>

        <div className="batches-filter-grid">
          {isSuperAdmin(user) && (
            <div className="batches-field">
              <label htmlFor="batch-filter-academy">Academy</label>
              <select
                id="batch-filter-academy"
                value={selectedAcademy}
                onChange={(e) => handleAcademyChange(e.target.value)}
              >
                <option value="">All Academies</option>
                {academies.map((academy) => (
                  <option key={academy.id} value={academy.id}>
                    {academy.academy_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="batches-field">
            <label htmlFor="batch-filter-center">Center</label>
            <select
              id="batch-filter-center"
              value={selectedCenter}
              onChange={(e) => {
                setSelectedCenter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Centers</option>
              {filteredCenters.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.center_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {(isSuperAdmin(user) || isAcademyOwner(user)) && (
        <section className="batches-form-card">
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
                : "Add a coaching batch with its age group and training schedule."}
            </p>
          </div>

          <div className="batches-form-grid">
            <div className="batches-field batches-field-wide">
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
          <span className="batches-results-count">
            {batches.length} {batches.length === 1 ? "batch" : "batches"}
          </span>
        </div>

        <div className="batches-table-wrap">
          <table className="batches-table">
            <caption className="sr-only">
              Active batches, academy, center, age group, schedule, and available management actions
            </caption>
            <thead>
              <tr>
                <th scope="col">Academy</th>
                <th scope="col">Center</th>
                <th scope="col">Batch</th>
                <th scope="col">Age Group</th>
                <th scope="col">Schedule</th>
                {(isSuperAdmin(user) || isAcademyOwner(user)) && (
                  <th scope="col" className="batches-actions-heading">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td
                    className="batches-empty-state"
                    colSpan={isSuperAdmin(user) || isAcademyOwner(user) ? 6 : 5}
                  >
                    <strong>No active batches</strong>
                    <span>No batches match the current academy or center selection.</span>
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
                      <td className="batches-name-cell">{batch.batch_name || "—"}</td>
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
                              Edit
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
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {batches.length > 0 && (
            <div className="batches-pagination" aria-label="Batches pagination">
              <span className="batches-pagination-summary">
                Showing {pageStartIndex + 1}–{Math.min(pageStartIndex + PAGE_SIZE, batches.length)} of {batches.length} batches
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
