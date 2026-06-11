import React, {
  useEffect,
  useState
} from "react";

import { supabase } from "../services/supabase";

import {
  isSuperAdmin,
  getAcademyId
} from "../utils/auth";

const Batches = () => {

  const [academies, setAcademies] =
    useState([]);

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

  useEffect(() => {

    fetchAcademies();

    fetchCenters();

    fetchBatches();

  }, []);

  // =========================
  // FETCH ACADEMIES
  // =========================

  const fetchAcademies = async () => {

    if (!isSuperAdmin()) {
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

    if (!isSuperAdmin()) {

      query = query.eq(
        "academy_id",
        getAcademyId()
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

    if (!isSuperAdmin()) {

      query = query.eq(
        "academy_id",
        getAcademyId()
      );
    }

    const { data, error } = await query;

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
      !batchName
    ) {

      alert(
        "Please fill all fields"
      );

      return;
    }

    let academyId = selectedAcademy;

    if (!isSuperAdmin()) {

      academyId = getAcademyId();
    }

    // =====================
    // UPDATE
    // =====================

    if (editingBatchId) {

      const { error } = await supabase
        .from("batches")
        .update({
          center_id: selectedCenter,
          batch_name: batchName
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

    setSelectedCenter("");

    fetchBatches();
  };

  // =========================
  // EDIT
  // =========================

  const handleEdit = (
    batch
  ) => {

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

  return (

    <div style={{ padding: "20px" }}>

      <h1>Batches Management</h1>

      {/* ========================= */}
      {/* SUPER ADMIN */}
      {/* ========================= */}

      {isSuperAdmin() && (

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
          setBatchName(
            e.target.value
          )
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

            <th>Center</th>

            <th>Academy</th>

            <th>Actions</th>

          </tr>

        </thead>

        <tbody>

          {
            batches.map(
              (batch) => (

                <tr key={batch.id}>

                  <td>
                    {
                      batch.batch_name
                    }
                  </td>

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
  );
};

export default Batches;