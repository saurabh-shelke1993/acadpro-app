import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function Attendance() {
  const [user, setUser] = useState(null);

  const [academies, setAcademies] = useState([]);
  const [centers, setCenters] = useState([]);
  const [batches, setBatches] = useState([]);
  const [players, setPlayers] = useState([]);

  const [selectedAcademy, setSelectedAcademy] = useState("");
  const [selectedCenter, setSelectedCenter] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");

  const [attendanceDate, setAttendanceDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [attendanceData, setAttendanceData] = useState({});

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
      console.log("No authenticated user found");
      return;
    }

    console.log("Supabase Auth User:", authUser);

    // FETCH USER FROM USERS TABLE
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (error) throw error;

    console.log("Database User:", data);

    setUser(data);
  } catch (err) {
    console.log(err.message);
  }
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
      if (user?.role === "academy_owner") {
        query = query.eq("id", user?.academy_id);
      }

      const { data, error } = await query;

      if (error) throw error;

      setAcademies(data || []);

      // AUTO SELECT OWNER ACADEMY
      if (
        user?.role === "academy_owner" &&
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
    } else {
      setBatches([]);
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
  // FETCH PLAYERS
  // =====================================================

  useEffect(() => {
    if (selectedBatch) {
      fetchPlayers();
    } else {
      setPlayers([]);
    }
  }, [selectedBatch]);

  const fetchPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from("player_batches")
        .select(`
          player_id,
          players (
            id,
            full_name
          )
        `)
        .eq("batch_id", selectedBatch);

      if (error) throw error;

      setPlayers(data || []);

      // DEFAULT PRESENT
      let attendanceObj = {};

      data.forEach((item) => {
        attendanceObj[item.player_id] = "present";
      });

      setAttendanceData(attendanceObj);
    } catch (err) {
      console.log(err.message);
    }
  };

  // =====================================================
  // HANDLE ATTENDANCE CHANGE
  // =====================================================

  const handleAttendanceChange = (playerId, status) => {
    setAttendanceData({
      ...attendanceData,
      [playerId]: status,
    });
  };

  // =====================================================
  // SAVE ATTENDANCE
  // =====================================================

  const saveAttendance = async () => {
    try {
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

      // CHECK DUPLICATE ATTENDANCE
      const { data: existingAttendance, error: duplicateError } =
        await supabase
          .from("attendance")
          .select("*")
          .eq("batch_id", selectedBatch)
          .eq("attendance_date", attendanceDate);

      if (duplicateError) throw duplicateError;

      if (existingAttendance?.length > 0) {
        alert("Attendance already marked for this batch today.");
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

      const { error } = await supabase
        .from("attendance")
        .insert(attendanceRows);

      if (error) throw error;

      alert("Attendance saved successfully.");
    } catch (err) {
      console.log(err.message);
      alert(err.message);
    }
  };

  // =====================================================
  // UI
  // =====================================================

  return (
    <div style={{ padding: "20px", width: "100%" }}>
      <h1>Attendance Module V2</h1>

      {/* FILTERS */}

      <div
        style={{
          display: "flex",
          gap: "40px",
          marginBottom: "30px",
        }}
      >
        {/* ACADEMY */}

        <div>
          <label>Academy</label>
          <br />

          <select
            value={selectedAcademy}
            onChange={(e) => {
              setSelectedAcademy(e.target.value);

              // RESET DEPENDENCIES
              setSelectedCenter("");
              setSelectedBatch("");
              setCenters([]);
              setBatches([]);
              setPlayers([]);
            }}
            disabled={user?.role === "academy_owner"}
          >
            <option value="">Select Academy</option>

            {academies.map((academy) => (
              <option key={academy.id} value={academy.id}>
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
              setSelectedCenter(e.target.value);

              // RESET DEPENDENCIES
              setSelectedBatch("");
              setBatches([]);
              setPlayers([]);
            }}
          >
            <option value="">Select Center</option>

            {centers.map((center) => (
              <option key={center.id} value={center.id}>
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
              setSelectedBatch(e.target.value)
            }
          >
            <option value="">Select Batch</option>

            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
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
            value={attendanceDate}
            onChange={(e) =>
              setAttendanceDate(e.target.value)
            }
          />
        </div>
      </div>

      {/* PLAYERS */}

      <h2>Players Attendance</h2>

      <table border="1" cellPadding="10" width="100%">
        <thead>
          <tr>
            <th>Player Name</th>
            <th>Present</th>
            <th>Absent</th>
          </tr>
        </thead>

        <tbody>
          {players.map((item) => (
            <tr key={item.player_id}>
              <td>{item.players?.full_name}</td>

              <td align="center">
                <input
                  type="radio"
                  name={`attendance-${item.player_id}`}
                  checked={
                    attendanceData[item.player_id] ===
                    "present"
                  }
                  onChange={() =>
                    handleAttendanceChange(
                      item.player_id,
                      "present"
                    )
                  }
                />
              </td>

              <td align="center">
                <input
                  type="radio"
                  name={`attendance-${item.player_id}`}
                  checked={
                    attendanceData[item.player_id] ===
                    "absent"
                  }
                  onChange={() =>
                    handleAttendanceChange(
                      item.player_id,
                      "absent"
                    )
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <br />

      <button onClick={saveAttendance}>
        Save Attendance
      </button>
    </div>
  );
}

export default Attendance;