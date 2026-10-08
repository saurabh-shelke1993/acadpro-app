import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import "./Coaches.css";
import { supabase } from "../supabaseClient";

import {
  getCurrentUser,
  isSuperAdmin,
} from "../utils/auth";

import {
  isAcademyOwner,
  isCoach,
} from "../utils/roles";

function Coaches() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [academies, setAcademies] = useState([]);
  const [coaches, setCoaches] = useState([]);

  // Create / edit form state is intentionally independent from table filters.
  const [selectedAcademy, setSelectedAcademy] = useState("");
  const [editingCoachId, setEditingCoachId] = useState(null);
  const [selectedCoachId, setSelectedCoachId] = useState(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [bio, setBio] = useState("");
  const [profileImage, setProfileImage] = useState("");

  // Table filters.
  const [searchTerm, setSearchTerm] = useState("");
  const [columnFilters, setColumnFilters] = useState({
    academy: [],
    email: [],
    phone: [],
    specialization: [],
    status: [],
  });
  const [openFilter, setOpenFilter] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const PAGE_SIZE = 10;

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
  };

  useEffect(() => {
    if (!user) return;
    fetchAcademies();
    fetchCoaches();
  }, [user]);

  const fetchAcademies = async () => {
    try {
      let query = supabase
        .from("academies")
        .select("id, academy_name")
        .eq("is_active", true)
        .order("academy_name", { ascending: true });

      if (!isSuperAdmin(user)) {
        query = query.eq("id", user.academy_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      setAcademies(data || []);

      if (!isSuperAdmin(user) && data?.length) {
        setSelectedAcademy(data[0].id);
      }
    } catch (error) {
      console.error("Failed to load academies:", error);
      setAcademies([]);
    }
  };

  const fetchCoaches = async () => {
    try {
      let query = supabase
        .from("coaches")
        .select("*, academies(academy_name)")
        .order("created_at", { ascending: false });

      if (isAcademyOwner(user)) {
        query = query.eq("academy_id", user.academy_id);
      }

      // Coach visibility is additionally enforced by RLS. The explicit
      // user_id condition keeps the page intentional for the coach role.
      if (isCoach(user)) {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      setCoaches(data || []);
      setCurrentPage(1);
      setSelectedCoachId(null);
    } catch (error) {
      console.error("Failed to load coaches:", error);
      setCoaches([]);
    }
  };

  const resetForm = () => {
    setEditingCoachId(null);
    setFullName("");
    setEmail("");
    setPhone("");
    setSpecialization("");
    setExperienceYears("");
    setJoiningDate("");
    setBio("");
    setProfileImage("");

    if (!isSuperAdmin(user)) {
      setSelectedAcademy(user?.academy_id || "");
    } else {
      setSelectedAcademy("");
    }
  };

  const addOrUpdateCoach = async () => {
    const academyId = isSuperAdmin(user)
      ? selectedAcademy
      : user?.academy_id;

    if (!academyId || !fullName.trim()) {
      alert("Academy and Coach Name are required");
      return;
    }

    try {
      if (editingCoachId) {
        const { error } = await supabase
          .from("coaches")
          .update({
            academy_id: academyId,
            full_name: fullName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            specialization: specialization.trim(),
            experience_years: experienceYears === "" ? null : Number(experienceYears),
            joining_date: joiningDate || null,
            bio: bio.trim() || null,
            profile_image: profileImage.trim() || null,
          })
          .eq("id", editingCoachId);

        if (error) throw error;

        alert("Coach Updated");
      } else {
        const { error } = await supabase
          .from("coaches")
          .insert([
            {
              academy_id: academyId,
              full_name: fullName.trim(),
              email: email.trim(),
              phone: phone.trim(),
              specialization: specialization.trim(),
              experience_years: experienceYears === "" ? null : Number(experienceYears),
              joining_date: joiningDate || null,
              bio: bio.trim() || null,
              profile_image: profileImage.trim() || null,
            },
          ]);

        if (error) throw error;

        alert("Coach Added");
      }

      resetForm();
      await fetchCoaches();
    } catch (error) {
      console.error("Failed to save coach:", error);
      alert(error.message || "Failed to save coach.");
    }
  };

  const handleEditCoach = (coach) => {
    setEditingCoachId(coach.id);
    setSelectedCoachId(coach.id);
    setSelectedAcademy(coach.academy_id || "");
    setFullName(coach.full_name || "");
    setEmail(coach.email || "");
    setPhone(coach.phone || "");
    setSpecialization(coach.specialization || "");
    setExperienceYears(
      coach.experience_years === null || coach.experience_years === undefined
        ? ""
        : String(coach.experience_years)
    );
    setJoiningDate(coach.joining_date || "");
    setBio(coach.bio || "");
    setProfileImage(coach.profile_image || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggleCoachStatus = async (coach) => {
    const nextStatus = !coach.is_active;
    const action = nextStatus ? "activate" : "deactivate";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${coach.full_name}?`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("coaches")
        .update({ is_active: nextStatus })
        .eq("id", coach.id);

      if (error) throw error;

      alert(`Coach ${nextStatus ? "Activated" : "Deactivated"}`);
      setSelectedCoachId(null);
      await fetchCoaches();
    } catch (error) {
      console.error("Failed to update coach status:", error);
      alert(error.message || "Failed to update coach status.");
    }
  };

  const getUniqueFilterValues = (getter) =>
    [...new Set(coaches.map(getter).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b)));

  const filterOptions = {
    academy: getUniqueFilterValues(
      (coach) => coach.academies?.academy_name || "—"
    ),
    email: getUniqueFilterValues(
      (coach) => coach.email || "—"
    ),
    phone: getUniqueFilterValues(
      (coach) => coach.phone || "—"
    ),
    specialization: getUniqueFilterValues(
      (coach) => coach.specialization || "—"
    ),
    status: getUniqueFilterValues(
      (coach) => (coach.is_active ? "Active" : "Inactive")
    ),
  };

  const toggleColumnFilterValue = (column, value) => {
    setColumnFilters((current) => ({
      ...current,
      [column]: current[column].includes(value)
        ? current[column].filter((item) => item !== value)
        : [...current[column], value],
    }));
    setCurrentPage(1);
  };

  const clearColumnFilter = (column) => {
    setColumnFilters((current) => ({
      ...current,
      [column]: [],
    }));
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setColumnFilters({
      academy: [],
      email: [],
      phone: [],
      specialization: [],
      status: [],
    });
    setCurrentPage(1);
    setOpenFilter(null);
  };

  const activeFilterCount =
    (searchTerm.trim() ? 1 : 0) +
    Object.values(columnFilters).filter(
      (values) => values.length > 0
    ).length;

  const filteredCoaches = coaches.filter((coach) => {
    const matchesCoach =
      !searchTerm.trim() ||
      String(coach.full_name || "")
        .toLowerCase()
        .includes(searchTerm.trim().toLowerCase());

    const matchesColumn = (column, value) =>
      columnFilters[column].length === 0 ||
      columnFilters[column].includes(value);

    return (
      matchesCoach &&
      matchesColumn(
        "academy",
        coach.academies?.academy_name || "—"
      ) &&
      matchesColumn("email", coach.email || "—") &&
      matchesColumn("phone", coach.phone || "—") &&
      matchesColumn(
        "specialization",
        coach.specialization || "—"
      ) &&
      matchesColumn(
        "status",
        coach.is_active ? "Active" : "Inactive"
      )
    );
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCoaches.length / PAGE_SIZE)
  );

  const paginatedCoaches = filteredCoaches.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!openFilter) return;

    const handleOutsideClick = (event) => {
      if (!event.target.closest(".coaches-column-filter")) {
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

  const renderColumnFilter = (
    column,
    label,
    options,
    type = "list"
  ) => {
    const isOpen = openFilter === column;
    const selectedValues = columnFilters[column] || [];

    return (
      <div className="coaches-column-filter">
        <button
          type="button"
          className={`coaches-filter-trigger${
            selectedValues.length ||
            (column === "coach" && searchTerm.trim())
              ? " coaches-filter-trigger-active"
              : ""
          }`}
          onClick={() =>
            setOpenFilter(isOpen ? null : column)
          }
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-label={`Filter ${label}`}
        >
          <span>{label}</span>
          <span aria-hidden="true">⌄</span>
        </button>

        {isOpen && (
          <div
            className="coaches-filter-popover"
            role="dialog"
            aria-label={`${label} filter`}
          >
            {type === "text" ? (
              <div className="coaches-filter-search">
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
                <div className="coaches-filter-popover-header">
                  <strong>Filter {label}</strong>
                  {selectedValues.length > 0 && (
                    <button
                      type="button"
                      className="coaches-filter-clear-button"
                      onClick={() =>
                        clearColumnFilter(column)
                      }
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="coaches-filter-options">
                  {options.length === 0 ? (
                    <span className="coaches-filter-empty">
                      No values available
                    </span>
                  ) : (
                    options.map((option) => (
                      <label
                        key={option}
                        className="coaches-filter-option"
                      >
                        <input
                          type="checkbox"
                          checked={selectedValues.includes(option)}
                          onChange={() =>
                            toggleColumnFilterValue(
                              column,
                              option
                            )
                          }
                        />
                        <span>{option}</span>
                      </label>
                    ))
                  )}
                </div>
              </>
            )}

            <div className="coaches-filter-popover-footer">
              <button
                type="button"
                className="coaches-filter-done-button"
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

  const getInitials = (name) =>
    String(name || "Coach")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");

  const handleRowKeyDown = (event, coachId) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedCoachId(
        selectedCoachId === coachId ? null : coachId
      );
    }
  };

  const canManageCoaches =
    isSuperAdmin(user) || isAcademyOwner(user);

  return (
    <Layout>
      <div className={`coaches-page${isAcademyOwner(user) ? " coaches-page-owner" : ""}`}>
        <div className="coaches-page-header">
          <div>
            <span className="coaches-page-eyebrow">
              Academy management
            </span>
            <h1>Coaches</h1>
            <p>
              Manage coach profiles and specializations
              for your academy.
            </p>
          </div>
          <div className="coaches-page-count">
            <strong>{filteredCoaches.length}</strong>
            <span>visible coaches</span>
          </div>
        </div>

        {canManageCoaches && (
          <section className="coaches-form-card">
            <div className="coaches-section-heading">
              <div>
                <span className="coaches-section-eyebrow">
                  {editingCoachId
                    ? "Coach management"
                    : "Create coach"}
                </span>
                <h2>
                  {editingCoachId
                    ? "Edit Coach"
                    : "New Coach"}
                </h2>
              </div>
              <p>
                {editingCoachId
                  ? "Update the selected coach profile."
                  : "Create a coach profile for the selected academy."}
              </p>
            </div>

            <div className="coaches-form-grid">
              {isSuperAdmin(user) && (
                <label className="coaches-field">
                  <span>Academy *</span>
                  <select
                    value={selectedAcademy}
                    onChange={(event) =>
                      setSelectedAcademy(event.target.value)
                    }
                    aria-required="true"
                  >
                    <option value="">
                      Select Academy
                    </option>
                    {academies.map((academy) => (
                      <option
                        key={academy.id}
                        value={academy.id}
                      >
                        {academy.academy_name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="coaches-field">
                <span>Coach Name *</span>
                <input
                  type="text"
                  placeholder="Enter coach name"
                  value={fullName}
                  onChange={(event) =>
                    setFullName(event.target.value)
                  }
                  aria-required="true"
                />
              </label>

              <label className="coaches-field">
                <span>Email</span>
                <input
                  type="email"
                  placeholder="Enter email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                />
              </label>

              <label className="coaches-field">
                <span>Phone</span>
                <input
                  type="text"
                  placeholder="Enter phone"
                  value={phone}
                  onChange={(event) =>
                    setPhone(event.target.value)
                  }
                />
              </label>

              <label className="coaches-field">
                <span>Specialization</span>
                <input
                  type="text"
                  placeholder="e.g. AFC B, Grassroots"
                  value={specialization}
                  onChange={(event) =>
                    setSpecialization(event.target.value)
                  }
                />
              </label>

              <label className="coaches-field">
                <span>Experience (years)</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 6"
                  value={experienceYears}
                  onChange={(event) => setExperienceYears(event.target.value)}
                />
              </label>

              <label className="coaches-field">
                <span>Joining date</span>
                <input
                  type="date"
                  value={joiningDate}
                  onChange={(event) => setJoiningDate(event.target.value)}
                />
              </label>

              <label className="coaches-field">
                <span>Profile image URL</span>
                <input
                  type="url"
                  placeholder="https://..."
                  value={profileImage}
                  onChange={(event) => setProfileImage(event.target.value)}
                />
              </label>

              <label className="coaches-field coaches-field-wide">
                <span>Bio</span>
                <textarea
                  rows="3"
                  placeholder="Short professional bio"
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                />
              </label>
            </div>

            <div className="coaches-form-actions">
              {editingCoachId && (
                <button
                  className="coaches-secondary-button"
                  type="button"
                  onClick={resetForm}
                >
                  Cancel
                </button>
              )}
              <button
                className="coaches-primary-button"
                type="button"
                onClick={addOrUpdateCoach}
              >
                {editingCoachId
                  ? "Update Coach"
                  : "Add Coach"}
              </button>
            </div>
          </section>
        )}

        <div className="coaches-list-header">
          <div>
            <span className="coaches-section-eyebrow">
              {canManageCoaches
                ? "Coach directory"
                : "My coach profile"}
            </span>
            <h2>Coaches List</h2>
          </div>

          <div className="coaches-list-filter-summary">
            {activeFilterCount > 0 && (
              <>
                <span>
                  {activeFilterCount} active filter
                  {activeFilterCount === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  className="coaches-secondary-button"
                  onClick={clearAllFilters}
                >
                  Clear all
                </button>
              </>
            )}
            <span>
              {filteredCoaches.length}{" "}
              {filteredCoaches.length === 1
                ? "coach"
                : "coaches"}{" "}
              shown
            </span>
          </div>
        </div>

        <div className="coaches-table-wrap">
          <table className="coaches-table">
            <caption className="sr-only">
              Coaches and their contact, specialization,
              status, and management actions
            </caption>

            <thead>
              <tr>
                <th scope="col">
                  {renderColumnFilter(
                    "coach",
                    "Coach",
                    [],
                    "text"
                  )}
                </th>

                {isSuperAdmin(user) && (
                  <th scope="col">
                    {renderColumnFilter("academy", "Academy", filterOptions.academy)}
                  </th>
                )}

                <>
                  <th scope="col">{renderColumnFilter("email", "Email", filterOptions.email)}</th>
                  <th scope="col">{renderColumnFilter("phone", "Phone", filterOptions.phone)}</th>
                  <th scope="col">{renderColumnFilter("specialization", "Specialization", filterOptions.specialization)}</th>
                  <th scope="col">{renderColumnFilter("status", "Status", filterOptions.status)}</th>
                </>

                {canManageCoaches && (
                  <th scope="col">Actions</th>
                )}
              </tr>
            </thead>

            <tbody>
              {paginatedCoaches.length > 0 ? (
                paginatedCoaches.map((coach) => {
                  const isSelected =
                    selectedCoachId === coach.id;

                  return (
                    <tr
                      key={coach.id}
                      className={
                        isSelected
                          ? "coach-row-selected"
                          : ""
                      }
                      tabIndex={0}
                      aria-selected={isSelected}
                      onClick={() =>
                        setSelectedCoachId(
                          isSelected ? null : coach.id
                        )
                      }
                      onKeyDown={(event) =>
                        handleRowKeyDown(
                          event,
                          coach.id
                        )
                      }
                    >
                      <td className="coaches-name-cell">
                        <div className="coach-identity">
                          <span className="coach-avatar" aria-hidden="true">
                            {coach.profile_image ? (
                              <img
                                src={coach.profile_image}
                                alt=""
                                onError={(event) => {
                                  event.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              getInitials(coach.full_name)
                            )}
                          </span>
                          <span>
                            {coach.full_name}
                          </span>
                        </div>
                      </td>

                      {isSuperAdmin(user) && (
                        <td className="coaches-academy-cell">
                          {(
                            coach.academies
                              ?.academy_name || "—"
                          ).toUpperCase()}
                        </td>
                      )}

                      <>
                        <td>{coach.email || "—"}</td>
                        <td>{coach.phone || "—"}</td>
                        <td>{coach.specialization || "—"}</td>
                        <td>
                          <span className={coach.is_active ? "coach-status-badge" : "coach-status-badge coach-status-badge-inactive"}>
                            {coach.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </>

                      {canManageCoaches && (
                        <td className="coaches-actions-cell">
                          <div className="coaches-row-actions">
                            <button
                              type="button"
                              className="coaches-action-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                navigate(`/coaches/${coach.id}`);
                              }}
                              aria-label={`View profile of ${coach.full_name}`}
                              title="View Profile"
                            >
                              View
                            </button>

                            <button
                              type="button"
                              className="coaches-action-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleEditCoach(coach);
                              }}
                              aria-label={
                                "Edit " +
                                coach.full_name
                              }
                            >
                                ✏️
                              </button>

                            <button
                              type="button"
                              className="coaches-action-button coaches-action-button-secondary"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleToggleCoachStatus(
                                  coach
                                );
                              }}
                              aria-label={
                                (coach.is_active
                                  ? "Deactivate "
                                  : "Activate ") +
                                coach.full_name
                              }
                            >
                              🗑️
                              </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    className="coaches-empty-state"
                    colSpan={
                      (isAcademyOwner(user) ? 1 : (isSuperAdmin(user) ? 6 : 5)) +
                      (canManageCoaches ? 1 : 0)
                    }
                  >
                    <div className="coaches-empty-icon">
                      👤
                    </div>
                    <strong>
                      {activeFilterCount > 0
                        ? "No coaches match your filters"
                        : "No coaches found"}
                    </strong>
                    <span>
                      {activeFilterCount > 0
                        ? "Try changing or clearing your filters."
                        : canManageCoaches
                          ? "Add the first coach to this academy."
                          : "No coach profile is currently available."}
                    </span>
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        className="coaches-secondary-button"
                        onClick={clearAllFilters}
                      >
                        Clear all filters
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredCoaches.length > 0 && (
          <div className="coaches-pagination">
            <span>
              Showing{" "}
              {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(
                currentPage * PAGE_SIZE,
                filteredCoaches.length
              )}{" "}
              of {filteredCoaches.length} coaches
            </span>

            <div className="coaches-pagination-controls">
              <button
                type="button"
                className="coaches-secondary-button"
                disabled={currentPage === 1}
                onClick={() =>
                  setCurrentPage((page) =>
                    Math.max(1, page - 1)
                  )
                }
              >
                Previous
              </button>

              <span>
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                className="coaches-secondary-button"
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((page) =>
                    Math.min(totalPages, page + 1)
                  )
                }
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Coaches;
