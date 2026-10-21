import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function AttendanceHistory() {

  const [attendanceList, setAttendanceList] = useState([]);

  const [academies, setAcademies] = useState([]);

  const [selectedAcademy, setSelectedAcademy] = useState("");

  const [batches, setBatches] = useState([]);

  const [selectedBatch, setSelectedBatch] = useState("");

  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    fetchAcademies();
    fetchAttendanceHistory();
  }, [fetchAttendanceHistory]);

  useEffect(() => {
    if (selectedAcademy) fetchBatches();
    else setBatches([]);
  }, [selectedAcademy, fetchBatches]);

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

  const fetchBatches = useCallback(async () => {

    const { data, error } = await supabase
      .from("batches")
      .select("*")
      .eq("academy_id", selectedAcademy);

    if (error) {

      console.log(error);

    } else {

      setBatches(data);
    }
  }, [selectedAcademy]);

  const fetchAttendanceHistory = useCallback(async (filters = {}) => {
    const {
      academyId = "",
      batchId = "",
      date = "",
    } = filters;

    let query = supabase
      .from("attendance")
      .select(`
        id,
        attendance_date,
        status,

        academies (
          academy_name
        ),

        players (
          full_name
        ),

        batches (
          batch_name
        )
      `);

    if (academyId) {

      query = query.eq(
        "academy_id",
        academyId
      );
    }

    if (batchId) {

      query = query.eq(
        "batch_id",
        batchId
      );
    }

    if (date) {

      query = query.eq(
        "attendance_date",
        date
      );
    }

    const { data, error } =
      await query.order(
        "attendance_date",
        {
          ascending: false
        }
      );

    if (error) {

      console.log(error);

    } else {

      setAttendanceList(data);
    }
  }, []);

  return (

    <div style={{ padding: "20px" }}>

      <h1>Attendance History</h1>

      {/* Academy Filter */}

      <select
        value={selectedAcademy}
        onChange={(e) =>
          setSelectedAcademy(
            e.target.value
          )
        }
      >

        <option value="">
          All Academies
        </option>

        {
          academies.map((academy) => (

            <option
              key={academy.id}
              value={academy.id}
            >

              {academy.academy_name}

            </option>

          ))
        }

      </select>

      <br />
      <br />

      {/* Batch Filter */}

      <select
        value={selectedBatch}
        onChange={(e) =>
          setSelectedBatch(
            e.target.value
          )
        }
      >

        <option value="">
          All Batches
        </option>

        {
          batches.map((batch) => (

            <option
              key={batch.id}
              value={batch.id}
            >

              {batch.batch_name}

            </option>

          ))
        }

      </select>

      <br />
      <br />

      {/* Date Filter */}

      <input
        type="date"
        value={selectedDate}
        onChange={(e) =>
          setSelectedDate(
            e.target.value
          )
        }
      />

      <br />
      <br />

      <button
        onClick={() => fetchAttendanceHistory({
          academyId: selectedAcademy,
          batchId: selectedBatch,
          date: selectedDate,
        })}
      >
        Apply Filters
      </button>

      <hr />
      <br />

      <table
        border="1"
        cellPadding="10"
        style={{
          borderCollapse: "collapse",
          width: "100%"
        }}
      >

        <thead>

          <tr>

            <th>Date</th>

            <th>Academy</th>

            <th>Player</th>

            <th>Batch</th>

            <th>Status</th>

          </tr>

        </thead>

        <tbody>

          {
            attendanceList.map((item) => (

              <tr key={item.id}>

                <td>
                  {item.attendance_date}
                </td>

                <td>
                  {item.academies?.academy_name}
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

              </tr>

            ))
          }

        </tbody>

      </table>

    </div>
  );
}

export default AttendanceHistory;