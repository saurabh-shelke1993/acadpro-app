import { useEffect, useState } from "react";

import { supabase } from "../supabaseClient";

function Players() {

  const [academies, setAcademies] = useState([]);

  const [selectedAcademy, setSelectedAcademy] = useState("");

  const [parentName, setParentName] = useState("");

  const [parentPhone, setParentPhone] = useState("");

  const [playerName, setPlayerName] = useState("");

  const [batches, setBatches] = useState([]);

  const [selectedBatches, setSelectedBatches] = useState([]);

  useEffect(() => {

    fetchAcademies();

    fetchBatches();

  }, []);

  const fetchAcademies = async () => {

    const { data, error } = await supabase
      .from("academies")
      .select("*");

    if (!error) {

      setAcademies(data);
    }
  };

  const fetchBatches = async () => {

    const { data, error } = await supabase
      .from("batches")
      .select("*");

    if (!error) {

      setBatches(data);
    }
  };

  const handleSave = async () => {

    if (
      !selectedAcademy ||
      !parentName ||
      !parentPhone ||
      !playerName
    ) {

      alert("Please fill all fields");

      return;
    }

    // CREATE PARENT

    const {
      data: parentData,
      error: parentError
    } = await supabase
      .from("parents")
      .insert([
        {
          academy_id: selectedAcademy,
          parent_name: parentName,
          phone: parentPhone
        }
      ])
      .select();

    if (parentError) {

      alert(parentError.message);

      return;
    }

    const parentId = parentData[0].id;

    // CREATE PLAYER

    const {
      data: playerData,
      error: playerError
    } = await supabase
      .from("players")
      .insert([
        {
          academy_id: selectedAcademy,
          parent_id: parentId,
          full_name: playerName
        }
      ])
      .select();

    if (playerError) {

      alert(playerError.message);

      return;
    }

    const playerId = playerData[0].id;

    // ASSIGN BATCHES

    const batchRows = selectedBatches.map(
      (batchId) => ({
        player_id: playerId,
        batch_id: batchId
      })
    );

    const { error: batchError } =
      await supabase
        .from("player_batches")
        .insert(batchRows);

    if (batchError) {

      alert(batchError.message);

      return;
    }

    alert("Player Created Successfully");

    setParentName("");

    setParentPhone("");

    setPlayerName("");

    setSelectedBatches([]);
  };

  return (

    <div style={{ padding: "20px" }}>

      <h1>Create Player</h1>

      <select
        value={selectedAcademy}
        onChange={(e) =>
          setSelectedAcademy(e.target.value)
        }
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

      <br />
      <br />

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
        type="text"
        placeholder="Player Name"
        value={playerName}
        onChange={(e) =>
          setPlayerName(e.target.value)
        }
      />

      <br />
      <br />

      <label>
        Select Multiple Batches
      </label>

      <br />
      <br />

      <select
        multiple
        value={selectedBatches}
        onChange={(e) => {

          const values =
            Array.from(
              e.target.selectedOptions,
              option => option.value
            );

          setSelectedBatches(values);
        }}
      >

        {
          batches
            .filter(
              (batch) =>
                batch.academy_id === selectedAcademy
            )
            .map((batch) => (

              <option
                key={batch.id}
                value={batch.id}
              >
                {batch.batch_name}
              </option>

            ))
        }

      </select>

      <br />
      <br />

      <button onClick={handleSave}>
        Save Player
      </button>

    </div>
  );
}

export default Players;