import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import Layout from "../components/Layout";
import "./Attendance.css";
import {
  getAccessibleAcademies,
  getAccessibleCenters,
  getAccessiblePlayers,
  getAccessibleBatches,
} from "../utils/dataScope";

import {
 MESSAGES
} from '../utils/messages';

import {
  isAcademyOwner,
  isCoach,
  canManageAttendance,
  canAccessBatch,
} from "../utils/permissions";

import {
  saveAttendanceRecords,
} from "../services/attendanceService";

function Attendance() {
  const [user, setUser] = useState(null);

  const [academies, setAcademies] = useState([]);
  const [centers, setCenters] = useState([]);
  const [batches, setBatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [assignedBatchIds, setAssignedBatchIds] = useState([]);

  const [selectedAcademy, setSelectedAcademy] = useState("");
  const [selectedCenter, setSelectedCenter] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");

  const [attendanceDate, setAttendanceDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [attendanceData, setAttendanceData] = useState({});
  const [attendanceExists, setAttendanceExists] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceMessage, setAttendanceMessage] = useState("");
  const [attendanceError, setAttendanceError] = useState("");

  // =====================================================
  // FETCH LOGGED IN USER
  // =====================================================

  useEffect(() => {
    getLoggedInUser();
  }, []);

const getLoggedInUser = async () => {
  try {
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;

    if (!authUser) {
      return;
    }


    // FETCH USER FROM USERS TABLE
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (error) throw error;

    setUser(data);
  } catch (err) {
    console.log(err.message);
  }
};

const loadAssignedBatches = async () => {

  if (!isCoach(user)) {
    return;
  }

  try {

    const { data: coachData, error: coachError } =
      await supabase
        .from("coaches")
        .select("id")
        .eq("user_id", user.id)
        .single();

    if (coachError) throw coachError;

    const { data, error } =
      await supabase
        .from("coach_batch_assignments")
        .select("batch_id")
        .eq("coach_id", coachData.id)
        .eq("is_active", true);

    if (error) throw error;

    setAssignedBatchIds(
      data.map(item => item.batch_id)
    );

  } catch (err) {
    console.log(err.message);
  }

};

  // =====================================================
  // FETCH ACADEMIES
  // =====================================================

useEffect(() => {

  if (!user) return;

  fetchAcademies();

  loadAssignedBatches();

}, [user]);

  const fetchAcademies = async () => {
  try {
    const data = await getAccessibleAcademies(user);

    setAcademies(data || []);

    if (
      (isAcademyOwner(user) || isCoach(user)) &&
      data &&
      data.length > 0
    ) {
      setSelectedAcademy(data[0].id);
    }
  } catch (err) {
    console.log(err.message);
  }
};
  // =====================================================
  // FETCH CENTERS
  // =====================================================

  useEffect(() => {
    if (selectedAcademy) {
      fetchCenters();
    } else {
      setCenters([]);
    }
  }, [selectedAcademy]);

 const fetchCenters = async () => {
  try {
    const data = await getAccessibleCenters(user);

    const filteredCenters = (data || []).filter(
      (center) => center.academy_id === selectedAcademy
    );

    setCenters(filteredCenters);
  } catch (err) {
    console.log(err.message);
  }
};

  // =====================================================
  // FETCH BATCHES
  // =====================================================

  useEffect(() => {
    if (selectedCenter) {
      fetchBatches();
    } else {
      setBatches([]);
    }
  }, [selectedCenter]);

  const fetchBatches = async () => {
    try {
   const data = await getAccessibleBatches(
  user,
  selectedCenter
);

setBatches(data || []);
    } catch (err) {
      console.log(err.message);
    }
  };

  // =====================================================
  // FETCH PLAYERS
  // =====================================================

  useEffect(() => {
    if (selectedBatch) {
      fetchPlayers();
    } else {
      setPlayers([]);
      setAttendanceData({});
      setAttendanceExists(false);
      setAttendanceLoading(false);
      setAttendanceMessage("");
      setAttendanceError("");
    }
  }, [selectedBatch, attendanceDate]);

  const fetchPlayers = async () => {
    setAttendanceLoading(true);
    setAttendanceMessage("");
    setAttendanceError("");

    try {
      const data = await getAccessiblePlayers(selectedBatch);
      const safePlayers = data || [];
      setPlayers(safePlayers);

      const { data: existingAttendance, error: attendanceError } = await supabase
        .from("attendance")
        .select("player_id, status")
        .eq("batch_id", selectedBatch)
        .eq("attendance_date", attendanceDate);

      if (attendanceError) throw attendanceError;

      const existingRows = existingAttendance || [];
      setAttendanceExists(existingRows.length > 0);

      const attendanceObj = {};
      safePlayers.forEach((item) => {
        attendanceObj[item.player_id] = "";
      });

      existingRows.forEach((item) => {
        if (item.player_id) {
          attendanceObj[item.player_id] = item.status;
        }
      });

      setAttendanceData(attendanceObj);

      if (existingRows.length > 0) {
        setAttendanceMessage(
          "Attendance is already recorded for this batch and date. Review it here; use Attendance History to edit existing records."
        );
      }
    } catch (err) {
      console.log(err.message);
      setAttendanceError("Unable to load attendance. Please try again.");
      setPlayers([]);
      setAttendanceData({});
      setAttendanceExists(false);
    } finally {
      setAttendanceLoading(false);
    }
  };
  // =====================================================
  // HANDLE ATTENDANCE CHANGE
  // =====================================================

  const handleAttendanceChange = (playerId, status) => {
    if (attendanceExists || attendanceSaving) return;

    setAttendanceMessage("");
    setAttendanceError("");

    setAttendanceData((current) => ({
      ...current,
      [playerId]: status,
    }));
  };

  const markAllAttendance = (status) => {
    if (attendanceExists || attendanceSaving || players.length === 0) return;

    const nextAttendance = {};
    players.forEach((item) => {
      nextAttendance[item.player_id] = status;
    });

    setAttendanceData(nextAttendance);
    setAttendanceMessage("");
    setAttendanceError("");
  };

  const attendanceSummary = players.reduce(
    (summary, item) => {
      const status = attendanceData[item.player_id];
      summary.total += 1;

      if (status === "present") {
        summary.present += 1;
      } else if (status === "absent") {
        summary.absent += 1;
      } else {
        summary.unmarked += 1;
      }

      return summary;
    },
    { total: 0, present: 0, absent: 0, unmarked: 0 }
  );

  // =====================================================
  // SAVE ATTENDANCE
  // =====================================================

  const saveAttendance = async () => {
    if (attendanceSaving) return;

    setAttendanceMessage("");
    setAttendanceError("");

    try {
        if (!canManageAttendance(user)) {
            alert("You are not authorized to mark attendance.");
            return;
        }
        if (
  !canAccessBatch(
    user,
    selectedBatch,
    assignedBatchIds
  )
) {
  alert("You are not authorized for this batch.");
  return;
}
      if (!selectedAcademy) {
        alert("Please select academy");
        return;
      }

      if (!selectedCenter) {
        alert("Please select center");
        return;
      }

      if (!selectedBatch) {
        alert("Please select batch");
        return;
      }

      if (attendanceExists) {
        setAttendanceError(
          "Attendance has already been recorded for this batch and date. Use Attendance History to edit it."
        );
        return;
      }

      const unmarkedPlayers = players.filter(
        (item) => !attendanceData[item.player_id]
      );

      if (unmarkedPlayers.length > 0) {
        setAttendanceError(
          `Please mark attendance for all ${unmarkedPlayers.length} unmarked ${unmarkedPlayers.length === 1 ? "player" : "players"} before saving.`
        );
        return;
      }

// =====================================================
  // CHECK DUPLICATE ATTENDANCE
  // =====================================================
      const { data: existingAttendance, error: duplicateError } =
        await supabase
          .from("attendance")
          .select("*")
          .eq("batch_id", selectedBatch)
          .eq("attendance_date", attendanceDate);

      if (duplicateError) throw duplicateError;

      if (existingAttendance?.length > 0) {
        alert(MESSAGES.DUPLICATE_ATTENDANCE);
        return;
      }
if (players.length === 0) {
  alert(MESSAGES.NO_PLAYERS);
  return;
}

      const attendanceRows = players.map((item) => ({
        academy_id: selectedAcademy,
        player_id: item.player_id,
        batch_id: selectedBatch,
        attendance_date: attendanceDate,
        status: attendanceData[item.player_id],
        marked_by: user?.id,
        remarks: "",
      }));

      setAttendanceSaving(true);

      await saveAttendanceRecords(attendanceRows);

      setAttendanceExists(true);
      setAttendanceMessage(
        `Attendance saved successfully · ${attendanceSummary.present} present · ${attendanceSummary.absent} absent`
      );
    } catch (err) {
      console.log(err.message);
      setAttendanceError(err.message || "Unable to save attendance.");
    } finally {
      setAttendanceSaving(false);
    }
  };

  // =====================================================
  // UI
  // =====================================================

return (
  <Layout>
    <div className="attendance-page">

      <section className="attendance-workspace-card" aria-labelledby="attendance-workspace-title">
        <div className="attendance-workspace-heading">
          <div>
            <span className="attendance-page-eyebrow">Daily operations</span>
            <h1 id="attendance-workspace-title">Attendance</h1>
            <p>Select the batch and date, then mark each player.</p>
          </div>
          {selectedBatch ? (
            <span className={attendanceExists ? "attendance-status-badge attendance-status-existing" : "attendance-status-badge"}>
              {attendanceExists ? "Attendance recorded" : "Ready to mark"}
            </span>
          ) : null}
        </div>

        <div className="attendance-filter-card">
          <div className="attendance-filter-field">
            <label htmlFor="attendance-academy">Academy</label>
            <select
              id="attendance-academy"
              value={selectedAcademy}
              onChange={(e) => {
                setSelectedAcademy(e.target.value);
                setSelectedCenter("");
                setSelectedBatch("");
                setCenters([]);
                setBatches([]);
                setPlayers([]);
                setAttendanceData({});
                setAttendanceExists(false);
                setAttendanceMessage("");
                setAttendanceError("");
              }}
              disabled={isAcademyOwner(user) || isCoach(user)}
            >
              <option value="">Select Academy</option>
              {academies.map((academy) => (
                <option key={academy.id} value={academy.id}>
                  {academy.academy_name}
                </option>
              ))}
            </select>
          </div>

          <div className="attendance-filter-field">
            <label htmlFor="attendance-center">Center</label>
            <select
              id="attendance-center"
              value={selectedCenter}
              onChange={(e) => {
                setSelectedCenter(e.target.value);
                setSelectedBatch("");
                setBatches([]);
                setPlayers([]);
                setAttendanceData({});
                setAttendanceExists(false);
                setAttendanceMessage("");
                setAttendanceError("");
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

          <div className="attendance-filter-field">
            <label htmlFor="attendance-batch">Batch</label>
            <select
              id="attendance-batch"
              value={selectedBatch}
              onChange={(e) => {
                setSelectedBatch(e.target.value);
                setAttendanceData({});
                setAttendanceExists(false);
                setAttendanceMessage("");
                setAttendanceError("");
              }}
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

          <div className="attendance-filter-field">
            <label htmlFor="attendance-date">Date</label>
            <input
              id="attendance-date"
              type="date"
              value={attendanceDate}
              onChange={(e) => {
                setAttendanceDate(e.target.value);
                setAttendanceMessage("");
                setAttendanceError("");
              }}
            />
          </div>
        </div>

        {selectedBatch ? (
          <div className="attendance-summary" aria-label="Attendance summary">
            <div className="attendance-summary-item">
              <span>Total players</span>
              <strong>{attendanceSummary.total}</strong>
            </div>
            <div className="attendance-summary-item attendance-summary-present">
              <span>Present</span>
              <strong>{attendanceSummary.present}</strong>
            </div>
            <div className="attendance-summary-item attendance-summary-absent">
              <span>Absent</span>
              <strong>{attendanceSummary.absent}</strong>
            </div>
            <div className="attendance-summary-item attendance-summary-unmarked">
              <span>Unmarked</span>
              <strong>{attendanceSummary.unmarked}</strong>
            </div>
          </div>
        ) : null}

        {attendanceMessage ? (
          <div className="attendance-inline-message attendance-inline-success" role="status">
            <strong>✓</strong>
            <span>{attendanceMessage}</span>
          </div>
        ) : null}

        {attendanceError ? (
          <div className="attendance-inline-message attendance-inline-error" role="alert">
            <strong>!</strong>
            <span>{attendanceError}</span>
          </div>
        ) : null}
      </section>

      <section className="attendance-list-section" aria-labelledby="players-attendance-title">
        <div className="attendance-list-header">
          <div>
            <span className="attendance-section-eyebrow">Daily roster</span>
            <h2 id="players-attendance-title">Players Attendance</h2>
            <p>
              {selectedBatch
                ? `${players.length} ${players.length === 1 ? "player" : "players"} in the selected batch`
                : "Select a batch to load players."}
            </p>
          </div>

          {selectedBatch && canManageAttendance(user) && !attendanceExists ? (
            <div className="attendance-bulk-actions">
              <button
                type="button"
                className="attendance-secondary-button"
                onClick={() => markAllAttendance("present")}
                disabled={attendanceSaving || attendanceLoading || players.length === 0}
              >
                ✓ Mark all present
              </button>
              <button
                type="button"
                className="attendance-secondary-button attendance-secondary-button-muted"
                onClick={() => markAllAttendance("absent")}
                disabled={attendanceSaving || attendanceLoading || players.length === 0}
              >
                Mark all absent
              </button>
            </div>
          ) : null}
        </div>

        <div className="attendance-table-wrap">
          <table className="attendance-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Player Name</th>
                <th scope="col">Present</th>
                <th scope="col">Absent</th>
              </tr>
            </thead>

            <tbody>
              {attendanceLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={`attendance-skeleton-${index}`} className="attendance-skeleton-row">
                    <td><span /></td>
                    <td><span /></td>
                    <td><span /></td>
                    <td><span /></td>
                  </tr>
                ))
              ) : players.length === 0 ? (
                <tr>
                  <td className="attendance-empty-state" colSpan={4}>
                    <strong>{selectedBatch ? "No players to mark" : "Select a batch to begin"}</strong>
                    <span>
                      {selectedBatch
                        ? "No active players are available in this batch."
                        : "Choose an academy, center and batch to load the attendance roster."}
                    </span>
                  </td>
                </tr>
              ) : (
                players.map((item, index) => {
                  const status = attendanceData[item.player_id];
                  const disabled = attendanceExists || attendanceSaving;

                  return (
                    <tr key={item.player_id} className={status ? `attendance-row-${status}` : "attendance-row-unmarked"}>
                      <td className="attendance-player-number">{index + 1}</td>
                      <td className="attendance-player-name">
                        <strong>{item.players?.full_name}</strong>
                        {!status ? <span>Not marked</span> : null}
                      </td>

                      <td>
                        <label className={`attendance-choice ${status === "present" ? "attendance-choice-selected attendance-choice-present" : ""}`}>
                          <input
                            type="radio"
                            name={`attendance-${item.player_id}`}
                            checked={status === "present"}
                            onChange={() => handleAttendanceChange(item.player_id, "present")}
                            disabled={disabled}
                          />
                          <span>Present</span>
                        </label>
                      </td>

                      <td>
                        <label className={`attendance-choice ${status === "absent" ? "attendance-choice-selected attendance-choice-absent" : ""}`}>
                          <input
                            type="radio"
                            name={`attendance-${item.player_id}`}
                            checked={status === "absent"}
                            onChange={() => handleAttendanceChange(item.player_id, "absent")}
                            disabled={disabled}
                          />
                          <span>Absent</span>
                        </label>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {canManageAttendance(user) && selectedBatch && players.length > 0 && !attendanceExists ? (
        <div className="attendance-action-bar">
          <div className="attendance-action-summary">
            <strong>{attendanceSummary.total} players</strong>
            <span>{attendanceSummary.present} present · {attendanceSummary.absent} absent · {attendanceSummary.unmarked} unmarked</span>
          </div>
          <div className="attendance-action-buttons">
            <button
              type="button"
              className="attendance-secondary-button"
              onClick={() => markAllAttendance("")}
              disabled={attendanceSaving || attendanceLoading}
            >
              Reset
            </button>
            <button
              className="attendance-save-button"
              type="button"
              onClick={saveAttendance}
              disabled={attendanceSaving || attendanceLoading || attendanceSummary.unmarked > 0}
            >
              {attendanceSaving ? "Saving..." : "Save Attendance"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  </Layout>
);
}

export default Attendance;
