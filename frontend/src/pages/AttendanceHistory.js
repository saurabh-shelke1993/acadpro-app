import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function AttendanceHistory() {

  const [attendanceList, setAttendanceList] = useState([]);

  useEffect(() => {

    fetchAttendanceHistory();

  }, []);

  const fetchAttendanceHistory = async () => {

    const { data, error } = await supabase
      .from("attendance")
      .select(`
        id,
        attendance_date,
        status,

        players (
          full_name
        ),

        batches (
          batch_name
        )
      `)
      .order("attendance_date", {
        ascending: false
      });

    if (error) {

      console.log(error);

    } else {

      setAttendanceList(data);

    }
  };

  return (

    <div style={{ padding: "20px" }}>

      <h1>Attendance History</h1>

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