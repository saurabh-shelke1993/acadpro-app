import React, { useCallback, useEffect, useState } from "react";
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
  getAccessibleAcademies
} from "../utils/dataScope";
import { getCoachScheduleAssignments } from "../services/coachScheduleAssignmentService";
import { groupCoachesByCenter, suggestCenterCode } from "../services/centerPresentation";
import "./Centers.css";

const Centers = () => {

const [searchParams] = useSearchParams();
const academyContextId = searchParams.get("academyId") || "";
const [user, setUser] = useState(null);

const [centers, setCenters] = useState([]);
const [coachesByCenter, setCoachesByCenter] = useState({});

const [filteredCenters, setFilteredCenters] =
  useState([]);
  const [academies, setAcademies] = useState([]);

  const [selectedAcademy, setSelectedAcademy] = useState(academyContextId);

  const [centerName, setCenterName] = useState("");
  const [centerCode, setCenterCode] = useState("");
  const [centerCodeEdited, setCenterCodeEdited] = useState(false);

  const [editingCenterId, setEditingCenterId] =
    useState(null);
  const [selectedCenterId, setSelectedCenterId] =
    useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const PAGE_SIZE = 8;
  const totalPages = Math.max(1, Math.ceil(filteredCenters.length / PAGE_SIZE));
  const pageStartIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedCenters = filteredCenters.slice(
    pageStartIndex,
    pageStartIndex + PAGE_SIZE
  );

useEffect(() => {

  loadUser();

}, []);

  // =========================
  // FETCH ACADEMIES
  // =========================
const loadUser = async () => {

  const currentUser =
    await getLoggedInUser();

  setUser(currentUser);
};

  const fetchAcademies = useCallback(async () => {
    try {
      const data = await getAccessibleAcademies(user);
      setAcademies(data || []);
    } catch (error) {
      console.error("Failed to load academies:", error);
      setAcademies([]);
    }
  }, [user]);

  useEffect(() => {
    if (!user || (!isAcademyOwner(user) && !isSuperAdmin(user))) return undefined;
    let active = true;
    const load = async () => {
      try {
        // SA can see multiple academies; assignment rows remain scoped by the visible centers.
        const assignments = await getCoachScheduleAssignments(
          isSuperAdmin(user) ? {} : { academyId: user.academy_id }
        );
        const grouped = groupCoachesByCenter(assignments, isSuperAdmin(user) ? "" : user.academy_id);
        if (active) setCoachesByCenter(grouped);
      } catch (error) {
        console.error("Unable to load center coaches", error);
        if (active) setCoachesByCenter({});
      }
    };
    load();
    return () => { active = false; };
  }, [user]);

  // =========================
  // FETCH CENTERS
  // =========================

const fetchCenters = useCallback(async () => {

  if (!user) {
    return;
  }

  try {

    const data =
      await getAccessibleCenters(user);

    setCenters(data || []);
    const visibleCenters = academyContextId
      ? (data || []).filter((center) => center.academy_id === academyContextId)
      : (data || []);
    setFilteredCenters(visibleCenters);
    setCurrentPage(1);

  } catch (error) {

    console.error(
      "Failed to load centers:",
      error
    );

    setCenters([]);
  }
}, [user, academyContextId]);

useEffect(() => {

  if (!user) return;

  fetchAcademies();

  fetchCenters();

}, [user, fetchAcademies, fetchCenters]);

// =========================
// ACADEMY CHANGE
// =========================

const handleAcademyChange = (academyId) => {

  setSelectedAcademy(academyId);
  setCurrentPage(1);

  if (!academyId) {

    setFilteredCenters(
      centers || []
    );

    return;
  }

  const relatedCenters =
    (centers || []).filter(
      (center) =>
        center.academy_id === academyId
    );

  setFilteredCenters(
    relatedCenters
  );
};
  // =========================
  // CREATE / UPDATE CENTER
  // =========================

  const handleSaveCenter = async () => {

    if (
    !isSuperAdmin(user) &&
    !isAcademyOwner(user)
  ) {
    alert(
      "You do not have permission to manage centers."
    );
    return;
  }

    if (!centerName.trim()) {

      alert("Enter center name");

      return;
    }

    const normalizedName = centerName.trim();
    const normalizedCode = centerCode.trim().toUpperCase() || suggestCenterCode(normalizedName);
    if (!/^[A-Z0-9]{2,8}$/.test(normalizedCode)) {
      alert("Center code must be 2–8 uppercase letters or numbers.");
      return;
    }

    let academyId = selectedAcademy;

    // Academy Owner auto academy mapping

if (!isSuperAdmin(user)) {

      academyId = user?.academy_id;
    }

if (!academyId) { alert("Select an academy first."); return; }

const { data: existingCenter, error: existingCenterError } =
  await supabase
    .from("centers")
    .select("id")
    .eq("academy_id", academyId)
    .eq("center_name", normalizedName)
    .eq("is_active", true)
    .maybeSingle();

if (existingCenterError) { alert(existingCenterError.message); return; }

const { data: duplicateCode, error: duplicateCodeError } = await supabase
  .from("centers").select("id").eq("academy_id", academyId)
  .eq("center_code", normalizedCode).maybeSingle();
if (duplicateCodeError) { alert(duplicateCodeError.message); return; }
if (duplicateCode && duplicateCode.id !== editingCenterId) {
  alert("This center code is already used in the selected academy.");
  return;
}

if (
  existingCenter &&
  existingCenter.id !== editingCenterId
) {

  alert(
    "Center already exists in this academy"
  );

  return;
}

    // ======================
    // UPDATE CENTER
    // ======================

    if (editingCenterId) {

      const { error } = await supabase
        .from("centers")
        .update({
          center_name: normalizedName,
          center_code: normalizedCode
        })
        .eq("id", editingCenterId)
        .eq("academy_id", academyId);

      if (error) {

        alert(error.message);

        return;
      }

      alert("Center Updated");

      setEditingCenterId(null);
      setSelectedCenterId(editingCenterId);
    }

    // ======================
    // CREATE CENTER
    // ======================

    else {

      const { error } = await supabase
        .from("centers")
        .insert([
          {
            academy_id: academyId,
            center_name: normalizedName,
            center_code: normalizedCode,
            is_active: true
          }
        ]);

      if (error) {

        alert(error.message);

        return;
      }

      alert("Center Created");
    }

    setCenterName("");
    setCenterCode("");
    setCenterCodeEdited(false);
    setCurrentPage(1);
    fetchCenters();
  };

  // =========================
  // EDIT CENTER
  // =========================

  const handleEdit = (center) => {

    setEditingCenterId(center.id);
    setSelectedCenterId(center.id);

    setCenterName(center.center_name);
    setCenterCode(center.center_code || suggestCenterCode(center.center_name));
    setCenterCodeEdited(Boolean(center.center_code));

    setSelectedAcademy(center.academy_id);
  };

  // =========================
  // DELETE CENTER
  // =========================

  const handleDelete = async (id) => {

    const confirmDelete =
      window.confirm(
        "Are you sure?"
      );

    if (!confirmDelete) {
      return;
    }

    const { error } = await supabase
      .from("centers")
      .update({
        is_active: false
      })
      .eq("id", id);

    if (error) {

      alert(error.message);

      return;
    }

    alert("Center Deleted");

    if (selectedCenterId === id) {
      setSelectedCenterId(null);
    }
    if (editingCenterId === id) {
      setEditingCenterId(null);
      setCenterName("");
      setCenterCode("");
      setCenterCodeEdited(false);
    }

    fetchCenters();
  };
if (!user) {

  return (
    <Layout>
      <div className={`centers-page${isCoach(user) ? " centers-page-coach" : ""}${isAcademyOwner(user) ? " centers-page-owner" : ""}`}>
        Loading...
      </div>
    </Layout>
  );
}

return (
  <Layout>
    <div className={`centers-page${isCoach(user) ? " centers-page-coach" : ""}${isAcademyOwner(user) ? " centers-page-owner" : ""}`}>

      <div className="centers-page-header">
        <div>
          <span className="centers-page-eyebrow">Academy management</span>
          <h1>Centers</h1>
          <p>Manage academy locations and their active centers.</p>
        </div>
        <div className="centers-page-count">
          <strong>{filteredCenters.length}</strong>
          <span>visible centers</span>
        </div>
      </div>

      {/* ===================== */}
      {/* CENTER WORKSPACE */}
      {/* ===================== */}

      {(isSuperAdmin(user) || isAcademyOwner(user)) && (
        <section className="centers-form-card">
          <div className="centers-section-heading">
            <h2>{editingCenterId ? "Edit Center" : "Center workspace"}</h2>
            <p>{isSuperAdmin(user) ? "Select an academy, then create or edit a center." : "Create or edit centers within your academy."}</p>
          </div>

          <div className="centers-form-grid">
            {isSuperAdmin(user) && (
              <select
                value={selectedAcademy}
                onChange={(e) =>
                  handleAcademyChange(e.target.value)
                }
              >
                <option value="">Select Academy</option>
                {academies.map((academy) => (
                  <option key={academy.id} value={academy.id}>
                    {academy.academy_name}
                  </option>
                ))}
              </select>
            )}

            <input
              type="text"
              placeholder="Enter Center Name"
              value={centerName}
              onChange={(e) => {
                const name = e.target.value;
                setCenterName(name);
                if (!centerCodeEdited) setCenterCode(suggestCenterCode(name));
              }}
            />

            <label className="centers-code-field">
              <span>Center Code</span>
              <input
                type="text"
                aria-label="Center Code"
                placeholder="LA"
                maxLength={8}
                value={centerCode}
                onChange={(event) => {
                  setCenterCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
                  setCenterCodeEdited(true);
                }}
              />
            </label>

            <button className="centers-primary-button" onClick={handleSaveCenter}>
              {editingCenterId ? "Update Center" : "Create Center"}
            </button>
          </div>
        </section>
      )}

      {/* ========================= */}
      {/* CENTERS TABLE */}
      {/* ========================= */}

      <div className="centers-table-wrap">
      <table className="centers-table">
        <caption className="sr-only">Centers and available management actions</caption>

        <thead>
  <tr>
    {!isAcademyOwner(user) && <th scope="col">Academy</th>}
    <th scope="col">Center Name</th>
    {(isSuperAdmin(user) || isAcademyOwner(user)) && <th scope="col">Assigned Coaches</th>}
    {(isSuperAdmin(user) || isAcademyOwner(user)) && (
      <th scope="col" className="centers-actions-heading">Actions</th>
    )}
  </tr>
</thead>

<tbody>
  {filteredCenters.length === 0 ? (
    <tr>
      <td className="centers-empty-state" colSpan={isAcademyOwner(user) ? 3 : isSuperAdmin(user) ? 4 : 2}>
        <strong>No active centers</strong>
        <span>{isSuperAdmin(user) && selectedAcademy ? "No centers match the selected academy." : "No active centers are available in your current scope."}</span>
      </td>
    </tr>
  ) : (
    paginatedCenters.map((center) => {
      const academyName =
        academies.find((academy) => academy.id === center.academy_id)?.academy_name ||
        (center.academy_id === user?.academy_id ? user?.academy_name : "") ||
        "—";
      const isSelected = selectedCenterId === center.id;

      return (
        <tr
          key={center.id}
          className={isSelected ? "centers-row-selected" : ""}
          onClick={() => setSelectedCenterId(center.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setSelectedCenterId(center.id);
            }
          }}
          tabIndex={0}
        >
          {!isAcademyOwner(user) && <td className="centers-academy-cell">{academyName}</td>}
          <td className="centers-name-cell">
            <Link
              className="centers-drilldown-link"
              to={`/batches?academyId=${center.academy_id}&centerId=${center.id}`}
              onClick={(event) => event.stopPropagation()}
              aria-label={`Open batches for ${center.center_name}`}
            >
              <span className="centers-code-badge">{center.center_code || suggestCenterCode(center.center_name)}</span>
              <span>{center.center_name}</span>
            </Link>
          </td>

          {(isSuperAdmin(user) || isAcademyOwner(user)) && <td className="centers-coaches-cell">
            {(coachesByCenter[center.id] || []).length ? (
              <div className="centers-coaches-list">
                <strong>{coachesByCenter[center.id].length} coach{coachesByCenter[center.id].length === 1 ? "" : "es"}</strong>
                <span>{coachesByCenter[center.id].map(coach => coach.name).join(", ")}</span>
              </div>
            ) : <span className="centers-unassigned">Not assigned</span>}
          </td>}
          {(isSuperAdmin(user) || isAcademyOwner(user)) && (
            <td className="centers-actions-cell">
              <div className="centers-row-actions">
                <button
                  type="button"
                  className="centers-edit-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleEdit(center);
                  }}
                  aria-label={`Edit ${center.center_name}`}
                >
                  ✏️
                </button>
                <button
                  type="button"
                  className="centers-delete-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDelete(center.id);
                  }}
                  aria-label={`Delete ${center.center_name}`}
                >
                  🗑️
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

      {filteredCenters.length > 0 && (
        <div className="centers-pagination" aria-label="Centers pagination">
          <span className="centers-pagination-summary">
            Showing {pageStartIndex + 1}–{Math.min(pageStartIndex + PAGE_SIZE, filteredCenters.length)} of {filteredCenters.length} centers
          </span>

          <div className="centers-pagination-controls">
            <button
              type="button"
              className="centers-pagination-button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              Previous
            </button>

            <span className="centers-pagination-page">
              Page {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              className="centers-pagination-button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </div>
      )}
      </div>

    </div>
  </Layout>
);
};

export default Centers;