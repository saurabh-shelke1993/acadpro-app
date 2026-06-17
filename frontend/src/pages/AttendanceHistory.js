import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

import {
  getCurrentUser,
  isSuperAdmin,
} from "../utils/auth";

import Layout from "../components/Layout";

function AttendanceHistory() {

  // =====================================================
  // STATES
  // =====================================================

  const [user, setUser] = useState(null);

  const [academies, setAcademies] = useState([]);
  const [centers, setCenters] = useState([]);
  const [batches, setBatches] = useState([]);

  const [selectedAcademy, setSelectedAcademy] =
    useState("");

  const [selectedCenter, setSelectedCenter] =
    useState("");

  const [selectedBatch, setSelectedBatch] =
    useState("");

  const [selectedDate, setSelectedDate] =
    useState("");

  const [attendanceHistory, setAttendanceHistory] =
    useState([]);

  const [loading, setLoading] = useState(false);

  // =====================================================
  // LOAD USER
  // =====================================================

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await getCurrentUser();

    setUser(currentUser);
  };

  // =====================================================
  // FETCH ACADEMIES
  // =====================================================

  useEffect(() => {
    if (user) {
      fetchAcademies();
    }
  }, [user]);

  const fetchAcademies = async () => {
    try {

      let query = supabase
        .from("academies")
        .select("*")
        .eq("is_active", true);

      // ACADEMY OWNER FILTER
      if (!isSuperAdmin(user)) {
        query = query.eq(
          "id",
          user.academy_id
        );
      }

      const { data, error } = await query;

      if (error) throw error;

      setAcademies(data || []);
      console.log("Academies:", data);

console.log(
  "Auto Selected Academy:",
  data[0]?.id
);
      // AUTO SELECT OWNER ACADEMY
      if (
        !isSuperAdmin(user) &&
        data &&
        data.length > 0
      ) {
        setSelectedAcademy(data[0].id);
        console.log(
  "Selected Academy State Updated"
);
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
    }
  }, [selectedAcademy]);

  const fetchCenters = async () => {
    try {

      const { data, error } = await supabase
        .from("centers")
        .select("*")
        .eq("academy_id", selectedAcademy)
        .eq("is_active", true);

      if (error) throw error;

      setCenters(data || []);

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
    }
  }, [selectedCenter]);

  const fetchBatches = async () => {
    try {

      const { data, error } = await supabase
        .from("batches")
        .select("*")
        .eq("center_id", selectedCenter)
        .eq("is_active", true);

      if (error) throw error;

      setBatches(data || []);

    } catch (err) {
      console.log(err.message);
    }
  };

  // =====================================================
  // FETCH ATTENDANCE HISTORY
  // =====================================================

  const fetchAttendanceHistory = async () => {
    try {

      setLoading(true);

      let query = supabase
        .from("attendance")
        .select(`
          *,
          players (
            full_name
          ),
          batches (
            batch_name
          ),
          users (
            full_name
          )
        `)
        .order("attendance_date", {
          ascending: false,
        });

      // FILTERS

      if (selectedAcademy) {
        query = query.eq(
          "academy_id",
          selectedAcademy
        );
      }

      if (selectedBatch) {
        query = query.eq(
          "batch_id",
          selectedBatch
        );
      }

      if (selectedDate) {
        query = query.eq(
          "attendance_date",
          selectedDate
        );
      }

      const { data, error } = await query;

      if (error) throw error;

      setAttendanceHistory(data || []);

      setLoading(false);

    } catch (err) {
      console.log(err.message);
      setLoading(false);
    }
  };

  // =====================================================
  // LOAD HISTORY WHEN FILTERS CHANGE
  // =====================================================

  useEffect(() => {
    if (selectedAcademy) {
      fetchAttendanceHistory();
    }
  }, [
    selectedAcademy,
    selectedBatch,
    selectedDate,
  ]);

  // =====================================================
  // UI
  // =====================================================

return (
  <Layout>
    <div style={{ padding: "20px" }}>


      <h1>Attendance History</h1>

      {/* FILTERS */}

      <div
        style={{
          display: "flex",
          gap: "20px",
          marginBottom: "30px",
          flexWrap: "wrap",
        }}
      >

        {/* ACADEMY */}

        <div>

          <label>Academy</label>

          <br />

          <select
            value={selectedAcademy}
            onChange={(e) => {
              setSelectedAcademy(
                e.target.value
              );

              setSelectedCenter("");
              setSelectedBatch("");
            }}
            disabled={!isSuperAdmin(user)}
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

        </div>

        {/* CENTER */}

        <div>

          <label>Center</label>

          <br />

          <select
            value={selectedCenter}
            onChange={(e) => {
              setSelectedCenter(
                e.target.value
              );

              setSelectedBatch("");
            }}
          >

            <option value="">
              Select Center
            </option>

            {centers.map((center) => (
              <option
                key={center.id}
                value={center.id}
              >
                {center.center_name}
              </option>
            ))}

          </select>

        </div>

        {/* BATCH */}

        <div>

          <label>Batch</label>

          <br />

          <select
            value={selectedBatch}
            onChange={(e) =>
              setSelectedBatch(
                e.target.value
              )
            }
          >

            <option value="">
              Select Batch
            </option>

            {batches.map((batch) => (
              <option
                key={batch.id}
                value={batch.id}
              >
                {batch.batch_name}
              </option>
            ))}

          </select>

        </div>

        {/* DATE */}

        <div>

          <label>Date</label>

          <br />

          <input
            type="date"
            value={selectedDate}
            onChange={(e) =>
              setSelectedDate(
                e.target.value
              )
            }
          />

        </div>

      </div>

      {/* TABLE */}

      {loading ? (
        <h3>Loading...</h3>
      ) : (
        <table
          border="1"
          cellPadding="10"
          width="100%"
        >

          <thead>
            <tr>
              <th>Date</th>
              <th>Player Name</th>
              <th>Batch</th>
              <th>Status</th>
              <th>Marked By</th>
            </tr>
          </thead>

          <tbody>

            {attendanceHistory.length > 0 ? (
              attendanceHistory.map((item) => (
                <tr key={item.id}>

                  <td>
                    {item.attendance_date}
                  </td>

                  <td>
                    {item.players?.full_name}
                  </td>

                  <td>
                    {item.batches?.batch_name}
                  </td>

                  <td>
                    {item.status}
                  </td>

                  <td>
                    {item.users?.full_name}
                  </td>

                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="5"
                  align="center"
                >
                  No attendance found
                </td>
              </tr>
            )}

          </tbody>

        </table>
      )}

    </div>
  </Layout>
);
}

export default AttendanceHistory;