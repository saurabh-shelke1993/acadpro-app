import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import {
  getLoggedInUser,
  isSuperAdmin,
  getAcademyId,
} from "../utils/auth";

function Players() {
  const loggedInUser = getLoggedInUser();

  const [players, setPlayers] = useState([]);

  const [academies, setAcademies] = useState([]);
  const [centers, setCenters] = useState([]);
  const [batches, setBatches] = useState([]);

  const [selectedAcademy, setSelectedAcademy] = useState("");
  const [selectedCenter, setSelectedCenter] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");

  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");

  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentAddress, setParentAddress] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editingParentId, setEditingParentId] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");

  const [filterCenter, setFilterCenter] = useState("");
  const [filterBatch, setFilterBatch] = useState("");

  useEffect(() => {
    fetchAcademies();
    fetchPlayers();
  }, []);

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

  const fetchAcademies = async () => {
    if (isSuperAdmin()) {
      const { data } = await supabase
        .from("academies")
        .select("*")
        .eq("is_active", true);

      setAcademies(data || []);
    } else {
      const academyId = getAcademyId();

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

    if (!isSuperAdmin()) {
      query = query.eq(
        "academy_id",
        getAcademyId()
      );
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

    if (!/^\d{10}$/.test(phone)) {
      alert(
        "Player phone must be exactly 10 digits"
      );
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
            phone: phone,
            is_active: true,
          },
        ])
        .select();

    if (playerError) {
      alert(playerError.message);
      return;
    }

    const playerId = playerData[0].id;

    await supabase
      .from("player_batches")
      .insert([
        {
          player_id: playerId,
          batch_id: selectedBatch,
        },
      ]);

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
    setPhone(player.phone || "");

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
        parent_name: parentName,
        phone: parentPhone,
        email: parentEmail,
        address: parentAddress,
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
        phone: phone,
      })
      .eq("id", editingPlayerId);

    if (playerError) {
      alert(playerError.message);
      return;
    }

    alert("Player Updated Successfully");

    resetForm();

    setIsEditing(false);

    fetchPlayers();
  };

  const handleDeletePlayer = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this player?"
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

    alert("Player Deleted");

    fetchPlayers();
  };

  const resetForm = () => {
    setFullName("");
    setDob("");
    setPhone("");

    setParentName("");
    setParentPhone("");
    setParentEmail("");
    setParentAddress("");

    setIsEditing(false);
    setEditingPlayerId(null);
    setEditingParentId(null);
  };

  const filteredPlayers = players.filter(
    (player) => {
      const matchesSearch =
        player.full_name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase());

      const matchesCenter = filterCenter
        ? player.center_id === filterCenter
        : true;

      const matchesBatch = filterBatch
        ? player.batch_id === filterBatch
        : true;

      return (
        matchesSearch &&
        matchesCenter &&
        matchesBatch
      );
    }
  );

  return (
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

      {/* FILTER CENTER */}
      <select
        value={filterCenter}
        onChange={(e) =>
          setFilterCenter(e.target.value)
        }
      >
        <option value="">All Centers</option>

        {centers.map((center) => (
          <option
            key={center.id}
            value={center.id}
          >
            {center.center_name}
          </option>
        ))}
      </select>

      <br />
      <br />

      {/* FILTER BATCH */}
      <select
        value={filterBatch}
        onChange={(e) =>
          setFilterBatch(e.target.value)
        }
      >
        <option value="">All Batches</option>

        {batches.map((batch) => (
          <option key={batch.id} value={batch.id}>
            {batch.batch_name}
          </option>
        ))}
      </select>

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
          disabled={!isSuperAdmin()}
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

      <input
        type="date"
        value={dob}
        onChange={(e) => setDob(e.target.value)}
      />

      <br />
      <br />

      <input
        type="text"
        placeholder="Player Phone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

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
            <th>Phone</th>
            <th>Action</th>
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

              <td>{player.phone}</td>

              <td>
                <button
                  onClick={() =>
                    handleEditPlayer(player)
                  }
                >
                  Edit
                </button>

                <button
                  onClick={() =>
                    handleDeletePlayer(player.id)
                  }
                  style={{ marginLeft: "10px" }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Players;