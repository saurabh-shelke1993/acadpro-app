import React, {
  useCallback,
  useEffect,
  useState
} from "react";
import Layout from "../components/Layout";
import { supabase } from "../services/supabase";
import {
  getLoggedInUser,
  isSuperAdmin
} from "../utils/auth";

import {
  isAcademyOwner
} from "../utils/roles";

import {
  getAccessibleCenters,
  getAccessibleBatches
} from "../utils/dataScope";

const Batches = () => {

  const [academies, setAcademies] =
    useState([]);
  
  
  const [user, setUser] = useState(null);

  const [centers, setCenters] =
    useState([]);

  const [filteredCenters, setFilteredCenters] =
    useState([]);

  const [batches, setBatches] =
    useState([]);

  const [selectedAcademy, setSelectedAcademy] =
    useState("");

  const [selectedCenter, setSelectedCenter] =
    useState("");

  const [batchName, setBatchName] =
    useState("");

  const [editingBatchId, setEditingBatchId] =
    useState(null);

const [startTime, setStartTime] =
  useState("");

const [endTime, setEndTime] =
  useState("");

const [ageGroup, setAgeGroup] =
  useState("");

  const AGE_GROUPS = [
  "U6",
  "U8",
  "U10",
  "U12",
  "U14",
  "U16",
  "U18",
  "Adults",
  "Elite"
];


useEffect(() => {

  loadUser();

}, []);

// useEffect(() => {

//   if (!user) return;

//   fetchAcademies();
//   fetchCenters();

// }, [user, fetchAcademies, fetchCenters]);

// useEffect(() => {
//   fetchBatches();
// }, [fetchBatches]);
  // =========================
  // FETCH ACADEMIES
  // =========================
const loadUser = async () => {

  const currentUser =
    await getLoggedInUser();

  setUser(currentUser);
};

const fetchAcademies = useCallback(async () => {

  if (!isSuperAdmin(user)) {
    return;
  }

  try {

    const { data, error } = await supabase
      .from("academies")
      .select("*")
      .eq("is_active", true)
      .order("academy_name");

    if (error) {
      throw error;
    }

    setAcademies(data || []);

  } catch (error) {

    console.error(
      "Failed to load academies:",
      error
    );

    setAcademies([]);
  }
}, [user]);
  // =========================
  // FETCH CENTERS
  // =========================

const fetchCenters = useCallback(async () => {

  try {
    const data = await getAccessibleCenters(user);

    setCenters(data || []);
    setFilteredCenters(data || []);

setSelectedCenter((currentCenter) => {

  if (
    currentCenter &&
    !(data || []).some(
      (center) => center.id === currentCenter
    )
  ) {
    return "";
  }

  return currentCenter;
});

  } catch (error) {

    console.error(
      "Failed to load accessible centers:",
      error
    );

    setCenters([]);
    setFilteredCenters([]);
  }

}, [user]);
  // =========================
  // FETCH BATCHES
  // =========================
const fetchBatches = useCallback(async () => {

  if (!user) {
    return;
  }

  try {

    // ========================================
    // SUPER ADMIN
    // ========================================

    if (isSuperAdmin(user)) {

      let query = supabase
        .from("batches")
        .select("*")
        .eq("is_active", true)
        .order("batch_name");

      // Academy filter
      if (selectedAcademy) {
        query = query.eq(
          "academy_id",
          selectedAcademy
        );
      }

      // Center filter
      if (selectedCenter) {
        query = query.eq(
          "center_id",
          selectedCenter
        );
      }

      const {
        data,
        error
      } = await query;

      if (error) {
        throw error;
      }

      const centerById = new Map(
        (centers || []).map(
          (center) => [
            center.id,
            center
          ]
        )
      );

      const academyById = new Map(
        (academies || []).map(
          (academy) => [
            academy.id,
            academy
          ]
        )
      );

      const displayBatches =
        (data || []).map(
          (batch) => ({

            ...batch,

            centers:
              centerById.get(
                batch.center_id
              ) || null,

            academies:
              academyById.get(
                batch.academy_id
              ) || null

          })
        );

      setBatches(
        displayBatches
      );

      return;
    }

    // ========================================
    // ACADEMY OWNER / COACH
    // ========================================

const scopedBatches =
  await getAccessibleBatches(
    user,
    selectedCenter || null
  );

    const centerById = new Map(
      (centers || []).map(
        (center) => [
          center.id,
          center
        ]
      )
    );

    const academyById = new Map(
      (academies || []).map(
        (academy) => [
          academy.id,
          academy
        ]
      )
    );

    const displayBatches =
      scopedBatches.map(
        (batch) => ({

          ...batch,

          centers:
            centerById.get(
              batch.center_id
            ) || null,

          academies:
            academyById.get(
              batch.academy_id
            ) || null

        })
      );

    setBatches(
      displayBatches
    );

  } catch (error) {

    console.error(
      "Failed to load batches:",
      error
    );

     setBatches([]);

  }

}, [
  user,
  selectedAcademy,
  selectedCenter,
  centers,
  academies
]);

useEffect(() => {

  if (!user) return;

  fetchAcademies();
  fetchCenters();

}, [user, fetchAcademies, fetchCenters]);

useEffect(() => {
  fetchBatches();
}, [fetchBatches]);
  // =========================
  // ACADEMY CHANGE
  // =========================

const handleAcademyChange = (
  academyId
) => {

  setSelectedAcademy(academyId);
  setSelectedCenter("");

  if (!academyId) {

    setFilteredCenters(
      centers || []
    );

    return;
  }

  const relatedCenters =
    centers.filter(
      (center) =>
        center.academy_id === academyId
    );

  setFilteredCenters(
    relatedCenters
  );
};

  // =========================
  // CREATE / UPDATE
  // =========================

  const handleSaveBatch = async () => {

      if (!isSuperAdmin(user) && !isAcademyOwner(user)) {
    alert("You do not have permission to manage batches.");
    return;
  }

if (
  !selectedCenter ||
  !batchName ||
  !ageGroup ||
  !startTime ||
  !endTime
) {

  alert(
    "Please fill all fields"
  );

  return;
}

if (
  startTime >= endTime
) {

  alert(
    "End time must be after start time"
  );

  return;
}

let academyId = selectedAcademy;

if (!isSuperAdmin(user)) {
  academyId = user?.academy_id;
}

const duplicateBatch =
  batches.find(
    batch =>
      batch.center_id ===
        selectedCenter &&
      batch.batch_name
        .trim()
        .toLowerCase() ===
      batchName
        .trim()
        .toLowerCase() &&
      batch.id !==
        editingBatchId
  );

if (duplicateBatch) {

  alert(
    "Batch already exists in this center"
  );

  return;
}

    // =====================
    // UPDATE
    // =====================

    if (editingBatchId) {

      const { error } = await supabase
        .from("batches")
.update({
  center_id: selectedCenter,
  batch_name: batchName,
  age_group: ageGroup,
  start_time: startTime,
  end_time: endTime
})
        .eq("id", editingBatchId);

      if (error) {

        alert(error.message);

        return;
      }

      alert("Batch Updated");

      setEditingBatchId(null);
    }

    // =====================
    // CREATE
    // =====================

    else {

      const { error } = await supabase
        .from("batches")
        .insert([
{
  academy_id: academyId,
  center_id: selectedCenter,
  batch_name: batchName,
  age_group: ageGroup,
  start_time: startTime,
  end_time: endTime,
  is_active: true
}
        ]);

      if (error) {

        alert(error.message);

        return;
      }

      alert("Batch Created");
    }

setBatchName("");

setAgeGroup("");

setStartTime("");

setEndTime("");

setSelectedCenter("");

setEditingBatchId(null);

    fetchBatches();
  };

  // =========================
  // EDIT
  // =========================

const handleEdit = (
  batch
) => {

  if (!isSuperAdmin(user) && !isAcademyOwner(user)) {
    return;
  }

setAgeGroup(
  batch.age_group || ""
);

setStartTime(
  batch.start_time || ""
);

setEndTime(
  batch.end_time || ""
);

    setEditingBatchId(
      batch.id
    );

    setBatchName(
      batch.batch_name
    );

    setSelectedAcademy(
      batch.academy_id
    );

    setSelectedCenter(
      batch.center_id
    );
  };

  // =========================
  // DELETE
  // =========================

const handleDelete = async (
  id
) => {

  if (!isSuperAdmin(user) && !isAcademyOwner(user)) {
    alert("You do not have permission to manage batches.");
    return;
  }


    const confirmDelete =
      window.confirm(
        "Delete this batch?"
      );

    if (!confirmDelete) {
      return;
    }

    const { error } = await supabase
      .from("batches")
      .update({
        is_active: false
      })
      .eq("id", id);

    if (error) {

      alert(error.message);

      return;
    }

    alert("Batch Deleted");

    fetchBatches();
  };

if (!user) {

  return (
    <Layout>
      <div
        style={{
          padding: "20px"
        }}
      >
        Loading...
      </div>
    </Layout>
  );
}

return (
  <Layout>
    <div style={{ padding: "20px" }}>
      <h1>Batches Management</h1>

      {/* ========================= */}
      {/* SUPER ADMIN */}
      {/* ========================= */}

      {isSuperAdmin(user) && (

        <>
          <select
            value={selectedAcademy}
            onChange={(e) =>
              handleAcademyChange(
                e.target.value
              )
            }
          >

            <option value="">
              All Academies
            </option>

            {
              academies.map(
                (academy) => (

                  <option
                    key={academy.id}
                    value={academy.id}
                  >
                    {
                      academy.academy_name
                    }
                  </option>

                )
              )
            }

          </select>

          <br />
          <br />
        </>
      )}

      {/* CENTER */}

      <select
        value={selectedCenter}
        onChange={(e) =>
          setSelectedCenter(
            e.target.value
          )
        }
      >

        <option value="">
          All Centers
        </option>

        {
          filteredCenters.map(
            (center) => (

              <option
                key={center.id}
                value={center.id}
              >
                {
                  center.center_name
                }
              </option>

            )
          )
        }

      </select>

      <br />
      <br />

{(isSuperAdmin(user) || isAcademyOwner(user)) && (
  <>

      {/* BATCH NAME */}

<input
  type="text"
  placeholder="Enter Batch Name"
  value={batchName}
  onChange={(e) =>
    setBatchName(e.target.value)
  }
/>

<br />
<br />

<select
  value={ageGroup}
  onChange={(e) =>
    setAgeGroup(e.target.value)
  }
>

  <option value="">
    Select Age Group
  </option>

  {AGE_GROUPS.map(group => (

    <option
      key={group}
      value={group}
    >
      {group}
    </option>

  ))}

</select>

<br />
<br />

<input
  type="time"
  value={startTime}
  onChange={(e) =>
    setStartTime(e.target.value)
  }
/>

<br />
<br />

<input
  type="time"
  value={endTime}
  onChange={(e) =>
    setEndTime(e.target.value)
  }
/>

      <br />
      <br />

      <button
        onClick={
          handleSaveBatch
        }
      >

        {
          editingBatchId
            ? "Update Batch"
            : "Create Batch"
        }

      </button>
</>)}
      <br />
      <br />
      <br />

      {/* ========================= */}
      {/* BATCHES TABLE */}
      {/* ========================= */}

      <table
        border="1"
        width="100%"
      >

        <thead>

          <tr>

<th>Batch</th>
<th>Age Group</th>
<th>Start</th>
<th>End</th>
<th>Center</th>

{isSuperAdmin(user) && (
  <th>Academy</th>
)}

{(isSuperAdmin(user) || isAcademyOwner(user)) && (
  <th>Actions</th>
)}

          </tr>

        </thead>

        <tbody>

          {
            batches.map(
              (batch) => (

                <tr key={batch.id}>

<td>{batch.batch_name}</td>

<td>{batch.age_group}</td>

<td>{batch.start_time}</td>

<td>{batch.end_time}</td>

                  <td>
                    {
                      batch.centers
                        ?.center_name
                    }
                  </td>

{isSuperAdmin(user) && (
  <td>
    {batch.academies?.academy_name}
  </td>
)}
{(isSuperAdmin(user) || isAcademyOwner(user)) && (
                  <td>

                    <button
                      onClick={() =>
                        handleEdit(
                          batch
                        )
                      }
                    >
                      Edit
                    </button>

                    {" "}

                    <button
                      onClick={() =>
                        handleDelete(
                          batch.id
                        )
                      }
                    >
                      Delete
                    </button>

                  </td>
                  )}

                </tr>

              )
            )
          }

        </tbody>

      </table>

    </div>
  </Layout>
);
};

export default Batches;