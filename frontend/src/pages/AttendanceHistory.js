import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  getAccessibleCenters,
  getAccessibleBatches,
  getAccessibleAcademies,
} from "../utils/dataScope";
import { MESSAGES } from "../utils/messages";
import { getCurrentUser } from "../utils/auth";
import {
  isSuperAdmin,
  canEditAttendance,
  canDeleteAttendance,
} from "../utils/permissions";
import {
  updateAttendanceStatus,
  softDeleteAttendance,
} from "../services/attendanceService";
import Layout from "../components/Layout";
import "./AttendanceHistory.css";

const PAGE_SIZE = 5;

function AttendanceHistory() {
  const [user, setUser] = useState(null);
  const [academies, setAcademies] = useState([]);
  const [centers, setCenters] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedAcademy, setSelectedAcademy] = useState("");
  const [selectedCenter, setSelectedCenter] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [editingAttendanceId, setEditingAttendanceId] = useState(null);
  const [editingStatus, setEditingStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error(error);
        setErrorMessage("Unable to load your account scope.");
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchAcademies = async () => {
      try {
        const data = await getAccessibleAcademies(user);
        setAcademies(data || []);

        if (!isSuperAdmin(user) && data?.length) {
          setSelectedAcademy(data[0].id);
        }
      } catch (error) {
        console.error(error);
        setErrorMessage("Unable to load academies.");
      }
    };

    fetchAcademies();
  }, [user]);

  useEffect(() => {
    if (!user || !selectedAcademy) {
      setCenters([]);
      return;
    }

    const fetchCenters = async () => {
      try {
        const data = await getAccessibleCenters(user);
        const scopedCenters = (data || []).filter(
          (center) => !selectedAcademy || center.academy_id === selectedAcademy
        );
        setCenters(scopedCenters);

        if (scopedCenters.length === 1) {
          setSelectedCenter(scopedCenters[0].id);
        } else if (
          selectedCenter &&
          !scopedCenters.some((center) => center.id === selectedCenter)
        ) {
          setSelectedCenter("");
        }
      } catch (error) {
        console.error(error);
        setCenters([]);
        setErrorMessage("Unable to load centers.");
      }
    };

    fetchCenters();
  }, [user, selectedAcademy]);

  useEffect(() => {
    if (!user || (!selectedAcademy && !isSuperAdmin(user))) {
      setBatches([]);
      return;
    }

    const fetchBatches = async () => {
      try {
        const data = await getAccessibleBatches(user, selectedCenter);
        setBatches(data || []);

        if (
          selectedBatch &&
          !(data || []).some((batch) => batch.id === selectedBatch)
        ) {
          setSelectedBatch("");
        }
      } catch (error) {
        console.error(error);
        setBatches([]);
        setErrorMessage("Unable to load batches.");
      }
    };

    fetchBatches();
  }, [user, selectedAcademy, selectedCenter]);

  const fetchAttendanceHistory = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setErrorMessage("");

      let query = supabase
        .from("attendance")
        .select(`
          *,
          players (full_name),
          batches (
            batch_name,
            centers (center_name)
          ),
          batch_schedules (
            day_of_week,
            start_time,
            end_time,
            session_label
          ),
          users!attendance_marked_by_fkey (full_name)
        `)
        .eq("is_deleted", false)
        .order("attendance_date", { ascending: false });

      if (selectedAcademy) {
        query = query.eq("academy_id", selectedAcademy);
      }

      if (selectedCenter) {
        const centerBatches = await getAccessibleBatches(user, selectedCenter);
        const batchIds = centerBatches.map((batch) => batch.id).filter(Boolean);

        if (batchIds.length === 0) {
          setAttendanceHistory([]);
          setLoading(false);
          return;
        }

        query = query.in("batch_id", batchIds);
      }

      if (selectedBatch) {
        query = query.eq("batch_id", selectedBatch);
      }

      if (startDate) {
        query = query.gte("attendance_date", startDate);
      }

      if (endDate) {
        query = query.lte("attendance_date", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      setAttendanceHistory(data || []);
      setCurrentPage(1);
    } catch (error) {
      console.error(error);
      setAttendanceHistory([]);
      setErrorMessage("Unable to load attendance history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchAttendanceHistory();
  }, [user, selectedAcademy, selectedCenter, selectedBatch, startDate, endDate]);

  const playerOptions = useMemo(() => {
    const map = new Map();
    attendanceHistory.forEach((item) => {
      const id = item.player_id || item.players?.id;
      const name = item.players?.full_name;
      if (id && name) map.set(id, name);
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [attendanceHistory]);

  const filteredHistory = useMemo(() => {
    return attendanceHistory.filter((item) => {
      const playerMatches =
        !selectedPlayer || item.player_id === selectedPlayer;
      const statusMatches =
        !selectedStatus || item.status === selectedStatus;

      return playerMatches && statusMatches;
    });
  }, [attendanceHistory, selectedPlayer, selectedStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredHistory.slice(start, start + PAGE_SIZE);
  }, [filteredHistory, currentPage]);

  const summary = useMemo(() => {
    const records = filteredHistory.length;
    const present = filteredHistory.filter(
      (item) => item.status === "present"
    ).length;
    const absent = filteredHistory.filter(
      (item) => item.status === "absent"
    ).length;

    return {
      records,
      present,
      absent,
      rate: records ? Math.round((present / records) * 1000) / 10 : 0,
    };
  }, [filteredHistory]);

  const hasActiveFilters = Boolean(
    selectedAcademy ||
      selectedCenter ||
      selectedBatch ||
      selectedPlayer ||
      selectedStatus ||
      startDate ||
      endDate
  );

  const resetFilters = () => {
    setSelectedCenter("");
    setSelectedBatch("");
    setSelectedPlayer("");
    setSelectedStatus("");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);

    if (isSuperAdmin(user)) {
      setSelectedAcademy("");
    }
  };

  const handleAcademyChange = (value) => {
    setSelectedAcademy(value);
    setSelectedCenter("");
    setSelectedBatch("");
    setSelectedPlayer("");
    setCurrentPage(1);
  };

  const handleCenterChange = (value) => {
    setSelectedCenter(value);
    setSelectedBatch("");
    setSelectedPlayer("");
    setCurrentPage(1);
  };

  const handleBatchChange = (value) => {
    setSelectedBatch(value);
    setSelectedPlayer("");
    setCurrentPage(1);
  };

  const handleStartDateChange = (value) => {
    setStartDate(value);
    if (endDate && value && endDate < value) {
      setEndDate("");
    }
    setCurrentPage(1);
  };

  const handleEndDateChange = (value) => {
    setEndDate(value);
    setCurrentPage(1);
  };

  const updateAttendance = async (attendanceId) => {
    try {
      if (!canEditAttendance(user)) {
        alert("You are not authorized to edit attendance.");
        return;
      }

      await updateAttendanceStatus(attendanceId, editingStatus);
      setEditingAttendanceId(null);
      setEditingStatus("");
      await fetchAttendanceHistory();
    } catch (error) {
      console.error(error);
      alert("Unable to update attendance.");
    }
  };

  const deleteAttendance = async (attendanceId) => {
    if (!canDeleteAttendance(user)) {
      alert("You are not authorized to delete attendance.");
      return;
    }

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this attendance record?"
    );
    if (!confirmDelete) return;

    try {
      await softDeleteAttendance(attendanceId, user.id);
      await fetchAttendanceHistory();
      alert(MESSAGES.ATTENDANCE_DELETED);
    } catch (error) {
      console.error(error);
      alert("Unable to delete attendance.");
    }
  };

  const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
  };

  const pageStart = filteredHistory.length
    ? (currentPage - 1) * PAGE_SIZE + 1
    : 0;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, filteredHistory.length);

  return (
    <Layout>
      <div className="attendance-history-page">
        <section className="attendance-history-filter-card" aria-labelledby="attendance-history-filters">
          <div className="attendance-history-section-heading">
            <div>
              <span className="attendance-history-section-label">Filters</span>
              <h2 id="attendance-history-filters">Attendance history</h2>
            </div>
            <button
              type="button"
              className="attendance-history-reset-button"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
            >
              Reset filters
            </button>
          </div>

          <div className="attendance-history-filter-grid">
            <label className="attendance-history-field">
              <span>Academy</span>
              <select
                value={selectedAcademy}
                onChange={(event) => handleAcademyChange(event.target.value)}
                disabled={!isSuperAdmin(user)}
              >
                <option value="">All academies</option>
                {academies.map((academy) => (
                  <option key={academy.id} value={academy.id}>
                    {academy.academy_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="attendance-history-field">
              <span>Center</span>
              <select
                value={selectedCenter}
                onChange={(event) => handleCenterChange(event.target.value)}
              >
                <option value="">All centers</option>
                {centers.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.center_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="attendance-history-field">
              <span>Batch</span>
              <select
                value={selectedBatch}
                onChange={(event) => handleBatchChange(event.target.value)}
                disabled={!user || batches.length === 0}
              >
                <option value="">All batches</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batch_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="attendance-history-field">
              <span>Player</span>
              <select
                value={selectedPlayer}
                onChange={(event) => {
                  setSelectedPlayer(event.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All players</option>
                {playerOptions.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="attendance-history-field">
              <span>Status</span>
              <select
                value={selectedStatus}
                onChange={(event) => {
                  setSelectedStatus(event.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All statuses</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
              </select>
            </label>

            <label className="attendance-history-field">
              <span>Start date</span>
              <input
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(event) => handleStartDateChange(event.target.value)}
              />
            </label>

            <label className="attendance-history-field">
              <span>End date</span>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(event) => handleEndDateChange(event.target.value)}
              />
            </label>
          </div>
        </section>

        <div className="attendance-history-list-header">
          <div>
            <span className="attendance-history-section-label">Records</span>
            <h2>Attendance records</h2>
            <p>
              {startDate || endDate
                ? `Showing records from ${startDate ? formatDate(startDate) : "the beginning"} to ${endDate ? formatDate(endDate) : "the latest available date"}.`
                : "Latest attendance records first."}
            </p>
          </div>
          {filteredHistory.length > 0 && (
            <div className="attendance-history-result-count">
              Showing {pageStart}–{pageEnd} of {filteredHistory.length}
            </div>
          )}
        </div>

        {loading ? (
          <div className="attendance-history-state" role="status" aria-live="polite">
            <div className="attendance-history-loading-line" />
            <div className="attendance-history-loading-line short" />
            <strong>Loading attendance history...</strong>
          </div>
        ) : errorMessage ? (
          <div className="attendance-history-state attendance-history-error-state" role="alert">
            <strong>Unable to load attendance history</strong>
            <span>{errorMessage}</span>
            <button
              type="button"
              className="attendance-history-retry-button"
              onClick={fetchAttendanceHistory}
            >
              Retry
            </button>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="attendance-history-state">
            <strong>No attendance records found</strong>
            <span>
              {hasActiveFilters
                ? "No records match the selected filters."
                : "Attendance records will appear here once attendance is marked."}
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                className="attendance-history-retry-button"
                onClick={resetFilters}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="attendance-history-table-wrap">
              <table className="attendance-history-table">
                <caption className="sr-only">
                  Attendance history with date, player, center, batch, status, and available actions
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Player</th>
                    <th scope="col">Center</th>
                    <th scope="col">Batch</th>
                    <th scope="col">Session</th>
                    <th scope="col">Status</th>
                    <th scope="col">Marked By</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedHistory.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.attendance_date)}</td>
                      <td className="attendance-history-player-cell">
                        {item.players?.full_name || "—"}
                      </td>
                      <td>{item.batches?.centers?.center_name || "—"}</td>
                      <td>{item.batches?.batch_name || "—"}</td>
                      <td>{item.batch_schedules ? [item.batch_schedules.session_label, item.batch_schedules.start_time ? `${String(item.batch_schedules.start_time).slice(0, 5)}–${String(item.batch_schedules.end_time || "").slice(0, 5)}` : null].filter(Boolean).join(" · ") : "Legacy / batch attendance"}</td>
                      <td>
                        {editingAttendanceId === item.id ? (
                          <select
                            className="attendance-history-status-select"
                            value={editingStatus}
                            onChange={(event) => setEditingStatus(event.target.value)}
                            aria-label={`Attendance status for ${item.players?.full_name || "player"}`}
                          >
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                          </select>
                        ) : (
                          <span
                            className={`attendance-status-badge attendance-status-${item.status}`}
                          >
                            {item.status}
                          </span>
                        )}
                      </td>
                      <td>{item.users?.full_name || "—"}</td>
                      <td>
                        <div className="attendance-history-actions">
                          {editingAttendanceId === item.id ? (
                            <>
                              {canEditAttendance(user) && (
                                <button
                                  className="attendance-action-button attendance-action-save"
                                  type="button"
                                  onClick={() => updateAttendance(item.id)}
                                  aria-label={`Save attendance for ${item.players?.full_name || "player"}`}
                                >
                                  Save
                                </button>
                              )}
                              <button
                                className="attendance-action-button attendance-action-cancel"
                                type="button"
                                onClick={() => {
                                  setEditingAttendanceId(null);
                                  setEditingStatus("");
                                }}
                                aria-label={`Cancel editing attendance for ${item.players?.full_name || "player"}`}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              {canEditAttendance(user) && (
                                <button
                                  className="attendance-icon-button"
                                  type="button"
                                  onClick={() => {
                                    setEditingAttendanceId(item.id);
                                    setEditingStatus(item.status);
                                  }}
                                  title="Edit attendance"
                                  aria-label={`Edit attendance for ${item.players?.full_name || "player"}`}
                                >
                                  ✏️
                                </button>
                              )}
                              {canDeleteAttendance(user) && (
                                <button
                                  className="attendance-icon-button attendance-delete-button"
                                  type="button"
                                  onClick={() => deleteAttendance(item.id)}
                                  title="Delete attendance"
                                  aria-label={`Delete attendance for ${item.players?.full_name || "player"}`}
                                >
                                  🗑️
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="attendance-history-pagination" aria-label="Attendance history pagination">
                <span>
                  Showing {pageStart}–{pageEnd} of {filteredHistory.length}
                </span>
                <div className="attendance-history-pagination-controls">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  <span>Page {currentPage} of {totalPages}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

export default AttendanceHistory;
