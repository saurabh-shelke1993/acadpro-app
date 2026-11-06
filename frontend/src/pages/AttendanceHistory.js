import { useCallback, useEffect, useRef, useState } from "react";
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
import AttendanceWorkspaceTabs from "../components/AttendanceWorkspaceTabs";
import { canEditAttendanceRecord } from "../utils/attendanceEditWindow";
import { formatAttendanceSessionLabel } from "../utils/attendancePresentation";
import { getAttendanceHistoryPage, ATTENDANCE_HISTORY_PAGE_SIZE } from "../services/attendanceHistoryService";
import "./AttendanceHistory.css";

function AttendanceHistory() {
  const [user, setUser] = useState(null);
  const [academies, setAcademies] = useState([]);
  const [centers, setCenters] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedAcademy, setSelectedAcademy] = useState("");
  const [selectedCenter, setSelectedCenter] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [debouncedPlayerSearch, setDebouncedPlayerSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [totalHistoryCount, setTotalHistoryCount] = useState(0);
  const historyRequestRef = useRef(0);
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
  }, [user, selectedAcademy, selectedCenter]);

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
  }, [user, selectedAcademy, selectedCenter, selectedBatch]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPlayerSearch(playerSearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [playerSearch]);

  const fetchAttendanceHistory = useCallback(async () => {
    if (!user) return;
    const requestId = ++historyRequestRef.current;
    setLoading(true);
    setErrorMessage("");
    try {
      const { rows, count } = await getAttendanceHistoryPage({
        user, academyId: selectedAcademy, centerId: selectedCenter,
        batchId: selectedBatch, playerName: debouncedPlayerSearch,
        status: selectedStatus, startDate, endDate, page: currentPage,
      });
      if (requestId !== historyRequestRef.current) return;
      const lastPage = Math.max(1, Math.ceil(count / ATTENDANCE_HISTORY_PAGE_SIZE));
      if (currentPage > lastPage) {
        setCurrentPage(lastPage);
        return;
      }
      setAttendanceHistory(rows);
      setTotalHistoryCount(count);
    } catch (error) {
      if (requestId !== historyRequestRef.current) return;
      console.error(error);
      setAttendanceHistory([]);
      setTotalHistoryCount(0);
      setErrorMessage("Unable to load attendance history.");
    } finally {
      if (requestId === historyRequestRef.current) setLoading(false);
    }
  }, [user, selectedAcademy, selectedCenter, selectedBatch,
      debouncedPlayerSearch, selectedStatus, startDate, endDate, currentPage]);

  useEffect(() => {
    fetchAttendanceHistory();
    return () => { historyRequestRef.current += 1; };
  }, [fetchAttendanceHistory]);

  const totalPages = Math.max(1, Math.ceil(totalHistoryCount / ATTENDANCE_HISTORY_PAGE_SIZE));
  const paginatedHistory = attendanceHistory;

  const hasActiveFilters = Boolean(
    (isSuperAdmin(user) && selectedAcademy) ||
      selectedCenter ||
      selectedBatch ||
      playerSearch ||
      selectedStatus ||
      startDate ||
      endDate
  );

  const resetFilters = () => {
    setSelectedCenter("");
    setSelectedBatch("");
    setPlayerSearch("");
    setDebouncedPlayerSearch("");
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
    setPlayerSearch("");
    setDebouncedPlayerSearch("");
    setCurrentPage(1);
  };

  const handleCenterChange = (value) => {
    setSelectedCenter(value);
    setSelectedBatch("");
    setPlayerSearch("");
    setDebouncedPlayerSearch("");
    setCurrentPage(1);
  };

  const handleBatchChange = (value) => {
    setSelectedBatch(value);
    setPlayerSearch("");
    setDebouncedPlayerSearch("");
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
      const record = attendanceHistory.find((item) => item.id === attendanceId);
      if (!canEditAttendance(user) || !canEditAttendanceRecord(user, record)) {
        alert("This record is read-only. Coaches can edit only the last 7 calendar dates.");
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

  const pageStart = totalHistoryCount
    ? (currentPage - 1) * ATTENDANCE_HISTORY_PAGE_SIZE + 1
    : 0;
  const pageEnd = Math.min(currentPage * ATTENDANCE_HISTORY_PAGE_SIZE, totalHistoryCount);

  return (
    <Layout>
      <div className="attendance-history-page">
        <AttendanceWorkspaceTabs role={user?.role} />
        <section className="attendance-history-filter-card" aria-labelledby="attendance-history-filters">
          <div className="attendance-history-section-heading">
            <h1 id="attendance-history-filters" className="sr-only">Attendance History filters</h1>
            <span className="attendance-history-filter-title">
              {isSuperAdmin(user) ? "Filter attendance records" : (
                <>Academy: <strong>{academies.find((academy) => academy.id === selectedAcademy)?.academy_name || "Loading academy…"}</strong></>
              )}
            </span>
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
            {isSuperAdmin(user) && (
              <label className="attendance-history-field">
                <span>Academy</span>
                <select value={selectedAcademy} onChange={(event) => handleAcademyChange(event.target.value)}>
                  <option value="">All academies</option>
                  {academies.map((academy) => (
                    <option key={academy.id} value={academy.id}>{academy.academy_name}</option>
                  ))}
                </select>
              </label>
            )}

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
              <span>Player name</span>
              <input
                type="search"
                placeholder="Search all attendance records"
                value={playerSearch}
                onChange={(event) => {
                  setPlayerSearch(event.target.value);
                  setCurrentPage(1);
                }}
              />
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
              <span>From date</span>
              <input
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(event) => handleStartDateChange(event.target.value)}
              />
            </label>

            <label className="attendance-history-field">
              <span>To date</span>
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
            <h2>
              Records
              {!loading && !errorMessage && (
                <span className="attendance-history-record-count"> · {totalHistoryCount}</span>
              )}
            </h2>
            {user?.role === "coach" && (
              <p className="attendance-history-coach-rule">
                Coaches can edit attendance from the last 7 calendar dates. Earlier records are read-only.
              </p>
            )}
            {(startDate || endDate) && (
              <p>
                {startDate ? formatDate(startDate) : "Earliest"} – {endDate ? formatDate(endDate) : "Latest"}
              </p>
            )}
          </div>
          {!loading && !errorMessage && totalHistoryCount > 0 && (
            <div className="attendance-history-result-count">
              Showing {pageStart}–{pageEnd} of {totalHistoryCount}
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
        ) : totalHistoryCount === 0 ? (
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
              <table className="attendance-history-table" role="table">
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
                    <tr key={item.id} className="attendance-history-record-row">
                      <td data-label="Date">{formatDate(item.attendance_date)}</td>
                      <td className="attendance-history-player-cell" data-label="Player">
                        {item.players?.full_name || "—"}
                      </td>
                      <td data-label="Center">{item.batches?.centers?.center_name || "—"}</td>
                      <td data-label="Batch">{item.batches?.batch_name || "—"}</td>
                      <td data-label="Session">{item.batch_schedules ? formatAttendanceSessionLabel(item.batch_schedules) : "Legacy / batch attendance"}</td>
                      <td data-label="Status">
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
                      <td data-label="Marked by">{item.users?.full_name || "—"}</td>
                      <td data-label="Actions">
                        <div className="attendance-history-actions">
                          {editingAttendanceId === item.id ? (
                            <>
                              {canEditAttendanceRecord(user, item) && (
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
                              {canEditAttendanceRecord(user, item) && (
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
                              {!canEditAttendanceRecord(user, item) && !canDeleteAttendance(user) && (
                                 <span className="attendance-history-readonly" title="Editing is limited to the last 7 calendar dates">Read-only</span>
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
                  Showing {pageStart}–{pageEnd} of {totalHistoryCount}
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
