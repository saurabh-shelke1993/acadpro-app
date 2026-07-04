import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import {
  getLoggedInUser,
  isSuperAdmin,
  getAcademyId,
} from "../utils/auth";
import Layout from "../components/Layout";

function Players() {
 const [loggedInUser, setLoggedInUser] =
  useState(null);
   console.log("IS SUPER ADMIN =", isSuperAdmin(loggedInUser));
console.log("USER =", loggedInUser);
  
  const [players, setPlayers] = useState([]);

  const [academies, setAcademies] = useState([]);
  const [centers, setCenters] = useState([]);
  const [batches, setBatches] = useState([]);

  const [selectedAcademy, setSelectedAcademy] = useState("");
  const [selectedCenter, setSelectedCenter] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");

  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");

  const [joiningDate, setJoiningDate] = useState(
  new Date().toISOString().split("T")[0]
);


  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentAddress, setParentAddress] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editingParentId, setEditingParentId] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");

useEffect(() => {
  fetchLoggedInUser();
}, []);

const fetchLoggedInUser =
async () => {

  const user =
    await getLoggedInUser();

  setLoggedInUser(user);

};

  useEffect(() => {
    if (selectedAcademy) {
      fetchCenters(selectedAcademy);
    }
  }, [selectedAcademy]);

  useEffect(() => {
    if (selectedCenter) {
      fetchBatches(selectedCenter);
    }
  }, [selectedCenter]);

useEffect(() => {

  if (!loggedInUser) return;

  fetchAcademies();
  fetchPlayers();

}, [
  loggedInUser,
  selectedAcademy,
  selectedCenter,
  selectedBatch,
  searchTerm
]);

  const calculateAge = (dob) => {
    if (!dob) return "";

    const birthDate = new Date(dob);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

    const monthDiff =
      today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 &&
        today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  };
  console.log("PLAYERS COMPONENT RENDERED");
  const fetchAcademies = async () => {
  if (!loggedInUser) return;

  console.log("FETCHING ACADEMIES");

  if (isSuperAdmin(loggedInUser)) {

const { data, error } = await supabase
  .from("academies")
  .select("*")
  .eq("is_active", true);

console.log("ACADEMIES =", data);
console.log("ACADEMIES ERROR =", error);

      setAcademies(data || []);
    } else {
      const academyId = getAcademyId(loggedInUser);

      const { data } = await supabase
        .from("academies")
        .select("*")
        .eq("id", academyId)
        .eq("is_active", true);

      setAcademies(data || []);

      if (data && data.length > 0) {
        setSelectedAcademy(data[0].id);
      }
    }
  };

  const fetchCenters = async (academyId) => {
    const { data } = await supabase
      .from("centers")
      .select("*")
      .eq("academy_id", academyId)
      .eq("is_active", true);

    setCenters(data || []);
  };

  const fetchBatches = async (centerId) => {
    const { data } = await supabase
      .from("batches")
      .select("*")
      .eq("center_id", centerId)
      .eq("is_active", true);

    setBatches(data || []);
  };

  const fetchPlayers = async () => {
    let query = supabase
      .from("players")
      .select(`
        *,
        academies(academy_name),
        centers(center_name),
        batches(batch_name),
        parents(
          parent_name,
          phone,
          email,
          address
        )
      `)
      .eq("is_active", true);

    if (!isSuperAdmin(loggedInUser)) {
      query = query.eq(
        "academy_id",
        getAcademyId(loggedInUser))
      ;
    }

    if (selectedAcademy) {
  query = query.eq("academy_id", selectedAcademy);
}

if (selectedCenter) {
  query = query.eq("center_id", selectedCenter);
}

if (selectedBatch) {
  query = query.eq("batch_id", selectedBatch);
}

    const { data } = await query;

    setPlayers(data || []);
  };

  const validateForm = () => {
    if (
      !selectedAcademy ||
      !selectedCenter ||
      !selectedBatch ||
      !fullName
    ) {
      alert("Please fill required fields");
      return false;
    }

    if (!gender) {
  alert("Please select gender");
  return false;
}
if (!dob) {
  alert("Please select Date of Birth");
  return false;
}
if (!joiningDate) {
  alert("Please select Joining Date");
  return false;
}

    if (!/^\d{10}$/.test(parentPhone)) {
      alert(
        "Parent phone must be exactly 10 digits"
      );
      return false;
    }

    if (!parentEmail.includes("@")) {
      alert("Invalid parent email");
      return false;
    }

    return true;
  };

  const handleCreatePlayer = async () => {
    if (!validateForm()) return;

const { data: parentData, error: parentError } =
  await supabase
    .from("parents")
    .insert([
      {
        academy_id: selectedAcademy,
        parent_name: parentName,
        phone: parentPhone,
        email: parentEmail,
        address: parentAddress,
        is_active: true,
      },
    ])
    .select();

    if (parentError) {
      alert(parentError.message);
      return;
    }

    const parentId = parentData[0].id;

    const { data: playerData, error: playerError } =
      await supabase
        .from("players")
        .insert([
{
  academy_id: selectedAcademy,
  center_id: selectedCenter,
  batch_id: selectedBatch,
  parent_id: parentId,
  full_name: fullName,
  dob: dob,
  gender: gender,
  joining_date: joiningDate,
  player_status: "active",
  phone: parentPhone,
  is_active: true,
},
        ])
        .select();

    if (playerError) {
      alert(playerError.message);
      return;
    }

    const playerId = playerData[0].id;

const { error: playerBatchError } =
  await supabase
    .from("player_batches")
    .insert([
      {
        player_id: playerId,
        batch_id: selectedBatch,
      },
    ]);

if (playerBatchError) {

  console.log(playerBatchError);

  alert(
    "Player created, but batch mapping failed."
  );

  return;

}
    alert("Player Created Successfully");

    resetForm();

    fetchPlayers();
  };

  const handleEditPlayer = (player) => {
    setIsEditing(true);

    setEditingPlayerId(player.id);
    setEditingParentId(player.parent_id);

    setSelectedAcademy(player.academy_id);
    setSelectedCenter(player.center_id);
    setSelectedBatch(player.batch_id);

    setFullName(player.full_name);
    setDob(player.dob || "");
    setGender(player.gender || "");
    setJoiningDate(player.joining_date || "");
    setParentName(
      player.parents?.parent_name || ""
    );

    setParentPhone(player.parents?.phone || "");

    setParentEmail(player.parents?.email || "");

    setParentAddress(
      player.parents?.address || ""
    );
  };

  const handleUpdatePlayer = async () => {
    if (!validateForm()) return;

const { error: parentError } = await supabase
  .from("parents")
  .update({
    academy_id: selectedAcademy,
    parent_name: parentName,
    phone: parentPhone,
    email: parentEmail,
    address: parentAddress
  })
  .eq("id", editingParentId);

    if (parentError) {
      alert(parentError.message);
      return;
    }

const { error: playerError } = await supabase
  .from("players")
  .update({
    academy_id: selectedAcademy,
    center_id: selectedCenter,
    batch_id: selectedBatch,
    full_name: fullName,
    dob: dob,
    gender: gender,
    joining_date: joiningDate
  })
  .eq("id", editingPlayerId);

    if (playerError) {
      alert(playerError.message);
      return;
    }

const { error: playerBatchError } =
  await supabase
    .from("player_batches")
    .update({
      batch_id: selectedBatch
    })
    .eq("player_id", editingPlayerId);

if (playerBatchError) {

  console.log(playerBatchError);

  alert(
    "Player updated, but batch mapping update failed."
  );

  return;

}

    alert("Player Updated Successfully");

    resetForm();

    setIsEditing(false);

    fetchPlayers();
  };

  const handleDeletePlayer = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to deactivate this player?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("players")
      .update({
        is_active: false,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Player Deactivated");

    fetchPlayers();
  };

const resetForm = () => {
  setFullName("");
  setDob("");

  setGender("");

  setJoiningDate(
    new Date().toISOString().split("T")[0]
  );

  setParentName("");
  setParentPhone("");
  setParentEmail("");
  setParentAddress("");

  setIsEditing(false);
  setEditingPlayerId(null);
  setEditingParentId(null);
  setSelectedCenter("");
setSelectedBatch("");
};

  const filteredPlayers = players.filter(
    (player) => {
      const matchesSearch =
        player.full_name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase());

      return (
        matchesSearch
      );
    }
  );

return (
  <Layout>
    <div style={{ padding: "20px" }}>
      <h1>Players Module V3</h1>

      <h2>
        {isEditing
          ? "Edit Player"
          : "Create Player"}
      </h2>

      {/* SEARCH */}
      <input
        type="text"
        placeholder="Search Player"
        value={searchTerm}
        onChange={(e) =>
          setSearchTerm(e.target.value)
        }
      />

      <br />
      <br />

      <hr />

      {/* ACADEMY */}
      <div>
        <label>Academy</label>

        <br />

        <select
          value={selectedAcademy}
          onChange={(e) =>
            setSelectedAcademy(e.target.value)
          }
          disabled={!isSuperAdmin(loggedInUser)}
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

      <br />

      {/* CENTER */}
      <div>
        <label>Center</label>

        <br />

        <select
          value={selectedCenter}
          onChange={(e) =>
            setSelectedCenter(e.target.value)
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
      </div>

      <br />

      {/* BATCH */}
      <div>
        <label>Batch</label>

        <br />

        <select
          value={selectedBatch}
          onChange={(e) =>
            setSelectedBatch(e.target.value)
          }
        >
          <option value="">
            Select Batch
          </option>

          {batches.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {batch.batch_name}
            </option>
          ))}
        </select>
      </div>

      <hr />

      <h2>Player Information</h2>

      <input
        type="text"
        placeholder="Player Name"
        value={fullName}
        onChange={(e) =>
          setFullName(e.target.value)
        }
      />

      <br />
      <br />

<div>
  <label>Date of Birth *</label>
  <br />
  <input
    type="date"
    value={dob}
    onChange={(e) => setDob(e.target.value)}
  />
</div>

<div>
  <label>Joining Date *</label>
  <br />
  <input
    type="date"
    value={joiningDate}
    onChange={(e) => setJoiningDate(e.target.value)}
  />
</div>

<select
  value={gender}
  onChange={(e) => setGender(e.target.value)}
>
  <option value="">Select Gender</option>
  <option value="Male">Male</option>
  <option value="Female">Female</option>
</select>
      <br />
      <br />

      <hr />

      <h2>Parent Information</h2>

      <input
        type="text"
        placeholder="Parent Name"
        value={parentName}
        onChange={(e) =>
          setParentName(e.target.value)
        }
      />

      <br />
      <br />

      <input
        type="text"
        placeholder="Parent Phone"
        value={parentPhone}
        onChange={(e) =>
          setParentPhone(e.target.value)
        }
      />

      <br />
      <br />

      <input
        type="email"
        placeholder="Parent Email"
        value={parentEmail}
        onChange={(e) =>
          setParentEmail(e.target.value)
        }
      />

      <br />
      <br />

      <textarea
        placeholder="Parent Address"
        value={parentAddress}
        onChange={(e) =>
          setParentAddress(e.target.value)
        }
      />

      <br />
      <br />

{isEditing ? (
  <button onClick={handleUpdatePlayer}>
    Update Player
  </button>
) : (
  <button onClick={handleCreatePlayer}>
    Create Player
  </button>
)}

      <button
        onClick={resetForm}
        style={{ marginLeft: "10px" }}
      >
        Clear
      </button>

      <hr />

      <h2>Players List</h2>

      <table border="1" width="100%">
<thead>
  <tr>
    <th>Player</th>
    <th>Academy</th>
    <th>Center</th>
    <th>Batch</th>
    <th>Age</th>
    <th>Gender</th>
    <th>Joining Date</th>
    <th>Status</th>
    <th>Parent Phone</th>
    <th>Actions</th>
  </tr>
</thead>

        <tbody>
          {filteredPlayers.map((player) => (
            <tr key={player.id}>
              <td>{player.full_name}</td>

              <td>
                {player.academies?.academy_name}
              </td>

              <td>
                {player.centers?.center_name}
              </td>

              <td>
                {player.batches?.batch_name}
              </td>

              <td>
                {calculateAge(player.dob)}
              </td>
              <td>{player.gender}</td>
<td>{player.joining_date}</td>
<td>{player.player_status}</td>

              <td>{player.parents?.phone}</td>

<td>
  <button onClick={() => handleEditPlayer(player)}>
    Edit
  </button>

  <button
    onClick={() => handleDeletePlayer(player.id)}
    style={{ marginLeft: "10px" }}
  >
    Deactivate
  </button>
</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Layout>
);
}

export default Players;