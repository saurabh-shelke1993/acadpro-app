import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../services/supabase";
import {
  createPlayerTransactional,
  updatePlayerTransactional,
} from "../services/playerService";

import {
  getLoggedInUser,
  isSuperAdmin,
} from "../utils/auth";

import {
  isAcademyOwner,
  isCoach,
} from "../utils/roles";

import {
  getAccessibleCenters,
  getAccessibleBatches,
  getAccessibleAcademies,
  getCoachAssignedBatchIds,
} from "../utils/dataScope";

import Layout from "../components/Layout";
import PlayerImport from "../components/PlayerImport";
import "./Players.css";

function Players() {
 const [searchParams] = useSearchParams();
 const [loggedInUser, setLoggedInUser] =
  useState(null);
     const [players, setPlayers] = useState([]);

  const [academies, setAcademies] = useState([]);
  const [centers, setCenters] = useState([]);
  const [batches, setBatches] = useState([]);

  const [selectedAcademy, setSelectedAcademy] = useState(() => searchParams.get("academyId") || "");
  const [selectedCenter, setSelectedCenter] = useState(() => searchParams.get("centerId") || "");
  const [selectedBatch, setSelectedBatch] = useState(() => searchParams.get("batchId") || "");

  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");

  const [joiningDate, setJoiningDate] = useState(
  new Date().toISOString().split("T")[0]
);


  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentAddress, setParentAddress] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editingParentId, setEditingParentId] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [openFilter, setOpenFilter] = useState(null);
  const [selectedCoachPlayer, setSelectedCoachPlayer] = useState(null);
  const [columnFilters, setColumnFilters] = useState({
    academy: [],
    center: [],
    batch: [],
    gender: [],
    status: [],
  });

  const PAGE_SIZE = 8;

useEffect(() => {
  fetchLoggedInUser();
}, []);

const fetchLoggedInUser =
async () => {

  const user =
    await getLoggedInUser();

  setLoggedInUser(user);

};

  useEffect(() => {
    if (selectedAcademy) {
      fetchCenters(selectedAcademy);
    }
  }, [selectedAcademy]);

  useEffect(() => {
    if (selectedCenter) {
      fetchBatches(selectedCenter);
    }
  }, [selectedCenter]);

useEffect(() => {

  if (!loggedInUser) return;

  fetchAcademies();
  fetchPlayers();

}, [loggedInUser]);

  const formatCoachDob = (dob) => {
    if (!dob) return "—";
    const date = new Date(dob);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  };

  const calculateAge = (dob) => {
    if (!dob) return "";

    const birthDate = new Date(dob);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

    const monthDiff =
      today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 &&
        today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  };
  const fetchAcademies = async () => {

  if (!loggedInUser) return;

  try {

    const data =
      await getAccessibleAcademies(
        loggedInUser
      );

    setAcademies(data || []);

    // Non-Super Admin users have only
    // one accessible academy.
    if (
      !isSuperAdmin(loggedInUser) &&
      data &&
      data.length > 0
    ) {
      setSelectedAcademy(data[0].id);
    }

  } catch (error) {

    console.error(
      "Failed to load accessible academies:",
      error
    );

    setAcademies([]);
  }
};

 const fetchCenters = async () => {
  if (!loggedInUser || !selectedAcademy) {
    setCenters([]);
    return;
  }

  try {
    const data = await getAccessibleCenters(
      loggedInUser
    );

    const filtered = (data || []).filter(
      (center) =>
        center.academy_id === selectedAcademy
    );

    setCenters(filtered);

    if (
      selectedCenter &&
      !filtered.some(
        (center) =>
          center.id === selectedCenter
      )
    ) {
      setSelectedCenter("");
      setSelectedBatch("");
    }
  } catch (error) {
    console.error(
      "Failed to load accessible centers:",
      error
    );

    setCenters([]);
  }
};
const fetchBatches = async () => {
  if (
    !loggedInUser ||
    !selectedCenter
  ) {
    setBatches([]);
    setSelectedBatch("");
    return;
  }

  try {
    const data =
      await getAccessibleBatches(
        loggedInUser,
        selectedCenter
      );

    setBatches(data || []);

    if (
      selectedBatch &&
      !(data || []).some(
        (batch) =>
          batch.id === selectedBatch
      )
    ) {
      setSelectedBatch("");
    }
  } catch (error) {
    console.error(
      "Failed to load accessible batches:",
      error
    );

    setBatches([]);
    setSelectedBatch("");
  }
};
  const fetchPlayers = async () => {
  if (!loggedInUser) {
    return;
  }

  try {
    // ========================================
    // COACH
    // ========================================

    if (isCoach(loggedInUser)) {
      const assignedBatchIds =
        await getCoachAssignedBatchIds(loggedInUser);

      if (!assignedBatchIds.length) {
        setPlayers([]);
        return;
      }

      let query = supabase
        .from("players")
        .select(`
          *,
          academies(academy_name),
          centers(center_name),
          batches(batch_name),
          parents(
            parent_name,
            phone,
            email,
            address
          ),
          player_batches!inner(
            batch_id
          )
        `)
        .eq("is_active", true)
        .in(
          "player_batches.batch_id",
          assignedBatchIds
        );

      if (selectedAcademy) {
        query = query.eq(
          "academy_id",
          selectedAcademy
        );
      }

      if (selectedCenter) {
        query = query.eq(
          "center_id",
          selectedCenter
        );
      }

      if (selectedBatch) {
        query = query.eq(
          "batch_id",
          selectedBatch
        );
      }

      const {
        data,
        error
      } = await query;

      if (error) {
        throw error;
      }

      setPlayers(data || []);
      return;
    }

    // ========================================
    // SUPER ADMIN
    // ========================================

    if (isSuperAdmin(loggedInUser)) {
      let query = supabase
        .from("players")
        .select(`
          *,
          academies(academy_name),
          centers(center_name),
          batches(batch_name),
          parents(
            parent_name,
            phone,
            email,
            address
          )
        `)
        .eq("is_active", true);

      if (selectedAcademy) {
        query = query.eq(
          "academy_id",
          selectedAcademy
        );
      }

      if (selectedCenter) {
        query = query.eq(
          "center_id",
          selectedCenter
        );
      }

      if (selectedBatch) {
        query = query.eq(
          "batch_id",
          selectedBatch
        );
      }

      const {
        data,
        error
      } = await query;

      if (error) {
        throw error;
      }

      setPlayers(data || []);
      return;
    }

    // ========================================
    // ACADEMY OWNER
    // ========================================

    if (isAcademyOwner(loggedInUser)) {
      const academyId = loggedInUser.academy_id;

      if (!academyId) {
        console.error(
          "Academy Owner has no academy_id"
        );
        setPlayers([]);
        return;
      }

      let query = supabase
        .from("players")
        .select(`
          *,
          academies(academy_name),
          centers(center_name),
          batches(batch_name),
          parents(
            parent_name,
            phone,
            email,
            address
          )
        `)
        .eq("is_active", true)
        .eq("academy_id", academyId);

      if (selectedCenter) {
        query = query.eq(
          "center_id",
          selectedCenter
        );
      }

      if (selectedBatch) {
        query = query.eq(
          "batch_id",
          selectedBatch
        );
      }

      const {
        data,
        error
      } = await query;

      if (error) {
        throw error;
      }

      setPlayers(data || []);
      return;
    }

    // ========================================
    // UNKNOWN ROLE
    // ========================================

    console.error(
      "Unsupported user role:",
      loggedInUser.role
    );

    setPlayers([]);

  } catch (error) {
    console.error(
      "Failed to load players:",
      error
    );

    setPlayers([]);
  }
};
  const validateForm = () => {
    if (
      !selectedAcademy ||
      !selectedCenter ||
      !selectedBatch ||
      !fullName
    ) {
      alert("Please fill required fields");
      return false;
    }

    if (!gender) {
  alert("Please select gender");
  return false;
}
if (!dob) {
  alert("Please select Date of Birth");
  return false;
}
if (!joiningDate) {
  alert("Please select Joining Date");
  return false;
}

    if (!/^\d{10}$/.test(parentPhone)) {
      alert(
        "Parent phone must be exactly 10 digits"
      );
      return false;
    }

    if (!parentEmail.includes("@")) {
      alert("Invalid parent email");
      return false;
    }

    return true;
  };

 const handleCreatePlayer = async () => {
  if (!validateForm()) return;

  const academyId = isAcademyOwner(loggedInUser)
    ? loggedInUser.academy_id
    : selectedAcademy;

  if (!academyId) {
    alert("Academy is required");
    return;
  }

  try {
    await createPlayerTransactional({
      academyId,
      parentName,
      parentPhone,
      parentEmail,
      parentAddress,
      fullName,
      dob,
      gender,
      joiningDate,
      centerId: selectedCenter,
      batchId: selectedBatch,
    });

    alert("Player Created Successfully");

    resetForm();
    fetchPlayers();
  } catch (error) {
    console.error("Failed to create player:", error);
    alert(error.message || "Failed to create player.");
  }
};

  const handleEditPlayer = (player) => {
    setIsEditing(true);

    setEditingPlayerId(player.id);
    setEditingParentId(player.parent_id);

    setSelectedAcademy(player.academy_id);
    setSelectedCenter(player.center_id);
    setSelectedBatch(player.batch_id);

    setFullName(player.full_name);
    setDob(player.dob || "");
    setGender(player.gender || "");
    setJoiningDate(player.joining_date || "");
    setParentName(
      player.parents?.parent_name || ""
    );

    setParentPhone(player.parents?.phone || "");

    setParentEmail(player.parents?.email || "");

    setParentAddress(
      player.parents?.address || ""
    );
  };

const handleUpdatePlayer = async () => {
  if (!validateForm()) return;

  const academyId = isAcademyOwner(loggedInUser)
    ? loggedInUser.academy_id
    : selectedAcademy;

  if (!academyId) {
    alert("Academy is required");
    return;
  }

  try {
    await updatePlayerTransactional({
      playerId: editingPlayerId,
      academyId,
      parentId: editingParentId,
      parentName,
      parentPhone,
      parentEmail,
      parentAddress,
      fullName,
      dob,
      gender,
      joiningDate,
      centerId: selectedCenter,
      batchId: selectedBatch,
    });

    alert("Player Updated Successfully");

    resetForm();
    setIsEditing(false);
    fetchPlayers();
  } catch (error) {
    console.error("Failed to update player:", error);
    alert(error.message || "Failed to update player.");
  }
};

  const handleDeletePlayer = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to deactivate this player?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("players")
      .update({
        is_active: false,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Player Deactivated");

    fetchPlayers();
  };

const resetForm = () => {
  setFullName("");
  setDob("");

  setGender("");

  setJoiningDate(
    new Date().toISOString().split("T")[0]
  );

  setParentName("");
  setParentPhone("");
  setParentEmail("");
  setParentAddress("");

  setIsEditing(false);
  setEditingPlayerId(null);
  setEditingParentId(null);
  setSelectedCenter("");
setSelectedBatch("");
};

  useEffect(() => {
    if (!openFilter) return;

    const handleOutsideClick = (event) => {
      if (!event.target.closest(".players-column-filter")) {
        setOpenFilter(null);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpenFilter(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openFilter]);

  const getUniqueFilterValues = (getter) =>
    [...new Set(players.map(getter).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b)));

  const filterOptions = {
    academy: getUniqueFilterValues(
      (player) => player.academies?.academy_name || "—"
    ),
    center: getUniqueFilterValues(
      (player) => player.centers?.center_name || "—"
    ),
    batch: getUniqueFilterValues(
      (player) => player.batches?.batch_name || "—"
    ),
    gender: getUniqueFilterValues(
      (player) => player.gender || "—"
    ),
    status: getUniqueFilterValues(
      (player) => player.player_status || "Active"
    ),
  };

  const toggleColumnFilterValue = (column, value) => {
    setColumnFilters((current) => {
      const values = current[column];
      return {
        ...current,
        [column]: values.includes(value)
          ? values.filter((item) => item !== value)
          : [...values, value],
      };
    });
    setCurrentPage(1);
  };

  const clearColumnFilter = (column) => {
    setColumnFilters((current) => ({
      ...current,
      [column]: [],
    }));
    setCurrentPage(1);
  };

  const clearAllColumnFilters = () => {
    setSearchTerm("");
    setColumnFilters({
      academy: [],
      center: [],
      batch: [],
      gender: [],
      status: [],
    });
    setCurrentPage(1);
    setOpenFilter(null);
  };

  const activeFilterCount =
    (searchTerm.trim() ? 1 : 0) +
    Object.values(columnFilters).filter((values) => values.length > 0).length;

  const filteredPlayers = players.filter((player) => {
    const matchesPlayer =
      !searchTerm.trim() ||
      player.full_name
        ?.toLowerCase()
        .includes(searchTerm.trim().toLowerCase());

    const matchesColumn = (column, value) =>
      columnFilters[column].length === 0 ||
      columnFilters[column].includes(value);

    return (
      matchesPlayer &&
      matchesColumn(
        "academy",
        player.academies?.academy_name || "—"
      ) &&
      matchesColumn(
        "center",
        player.centers?.center_name || "—"
      ) &&
      matchesColumn(
        "batch",
        player.batches?.batch_name || "—"
      ) &&
      matchesColumn(
        "gender",
        player.gender || "—"
      ) &&
      matchesColumn(
        "status",
        player.player_status || "Active"
      )
    );
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPlayers.length / PAGE_SIZE)
  );

  const paginatedPlayers = filteredPlayers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const renderColumnFilter = (column, label, options, type = "list") => {
    const isOpen = openFilter === column;
    const selectedValues = columnFilters[column] || [];

    return (
      <div className="players-column-filter">
        <button
          type="button"
          className={`players-filter-trigger${selectedValues.length || (column === "player" && searchTerm.trim()) ? " players-filter-trigger-active" : ""}`}
          onClick={() => setOpenFilter(isOpen ? null : column)}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-label={`Filter ${label}`}
        >
          <span>{label}</span>
          <span aria-hidden="true">⌄</span>
        </button>

        {isOpen && (
          <div className="players-filter-popover" role="dialog" aria-label={`${label} filter`}>
            {type === "text" ? (
              <div className="players-filter-search">
                <input
                  autoFocus
                  type="search"
                  placeholder={`Search ${label.toLowerCase()}...`}
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            ) : (
              <>
                <div className="players-filter-popover-header">
                  <strong>Filter {label}</strong>
                  {selectedValues.length > 0 && (
                    <button
                      type="button"
                      className="players-filter-clear-button"
                      onClick={() => clearColumnFilter(column)}
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="players-filter-options">
                  {options.length === 0 ? (
                    <span className="players-filter-empty">No values available</span>
                  ) : (
                    options.map((option) => (
                      <label key={option} className="players-filter-option">
                        <input
                          type="checkbox"
                          checked={selectedValues.includes(option)}
                          onChange={() => toggleColumnFilterValue(column, option)}
                        />
                        <span>{option}</span>
                      </label>
                    ))
                  )}
                </div>
              </>
            )}

            <div className="players-filter-popover-footer">
              <button
                type="button"
                className="players-filter-done-button"
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

return (
  <Layout>
    <div className={`players-page${isCoach(loggedInUser) ? " players-page-coach" : ""}${isAcademyOwner(loggedInUser) ? " players-page-owner" : ""}`}>
      <div className="players-page-header">
        <div>
          <span className="players-page-eyebrow">Academy management</span>
          <h1>Players</h1>
          <p>Manage player profiles, batches, and parent information.</p>
        </div>
        <div className="players-page-count">
          <strong>{filteredPlayers.length}</strong>
          <span>visible players</span>
        </div>
      </div>

      {!isCoach(loggedInUser) && (
        <div className="players-create-import-workspace">
          <section className="players-form-card players-form-card-create">
          <div className="players-section-heading">
            <div>
              <span className="players-section-eyebrow">
                {isEditing ? "Edit player" : "Create player"}
              </span>
              <h2>{isEditing ? "Edit Player" : "New Player"}</h2>
            </div>
            <p>
              {isEditing
                ? "Update the selected player's profile and parent information."
                : "Add a player to the selected academy, center, and batch."}
            </p>
          </div>

          <div className="players-form-section">
            <h3>Player information</h3>
            <div className="players-form-grid">
              <div className="players-field players-field-wide">
                <label htmlFor="player-full-name">Player name *</label>
                <input
                  id="player-full-name"
                  type="text"
                  placeholder="Player Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="players-field">
                <label htmlFor="player-dob">Date of Birth *</label>
                <input
                  id="player-dob"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
              </div>

              <div className="players-field">
                <label htmlFor="player-joining-date">Joining Date *</label>
                <input
                  id="player-joining-date"
                  type="date"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                />
              </div>

              <div className="players-field">
                <label htmlFor="player-gender">Gender *</label>
                <select
                  id="player-gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              {isSuperAdmin(loggedInUser) ? (
                <div className="players-field">
                  <label htmlFor="player-academy">Academy *</label>
                  <select
                    id="player-academy"
                    value={selectedAcademy}
                    onChange={(e) => {
                      setSelectedAcademy(e.target.value);
                      setSelectedCenter("");
                      setSelectedBatch("");
                    }}
                  >
                    <option value="">Select Academy</option>
                    {academies.map((academy) => (
                      <option key={academy.id} value={academy.id}>
                        {academy.academy_name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="players-field">
                  <label htmlFor="player-academy">Academy</label>
                  <input
                    id="player-academy"
                    type="text"
                    value={
                      academies.find(
                        (academy) => academy.id === selectedAcademy
                      )?.academy_name ||
                      loggedInUser?.academy_name ||
                      ""
                    }
                    disabled
                  />
                </div>
              )}

              <div className="players-field">
                <label htmlFor="player-center">Center *</label>
                <select
                  id="player-center"
                  value={selectedCenter}
                  onChange={(e) => {
                    setSelectedCenter(e.target.value);
                    setSelectedBatch("");
                  }}
                  disabled={!selectedAcademy}
                >
                  <option value="">Select Center</option>
                  {centers.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.center_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="players-field">
                <label htmlFor="player-batch">Batch *</label>
                <select
                  id="player-batch"
                  value={selectedBatch}
                  onChange={(e) => setSelectedBatch(e.target.value)}
                  disabled={!selectedCenter}
                >
                  <option value="">Select Batch</option>
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.batch_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="players-form-section">
            <h3>Parent information</h3>
            <div className="players-form-grid">
              <div className="players-field">
                <label htmlFor="player-parent-name">Parent name</label>
                <input
                  id="player-parent-name"
                  type="text"
                  placeholder="Parent Name"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                />
              </div>

              <div className="players-field">
                <label htmlFor="player-parent-phone">Parent phone</label>
                <input
                  id="player-parent-phone"
                  type="text"
                  placeholder="Parent Phone"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                />
              </div>

              <div className="players-field">
                <label htmlFor="player-parent-email">Parent email</label>
                <input
                  id="player-parent-email"
                  type="email"
                  placeholder="Parent Email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                />
              </div>

              <div className="players-field players-field-wide">
                <label htmlFor="player-parent-address">Parent address</label>
                <textarea
                  id="player-parent-address"
                  placeholder="Parent Address"
                  value={parentAddress}
                  onChange={(e) => setParentAddress(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="players-form-actions">
            <button
              className="player-primary-button"
              type="button"
              onClick={isEditing ? handleUpdatePlayer : handleCreatePlayer}
            >
              {isEditing ? "Update Player" : "Create Player"}
            </button>
            <button
              className="player-secondary-button"
              type="button"
              onClick={resetForm}
            >
              Clear
            </button>
          </div>
          </section>

          {isSuperAdmin(loggedInUser) && (
            <section className="players-form-card players-import-card">
              <div className="players-section-heading">
                <div>
                  <span className="players-section-eyebrow">Bulk import</span>
                  <h2>Import Players</h2>
                </div>
                <p>Upload multiple players from the Excel template.</p>
              </div>

              <PlayerImport
                loggedInUser={loggedInUser}
                onImportComplete={fetchPlayers}
              />
            </section>
          )}
        </div>
      )}

      <section className="players-results-section">
        <div className="players-list-header">
          <div>
            <span className="players-section-eyebrow">Active players</span>
            <h2>Players List</h2>
            <p>
              {filteredPlayers.length}{" "}
              {filteredPlayers.length === 1 ? "player" : "players"} shown
            </p>
          </div>
          <div className="players-list-filter-summary">
            {activeFilterCount > 0 && (
              <>
                <span>
                  {activeFilterCount} active filter
                  {activeFilterCount === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  className="player-secondary-button"
                  onClick={clearAllColumnFilters}
                >
                  Clear all
                </button>
              </>
            )}
            <span>Page {currentPage} of {totalPages}</span>
          </div>
        </div>

        <div className="players-table-wrap">
          <table className="players-table">
            <caption className="sr-only">
              Active players and their academy, batch, status, and available actions
            </caption>
            <thead>
              <tr>
                <th scope="col">{renderColumnFilter("player", "Player", [], "text")}</th>
                {!isCoach(loggedInUser) && <th scope="col">{renderColumnFilter("academy", "Academy", filterOptions.academy)}</th>}
                <th scope="col">{renderColumnFilter("center", "Center", filterOptions.center)}</th>
                <th scope="col">{renderColumnFilter("batch", "Batch", filterOptions.batch)}</th>
                {!isCoach(loggedInUser) && (
                  <>
                    <th scope="col">DOB</th>
                    <th scope="col">{renderColumnFilter("gender", "Gender", filterOptions.gender)}</th>
                    <th scope="col">Joining Date</th>
                    <th scope="col">{renderColumnFilter("status", "Status", filterOptions.status)}</th>
                    <th scope="col">Parent Phone</th>
                    <th scope="col">Actions</th>
                  </>
                )}
              </tr>
            </thead>

            <tbody>
              {paginatedPlayers.length === 0 ? (
                <tr>
                  <td
                    className="players-empty-state"
                    colSpan={isCoach(loggedInUser) ? 3 : 10}
                  >
                    <strong>No players found</strong>
                    <span>
                      {searchTerm
                        ? "Try a different player name."
                        : "No active players match the current filters."}
                    </span>
                  </td>
                </tr>
              ) : (
                paginatedPlayers.map((player) => (
                  <tr
                    key={player.id}
                    className={isCoach(loggedInUser) ? "players-coach-row" : ""}
                    onClick={() => (isCoach(loggedInUser) || isAcademyOwner(loggedInUser)) && setSelectedCoachPlayer(player)}
                    onKeyDown={(event) => {
                      if ((isCoach(loggedInUser) || isAcademyOwner(loggedInUser)) && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        setSelectedCoachPlayer(player);
                      }
                    }}
                    tabIndex={isCoach(loggedInUser) || isAcademyOwner(loggedInUser) ? 0 : undefined}
                  >
                    <td className="player-name-cell">{player.full_name}</td>
                    {!isCoach(loggedInUser) && <td>{player.academies?.academy_name || "—"}</td>}
                    <td>{player.centers?.center_name || "—"}</td>
                    <td>{player.batches?.batch_name || "—"}</td>
                    {!isCoach(loggedInUser) && (
                      <>
                        <td>{calculateAge(player.dob) || "—"}</td>
                        <td>{player.gender || "—"}</td>
                        <td>{player.joining_date || "—"}</td>
                        <td>
                          <span className="player-status-badge">{player.player_status || "Active"}</span>
                        </td>
                        <td>{player.parents?.phone || "—"}</td>
                        <td>
                          <div className="player-row-actions">
                            <button
                              className="player-action-button player-action-edit"
                              type="button"
                              onClick={() => handleEditPlayer(player)}
                              aria-label={`Edit ${player.full_name}`}
                            >
                              Edit
                            </button>
                            <button
                              className="player-action-button player-action-danger"
                              type="button"
                              onClick={() => handleDeletePlayer(player.id)}
                              aria-label={`Deactivate ${player.full_name}`}
                            >
                              Deactivate
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {(isCoach(loggedInUser) || isAcademyOwner(loggedInUser)) && selectedCoachPlayer ? (
          <div className="coach-player-modal-backdrop" role="presentation" onClick={() => setSelectedCoachPlayer(null)}>
            <section
              className="coach-player-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="coach-player-detail-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="coach-player-modal-header">
                <div>
                  <span className="players-page-eyebrow">Player details</span>
                  <h2 id="coach-player-detail-title">{selectedCoachPlayer.full_name}</h2>
                </div>
                <button type="button" className="coach-player-modal-close" onClick={() => setSelectedCoachPlayer(null)} aria-label="Close player details">×</button>
              </div>
              <div className="coach-player-detail-grid">
                <div><span>Center</span><strong>{selectedCoachPlayer.centers?.center_name || "—"}</strong></div>
                <div><span>Batch</span><strong>{selectedCoachPlayer.batches?.batch_name || "—"}</strong></div>
                <div><span>Date of birth</span><strong>{formatCoachDob(selectedCoachPlayer.dob)}</strong></div>
                <div><span>Gender</span><strong>{selectedCoachPlayer.gender === "Male" ? "Male" : selectedCoachPlayer.gender === "Female" ? "Female" : "—"}</strong></div>
                <div><span>Joining date</span><strong>{selectedCoachPlayer.joining_date || "—"}</strong></div>
                <div><span>Parent</span><strong>{selectedCoachPlayer.parents?.parent_name || "—"}</strong></div>
                <div><span>Parent phone</span><strong>{selectedCoachPlayer.parents?.phone || "—"}</strong></div>
                <div><span>Parent email</span><strong>{selectedCoachPlayer.parents?.email || "—"}</strong></div>
                <div className="coach-player-detail-wide"><span>Address</span><strong>{selectedCoachPlayer.parents?.address || "—"}</strong></div>
              </div>
            </section>
          </div>
        ) : null}

        <div className="players-pagination">
          <span>
            Showing{" "}
            {filteredPlayers.length === 0
              ? 0
              : (currentPage - 1) * PAGE_SIZE + 1}
            –
            {Math.min(currentPage * PAGE_SIZE, filteredPlayers.length)} of{" "}
            {filteredPlayers.length} players
          </span>

          <div className="players-pagination-controls">
            <button
              type="button"
              className="player-secondary-button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <strong>Page {currentPage} of {totalPages}</strong>
            <button
              type="button"
              className="player-secondary-button"
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  </Layout>
);
}

export default Players;