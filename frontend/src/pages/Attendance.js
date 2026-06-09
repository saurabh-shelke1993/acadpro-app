import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function Attendance() {

  const [academies, setAcademies] = useState([]);
  const [selectedAcademy, setSelectedAcademy] = useState("");

  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState("");

  const [players, setPlayers] = useState([]);

  const [attendanceData, setAttendanceData] = useState({});

  useEffect(() => {

    fetchAcademies();

  }, []);

  useEffect(() => {

    if (selectedAcademy) {

      fetchBatches();

    }

  }, [selectedAcademy]);

  useEffect(() => {

    if (selectedBatch) {

      fetchPlayers();

    }

  }, [selectedBatch]);

  const fetchAcademies = async () => {

    const { data, error } = await supabase
      .from("academies")
      .select("*");

    if (error) {

      console.log(error);

    } else {

      setAcademies(data);

    }
  };

  const fetchBatches = async () => {

    const { data, error } = await supabase
      .from("batches")
      .select("*")
      .eq("academy_id", selectedAcademy);

    if (error) {

      console.log(error);

    } else {

      setBatches(data);

    }
  };

  const fetchPlayers = async () => {

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

    if (error) {

      console.log(error);

    } else {

      setPlayers(data);

    }
  };

  const handleStatusChange = (
    playerId,
    status
  ) => {

    setAttendanceData((prev) => ({

      ...prev,

      [playerId]: status

    }));
  };

  const saveAttendance = async () => {

    const attendanceRows =
      Object.entries(attendanceData).map(
        ([playerId, status]) => ({

          academy_id: selectedAcademy,

          player_id: playerId,

          batch_id: selectedBatch,

          attendance_date:
            new Date()
              .toISOString()
              .split("T")[0],

          status: status

        })
      );

    const { error } = await supabase
      .from("attendance")
      .insert(attendanceRows);

if (error) {

  if (
    error.message.includes(
      "unique_attendance"
    )
  ) {

    alert(
      "Attendance already marked for today"
    );

  } else {

    alert(error.message);

  }

} else {

  alert("Attendance Saved Successfully");

}
  };

  return (

    <div style={{ padding: "20px" }}>

      <h1>Attendance Module</h1>

      {/* Academy Dropdown */}

      <select
        value={selectedAcademy}
        onChange={(e) => setSelectedAcademy(e.target.value)}
      >

        <option value="">
          Select Academy
        </option>

        {academies.map((academy) => (

          <option key={academy.id} value={academy.id}>

            {academy.academy_name}

          </option>

        ))}

      </select>

      <br />
      <br />

      {/* Batch Dropdown */}

      <select
        value={selectedBatch}
        onChange={(e) => setSelectedBatch(e.target.value)}
      >

        <option value="">
          Select Batch
        </option>

        {batches.map((batch) => (

          <option key={batch.id} value={batch.id}>

            {batch.batch_name}

          </option>

        ))}

      </select>

      <br />
      <br />

      <h3>Players</h3>

      {
        players.map((item) => (

          <div
            key={item.player_id}
            style={{
              marginBottom: "15px"
            }}
          >

            <strong>

              {item.players.full_name}

            </strong>

            <br />
            <br />

            <button
              onClick={() =>
                handleStatusChange(
                  item.player_id,
                  "present"
                )
              }
            >
              Present
            </button>

            <button
              onClick={() =>
                handleStatusChange(
                  item.player_id,
                  "absent"
                )
              }
              style={{
                marginLeft: "10px"
              }}
            >
              Absent
            </button>

            <p>

              Status:
              {" "}
              {
                attendanceData[item.player_id]
                || "Not Marked"
              }

            </p>

            <hr />

          </div>

        ))
      }

      <button onClick={saveAttendance}>
        Save Attendance
      </button>

    </div>
  );
}

export default Attendance;