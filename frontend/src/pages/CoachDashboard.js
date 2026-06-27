import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../supabaseClient";
import { getCurrentUser } from "../utils/auth";

function CoachDashboard() {

  const [coach, setCoach] = useState(null);
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    loadCoach();
  }, []);

  const loadCoach = async () => {

    try {

      const currentUser = await getCurrentUser();

      if (!currentUser) return;

      // FETCH COACH

      const { data: coachData, error } = await supabase
        .from("coaches")
        .select("*")
        .eq("user_id", currentUser.id)
        .single();

      if (error) {
        console.log("Coach fetch error:", error);
        return;
      }

      setCoach(coachData);

      if (coachData) {
        fetchAssignments(coachData.id);
      }

    } catch (err) {
      console.log(err);
    }
  };

  const fetchAssignments = async (coachId) => {

    try {

      const { data, error } = await supabase
        .from("coach_batch_assignments")
.select(`
  *,
  batches (
    batch_name,
    centers (
      center_name
    )
  )
`)
        .eq("coach_id", coachId)
        .eq("is_active", true);

      if (error) {
        console.log("Assignment fetch error:", error);
        return;
      }

      setAssignments(data || []);

    } catch (err) {
      console.log(err);
    }
  };

  return (

    <Layout>

      <h1>Coach Dashboard</h1>

      <h2>
        Welcome, {coach?.full_name || "Coach"}
      </h2>

      <h3>Assigned Batches</h3>

      <table
        border="1"
        cellPadding="10"
        width="100%"
      >

<thead>
  <tr>
    <th>Center</th>
    <th>Batch</th>
  </tr>
</thead>

        <tbody>

          {assignments.length > 0 ? (

            assignments.map((item) => (

<tr key={item.id}>
  <td>
    {item.batches?.centers?.center_name}
  </td>

  <td>
    {item.batches?.batch_name}
  </td>
</tr>

            ))

          ) : (

 <tr>
  <td colSpan="2" align="center">
    No Batches Assigned
  </td>
</tr>

          )}

        </tbody>

      </table>

    </Layout>
  );
}

export default CoachDashboard;