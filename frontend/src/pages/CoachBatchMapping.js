import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../supabaseClient";

import {
  getCurrentUser,
  isSuperAdmin,
} from "../utils/auth";

function CoachBatchMapping() {

  // =====================================================
  // STATES
  // =====================================================

  const [user, setUser] =
    useState(null);

  const [academies, setAcademies] =
    useState([]);

  const [centers, setCenters] =
  useState([]);

const [selectedCenter,
  setSelectedCenter] =
  useState("");

  const [selectedAcademy,
    setSelectedAcademy] =
    useState("");

  const [coaches, setCoaches] =
    useState([]);

  const [batches, setBatches] =
    useState([]);

  const [selectedCoach,
    setSelectedCoach] =
    useState("");

  const [selectedBatch,
    setSelectedBatch] =
    useState("");

  const [assignments,
    setAssignments] =
    useState([]);

  // =====================================================
  // LOAD USER
  // =====================================================

  useEffect(() => {

    loadUser();

  }, []);

  const loadUser = async () => {

    const currentUser =
      await getCurrentUser();

    setUser(currentUser);

  };

  // =====================================================
  // LOAD ACADEMIES
  // =====================================================

  useEffect(() => {

    if (user) {

      fetchAcademies();

    }

  }, [user]);

  const fetchAcademies = async () => {

    let query = supabase
      .from("academies")
      .select("*")
      .eq("is_active", true);

    if (!isSuperAdmin(user)) {

      query = query.eq(
        "id",
        user.academy_id
      );

    }

    const { data, error } =
      await query;

    if (error) {

      console.log(error);

    } else {

      setAcademies(data);

      if (
        !isSuperAdmin(user) &&
        data.length > 0
      ) {

        setSelectedAcademy(
          data[0].id
        );

      }

    }
  };

  // =====================================================
  // FETCH COACHES + BATCHES
  // =====================================================

  useEffect(() => {

    if (selectedAcademy) {

fetchCoaches();

fetchCenters();

fetchAssignments();

    }

  }, [selectedAcademy]);

  const fetchCoaches = async () => {

    const { data, error } =
      await supabase
        .from("coaches")
        .select("*")
        .eq(
          "academy_id",
          selectedAcademy
        )
        .eq("is_active", true);

    if (!error) {

      setCoaches(data || []);

    }
  };

  const fetchCenters = async () => {

  const { data, error } =
    await supabase
      .from("centers")
      .select("*")
      .eq(
        "academy_id",
        selectedAcademy
      )
      .eq("is_active", true);

  if (!error) {

    setCenters(data || []);

  }
};

useEffect(() => {

  if (selectedCenter) {

    fetchBatches();

  }

}, [selectedCenter]);

  const fetchBatches = async () => {

  if (!selectedCenter) {

    setBatches([]);

    return;
  }

  const { data, error } =
    await supabase
      .from("batches")
      .select("*")
      .eq(
        "academy_id",
        selectedAcademy
      )
      .eq(
        "center_id",
        selectedCenter
      )
      .eq("is_active", true);

  if (!error) {

    setBatches(data || []);

  }
};

  // =====================================================
  // ASSIGN COACH
  // =====================================================

  const assignCoach = async () => {

    if (
      !selectedCoach ||
      !selectedBatch
    ) {

      alert(
        "Select Coach and Batch"
      );

      return;
    }

    // PREVENT DUPLICATES
    const existing =
      assignments.find(
        (item) =>
          item.coach_id ===
            selectedCoach &&
          item.batch_id ===
            selectedBatch
      );

    if (existing) {

      alert(
        "Mapping already exists"
      );

      return;
    }

    const { error } =
      await supabase
        .from(
          "coach_batch_assignments"
        )
        .insert([
          {
            academy_id:
              selectedAcademy,

            coach_id:
              selectedCoach,

            batch_id:
              selectedBatch,
          },
        ]);

    if (error) {

      console.log(error);

      alert(error.message);

    } else {

      alert(
        "Coach Assigned Successfully"
      );

      fetchAssignments();

    }
  };

  // =====================================================
  // FETCH ASSIGNMENTS
  // =====================================================

  const fetchAssignments =
    async () => {

      const { data, error } =
        await supabase
          .from(
            "coach_batch_assignments"
          )
          .select(`
            *,
            coaches (
              full_name
            ),
            batches (
  batch_name,
  centers (
    center_name
  )
)
          `)
          .eq(
            "academy_id",
            selectedAcademy
          )
          .eq("is_active", true);

      if (!error) {

        setAssignments(data || []);

      }
    };

  // =====================================================
  // UI
  // =====================================================

return (
  <Layout>
    <div style={{ padding: "20px" }}>


      <h1>
        Coach Batch Mapping
      </h1>

      {/* ACADEMY */}

      <div
        style={{
          marginBottom: "20px",
        }}
      >

        <label>Academy</label>

        <br />

        <select
          value={selectedAcademy}
          onChange={(e) =>
            setSelectedAcademy(
              e.target.value
            )
          }
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

      {/* ASSIGNMENT */}

      <div
        style={{
          border: "1px solid #ccc",
          padding: "20px",
          marginBottom: "30px",
        }}
      >

        <h2>
          Assign Coach To Batch
        </h2>

        <select
          value={selectedCoach}
          onChange={(e) =>
            setSelectedCoach(
              e.target.value
            )
          }
        >

          <option value="">
            Select Coach
          </option>

          {coaches.map((coach) => (

            <option
              key={coach.id}
              value={coach.id}
            >
              {coach.full_name}
            </option>

          ))}

        </select>

        <br /><br />
        <select
  value={selectedCenter}
  onChange={(e) =>
    setSelectedCenter(
      e.target.value
    )
  }
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

<br /><br />
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

        <br /><br />

        <button onClick={assignCoach}>
          Assign Coach
        </button>

      </div>

      {/* ASSIGNMENTS TABLE */}

      <table
        border="1"
        cellPadding="10"
        width="100%"
      >

        <thead>

          <tr>

            <th>Coach</th>
            <th>Batch</th>
            <th>Center</th>
            <th>Status</th>

          </tr>

        </thead>

        <tbody>

          {assignments.length > 0 ? (

            assignments.map(
              (item) => (

                <tr key={item.id}>

                  <td>
                    {
                      item.coaches
                        ?.full_name
                    }
                  </td>

                  <td>
                    {
                      item.batches
                        ?.batch_name
                    }
                  </td>
                  <td>
  {
    item.batches?.centers
      ?.center_name
  }
</td>

<td>
  {
    item.is_active
      ? "Active"
      : "Inactive"
  }
</td>

                </tr>

              )
            )

          ) : (

            <tr>

              <td
                colSpan="2"
                align="center"
              >
                No Assignments Found
              </td>

            </tr>

          )}

        </tbody>

      </table>

    </div>
  </Layout>
);
}

export default CoachBatchMapping;