import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import "./Coaches.css";
import { supabase } from "../supabaseClient";

import {
  getCurrentUser,
  isSuperAdmin,
} from "../utils/auth";

function Coaches() {

  // =====================================================
  // STATES
  // =====================================================

  const [user, setUser] = useState(null);

  const [academies, setAcademies] =
    useState([]);

  const [selectedAcademy,
    setSelectedAcademy] = useState("");

  const [coaches, setCoaches] =
    useState([]);

  const [fullName, setFullName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [specialization,
    setSpecialization] = useState("");

  const [searchTerm, setSearchTerm] = useState("");

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
  // FETCH ACADEMIES
  // =====================================================

  useEffect(() => {

    if (user) {

      fetchAcademies();

    }

  }, [user]);

  const fetchAcademies = async () => {

    try {

      let query = supabase
        .from("academies")
        .select("*")
        .eq("is_active", true);

      // OWNER FILTER
      if (!isSuperAdmin(user)) {

        query = query.eq(
          "id",
          user.academy_id
        );

      }

      const { data, error } =
        await query;

      if (error) throw error;

      setAcademies(data || []);

      // AUTO SELECT OWNER ACADEMY
      if (
        !isSuperAdmin(user) &&
        data.length > 0
      ) {

        setSelectedAcademy(
          data[0].id
        );

      }

    } catch (err) {

      console.log(err.message);

    }
  };

  // =====================================================
  // FETCH COACHES
  // =====================================================

  useEffect(() => {

    if (selectedAcademy) {

      fetchCoaches();

    }

  }, [selectedAcademy]);

  const fetchCoaches = async () => {

    try {

      const { data, error } =
        await supabase
          .from("coaches")
          .select("*")
          .eq(
            "academy_id",
            selectedAcademy
          )
          .order("created_at", {
            ascending: false,
          });

      if (error) throw error;

      setCoaches(data || []);

    } catch (err) {

      console.log(err.message);

    }
  };

  // =====================================================
  // ADD COACH
  // =====================================================

  const addCoach = async () => {

    try {

      if (
        !selectedAcademy ||
        !fullName
      ) {

        alert(
          "Academy and Coach Name required"
        );

        return;
      }

      const { error } =
        await supabase
          .from("coaches")
          .insert([
            {
              academy_id:
                selectedAcademy,

              full_name: fullName,

              email,

              phone,

              specialization,
            },
          ]);

      if (error) throw error;

      alert("Coach Added");

      setFullName("");
      setEmail("");
      setPhone("");
      setSpecialization("");

      fetchCoaches();

    } catch (err) {

      console.log(err.message);

      alert(err.message);

    }
  };

  const filteredCoaches = coaches.filter((coach) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return [coach.full_name, coach.email, coach.phone, coach.specialization].some((value) =>
      String(value || "").toLowerCase().includes(term)
    );
  });

  // =====================================================
  // UI
  // =====================================================

return (
  <Layout>
    <div className="coaches-page">
      <div className="coaches-page-header">
        <div>
          <span className="coaches-page-eyebrow">Academy management</span>
          <h1>Coaches</h1>
          <p>Manage coach profiles and specializations for your academy.</p>
        </div>
        <div className="coaches-page-count"><strong>{filteredCoaches.length}</strong><span>visible coaches</span></div>
      </div>

      <div className="coaches-filter-card">
        <div className="coaches-section-heading"><div><h2>Academy</h2><p>Select the academy whose coaches you want to manage.</p></div></div>
        <label className="coaches-field"><span>Academy</span>
          <select value={selectedAcademy} onChange={(e) => setSelectedAcademy(e.target.value)} disabled={!isSuperAdmin(user)}>
            <option value="">Select Academy</option>
            {academies.map((academy) => <option key={academy.id} value={academy.id}>{academy.academy_name}</option>)}
          </select>
        </label>
      </div>

      <div className="coaches-form-card">
        <div className="coaches-section-heading"><div><h2>Add Coach</h2><p>Create a coach profile for the selected academy.</p></div></div>
        <div className="coaches-form-grid">
          <label className="coaches-field"><span>Coach Name *</span><input type="text" placeholder="Enter coach name" value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>
          <label className="coaches-field"><span>Email</span><input type="email" placeholder="Enter email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="coaches-field"><span>Phone</span><input type="text" placeholder="Enter phone" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
          <label className="coaches-field"><span>Specialization</span><input type="text" placeholder="e.g. AFC B, Grassroots" value={specialization} onChange={(e) => setSpecialization(e.target.value)} /></label>
        </div>
        <div className="coaches-form-actions"><button className="coaches-primary-button" type="button" onClick={addCoach}>Add Coach</button></div>
      </div>

      <div className="coaches-list-header">
        <div><h2>Coaches List</h2><p>Search coaches by name, email, phone, or specialization.</p></div>
        <label className="coaches-search"><span className="sr-only">Search coaches</span><input type="search" placeholder="Search coach..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} aria-label="Search coaches" /></label>
      </div>
      <div className="coaches-table-meta"><span>{filteredCoaches.length} {filteredCoaches.length === 1 ? "coach" : "coaches"} shown</span>{searchTerm && <span>Filtered by "{searchTerm}"</span>}</div>

      <div className="coaches-table-wrap">
        <table className="coaches-table">
          <thead><tr><th>Coach</th><th>Email</th><th>Phone</th><th>Specialization</th><th>Status</th></tr></thead>
          <tbody>
            {filteredCoaches.length > 0 ? filteredCoaches.map((coach) => (
              <tr key={coach.id}>
                <td className="coaches-name-cell">{coach.full_name}</td><td>{coach.email || "—"}</td><td>{coach.phone || "—"}</td><td>{coach.specialization || "—"}</td>
                <td><span className="coach-status-badge">{coach.is_active ? "Active" : "Inactive"}</span></td>
              </tr>
            )) : <tr><td className="coaches-empty-state" colSpan="5"><strong>No coaches found</strong><span>{searchTerm ? "Try a different search term." : "No active coaches match the selected academy."}</span></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  </Layout>
);
}

export default Coaches;