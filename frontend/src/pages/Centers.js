import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../services/supabase";

import {
  getLoggedInUser,
  isSuperAdmin,
  getAcademyId
} from "../utils/auth";

const Centers = () => {

const [user, setUser] = useState(null);

const [centers, setCenters] = useState([]);


  const [academies, setAcademies] = useState([]);

  const [selectedAcademy, setSelectedAcademy] = useState("");

  const [centerName, setCenterName] = useState("");

  const [editingCenterId, setEditingCenterId] =
    useState(null);

useEffect(() => {

  loadUser();

}, []);

useEffect(() => {

  if (!user) return;

  fetchAcademies();

  fetchCenters();

}, [user, selectedAcademy]);

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
console.log("USER:", user);
console.log(
  "ACADEMY ID:",
  getAcademyId(user)
);
console.log(
  "IS SUPER ADMIN:",
  isSuperAdmin(user)
);
    let query = supabase
      .from("centers")
      .select(`
        *,
        academies (
          academy_name
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

} else {

  query = query.eq(
    "academy_id",
    getAcademyId(user)
  );
}

    const { data, error } = await query;

    if (!error) {

      setCenters(data || []);
    }
  };

  // =========================
  // CREATE / UPDATE CENTER
  // =========================

  const handleSaveCenter = async () => {

    if (!centerName) {

      alert("Enter center name");

      return;
    }

    let academyId = selectedAcademy;

    // Academy Owner auto academy mapping

if (!isSuperAdmin(user)) {

      academyId = getAcademyId(user);
    }

const { data: existingCenter } =
  await supabase
    .from("centers")
    .select("id")
    .eq("academy_id", academyId)
    .eq("center_name", centerName)
    .eq("is_active", true)
    .maybeSingle();

if (
  existingCenter &&
  existingCenter.id !== editingCenterId
) {

  alert(
    "Center already exists in this academy"
  );

  return;
}

    // ======================
    // UPDATE CENTER
    // ======================

    if (editingCenterId) {

      const { error } = await supabase
        .from("centers")
        .update({
          center_name: centerName
        })
        .eq("id", editingCenterId);

      if (error) {

        alert(error.message);

        return;
      }

      alert("Center Updated");

      setEditingCenterId(null);
    }

    // ======================
    // CREATE CENTER
    // ======================

    else {

      const { error } = await supabase
        .from("centers")
        .insert([
          {
            academy_id: academyId,
            center_name: centerName,
            is_active: true
          }
        ]);

      if (error) {

        alert(error.message);

        return;
      }

      alert("Center Created");
    }

    setCenterName("");

    fetchCenters();
  };

  // =========================
  // EDIT CENTER
  // =========================

  const handleEdit = (center) => {

    setEditingCenterId(center.id);

    setCenterName(center.center_name);

    setSelectedAcademy(center.academy_id);
  };

  // =========================
  // DELETE CENTER
  // =========================

  const handleDelete = async (id) => {

    const confirmDelete =
      window.confirm(
        "Are you sure?"
      );

    if (!confirmDelete) {
      return;
    }

    const { error } = await supabase
      .from("centers")
      .update({
        is_active: false
      })
      .eq("id", id);

    if (error) {

      alert(error.message);

      return;
    }

    alert("Center Deleted");

    fetchCenters();
  };
if (!user) {

  return (
    <Layout>
      <div style={{ padding: "20px" }}>
        Loading...
      </div>
    </Layout>
  );
}

return (
  <Layout>
    <div style={{ padding: "20px" }}>

      <h1>Centers Management</h1>

      {/* ===================== */}
      {/* SUPER ADMIN ONLY */}
      {/* ===================== */}

{isSuperAdmin(user) && (

        <>
          <select
            value={selectedAcademy}
            onChange={(e) =>
              setSelectedAcademy(
                e.target.value
              )
            }
          >

            <option value="">
              Select Academy
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
        </>
      )}

      {/* CENTER NAME */}

      <input
        type="text"
        placeholder="Enter Center Name"
        value={centerName}
        onChange={(e) =>
          setCenterName(
            e.target.value
          )
        }
      />

      <br />
      <br />

      <button onClick={handleSaveCenter}>

        {
          editingCenterId
            ? "Update Center"
            : "Create Center"
        }

      </button>

      <br />
      <br />
      <br />

      {/* ========================= */}
      {/* CENTERS TABLE */}
      {/* ========================= */}

      <table
        border="1"
        width="100%"
      >

        <thead>

          <tr>

<th>Center Name</th>

{isSuperAdmin(user) && (
  <th>Academy</th>
)}

<th>Actions</th>

          </tr>

        </thead>

        <tbody>

          {
            centers.map((center) => (

              <tr key={center.id}>

                <td>
                  {center.center_name}
                </td>

{isSuperAdmin(user) && (
  <td>
    {
      center.academies
        ?.academy_name
    }
  </td>
)}

                <td>

                  <button
                    onClick={() =>
                      handleEdit(center)
                    }
                  >
                    Edit
                  </button>

                  {" "}

                  <button
                    onClick={() =>
                      handleDelete(center.id)
                    }
                  >
                    Delete
                  </button>

                </td>

              </tr>

            ))
          }

        </tbody>

      </table>

    </div>
  </Layout>
);
};

export default Centers;