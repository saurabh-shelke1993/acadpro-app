import { useEffect, useState } from "react";
import Layout from "../components/Layout";
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

  // =====================================================
  // UI
  // =====================================================

return (
  <Layout>
    <div style={{ padding: "20px" }}>


      <h1>Coaches Module V1</h1>

      {/* FILTERS */}

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

      {/* ADD COACH FORM */}

      <div
        style={{
          border: "1px solid #ccc",
          padding: "20px",
          marginBottom: "30px",
        }}
      >

        <h2>Add Coach</h2>

        <input
          type="text"
          placeholder="Coach Name"
          value={fullName}
          onChange={(e) =>
            setFullName(
              e.target.value
            )
          }
        />

        <br /><br />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) =>
            setEmail(
              e.target.value
            )
          }
        />

        <br /><br />

        <input
          type="text"
          placeholder="Phone"
          value={phone}
          onChange={(e) =>
            setPhone(
              e.target.value
            )
          }
        />

        <br /><br />

        <input
          type="text"
          placeholder="Specialization"
          value={specialization}
          onChange={(e) =>
            setSpecialization(
              e.target.value
            )
          }
        />

        <br /><br />

        <button onClick={addCoach}>
          Add Coach
        </button>

      </div>

      {/* COACHES TABLE */}

      <table
        border="1"
        cellPadding="10"
        width="100%"
      >

        <thead>

          <tr>

            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Specialization</th>

          </tr>

        </thead>

        <tbody>

          {coaches.length > 0 ? (

            coaches.map((coach) => (

              <tr key={coach.id}>

                <td>
                  {coach.full_name}
                </td>

                <td>
                  {coach.email}
                </td>

                <td>
                  {coach.phone}
                </td>

                <td>
                  {coach.specialization}
                </td>

              </tr>

            ))

          ) : (

            <tr>

              <td
                colSpan="4"
                align="center"
              >
                No Coaches Found
              </td>

            </tr>

          )}

        </tbody>

      </table>

    </div>
  </Layout>
);
}

export default Coaches;