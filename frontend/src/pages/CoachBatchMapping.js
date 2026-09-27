import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import "./CoachBatchMapping.css";
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
    <div className="coach-mapping-page">
      <div className="coach-mapping-header">
        <div>
          <span className="coach-mapping-eyebrow">Academy management</span>
          <h1>Coach Batch Mapping</h1>
          <p>Assign coaches to active batches and review current mappings.</p>
        </div>
        <div className="coach-mapping-count"><strong>{assignments.length}</strong><span>active mappings</span></div>
      </div>

      <div className="coach-mapping-filter-card">
        <div className="coach-mapping-section-heading"><div><h2>Academy</h2><p>Select the academy for this mapping workspace.</p></div></div>
        <label className="coach-mapping-field"><span>Academy</span>
          <select value={selectedAcademy} onChange={(e) => { setSelectedAcademy(e.target.value); setSelectedCenter(""); setSelectedBatch(""); }} disabled={!isSuperAdmin(user)}>
            <option value="">Select Academy</option>
            {academies.map((academy) => <option key={academy.id} value={academy.id}>{academy.academy_name}</option>)}
          </select>
        </label>
      </div>

      <div className="coach-mapping-form-card">
        <div className="coach-mapping-section-heading"><div><h2>Assign Coach To Batch</h2><p>Select a coach, center, and batch to create a mapping.</p></div></div>
        <div className="coach-mapping-form-grid">
          <label className="coach-mapping-field"><span>Coach *</span>
            <select value={selectedCoach} onChange={(e) => setSelectedCoach(e.target.value)}>
              <option value="">Select Coach</option>
              {coaches.map((coach) => <option key={coach.id} value={coach.id}>{coach.full_name}</option>)}
            </select>
          </label>
          <label className="coach-mapping-field"><span>Center *</span>
            <select value={selectedCenter} onChange={(e) => { setSelectedCenter(e.target.value); setSelectedBatch(""); }}>
              <option value="">Select Center</option>
              {centers.map((center) => <option key={center.id} value={center.id}>{center.center_name}</option>)}
            </select>
          </label>
          <label className="coach-mapping-field"><span>Batch *</span>
            <select value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)} disabled={!selectedCenter}>
              <option value="">Select Batch</option>
              {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batch_name}</option>)}
            </select>
          </label>
        </div>
        <div className="coach-mapping-form-actions">
          <button className="coach-mapping-primary-button" type="button" onClick={assignCoach}>Assign Coach</button>
        </div>
      </div>

      <div className="coach-mapping-list-header">
        <div><h2>Current Mappings</h2><p>Active coach-to-batch assignments for the selected academy.</p></div>
      </div>

      <div className="coach-mapping-table-wrap">
        <table className="coach-mapping-table">
          <thead><tr><th>Coach</th><th>Batch</th><th>Center</th><th>Status</th></tr></thead>
          <tbody>
            {assignments.length > 0 ? assignments.map((item) => (
              <tr key={item.id}>
                <td className="coach-mapping-name-cell">{item.coaches?.full_name || "—"}</td>
                <td>{item.batches?.batch_name || "—"}</td>
                <td>{item.batches?.centers?.center_name || "—"}</td>
                <td><span className="mapping-status-badge">{item.is_active ? "Active" : "Inactive"}</span></td>
              </tr>
            )) : <tr><td className="coach-mapping-empty-state" colSpan="4"><strong>No mappings found</strong><span>Create an assignment using the form above.</span></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  </Layout>
);
}

export default CoachBatchMapping;