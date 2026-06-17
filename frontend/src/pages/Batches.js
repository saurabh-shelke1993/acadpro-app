import React, {
  useEffect,
  useState
} from "react";
import Layout from "../components/Layout";
import { supabase } from "../services/supabase";
import {
  getLoggedInUser,
  isSuperAdmin,
  getAcademyId
} from "../utils/auth";

const Batches = () => {

  const [academies, setAcademies] =
    useState([]);
  
  
  const [user, setUser] = useState(null);

  const loadUserLoggedinUser = async () => {

  const currentUser =
    await getLoggedInUser();

  setUser(currentUser);
};

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

useEffect(() => {

  loadUser();

}, []);

useEffect(() => {

  if (!user) return;

  fetchAcademies();

  fetchCenters();

}, [user]);

useEffect(() => {

  if (!user) return;

  fetchBatches();

}, [
  user,
  selectedAcademy,
  selectedCenter
]);

  // =========================
  // FETCH ACADEMIES
  // =========================
const loadUser = async () => {

  const currentUser =
    await getLoggedInUser();

  setUser(currentUser);
};

  const fetchAcademies = async () => {

    if (!isSuperAdmin(user)) {
      return;
    }

    const { data, error } = await supabase
      .from("academies")
      .select("*")
      .eq("is_active", true);

    if (!error) {

      setAcademies(data || []);
    }
  };

  // =========================
  // FETCH CENTERS
  // =========================

  const fetchCenters = async () => {

    let query = supabase
      .from("centers")
      .select("*")
      .eq("is_active", true);

    if (!isSuperAdmin(user)) {

      query = query.eq(
        "academy_id",
        getAcademyId(user)
      );
    }

    const { data, error } = await query;

    if (!error) {

      setCenters(data || []);

      setFilteredCenters(data || []);
    }
  };

  // =========================
  // FETCH BATCHES
  // =========================
const fetchBatches = async () => {

  let query = supabase
    .from("batches")
    .select(`
      *,
      academies (
        academy_name
      ),
      centers (
        center_name
      )
    `)
    .eq("is_active", true);

  if (isSuperAdmin(user)) {

    if (selectedAcademy) {

      query = query.eq(
        "academy_id",
        selectedAcademy
      );
    }

    if (selectedCenter) {

      query = query.eq(
        "center_id",
        selectedCenter
      );
    }

  } else {

    query = query.eq(
      "academy_id",
      getAcademyId(user)
    );

    if (selectedCenter) {

      query = query.eq(
        "center_id",
        selectedCenter
      );
    }
  }

  const { data, error } =
    await query;

  if (!error) {

    setBatches(data || []);
  }
};

  // =========================
  // ACADEMY CHANGE
  // =========================

  const handleAcademyChange = (
    academyId
  ) => {

    setSelectedAcademy(academyId);

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
{

      alert(
        "Please fill all fields"
      );

      return;
    }

    let academyId = selectedAcademy;

    if (!isSuperAdmin(user)) {

      academyId = getAcademyId(user);
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
              Select Academy
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
          Select Center
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

<th>Actions</th>

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

                  <td>
                    {
                      batch.academies
                        ?.academy_name
                    }
                  </td>

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