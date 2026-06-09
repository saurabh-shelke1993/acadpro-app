import { useEffect, useState } from "react";

import { supabase } from "../supabaseClient";

function Batches() {

  const [academies, setAcademies] = useState([]);

  const [centers, setCenters] = useState([]);

  const [filteredCenters, setFilteredCenters] = useState([]);

  const [selectedAcademy, setSelectedAcademy] = useState("");

  const [selectedCenter, setSelectedCenter] = useState("");

  const [batchName, setBatchName] = useState("");

  useEffect(() => {

    fetchAcademies();

    fetchCenters();

  }, []);

  const fetchAcademies = async () => {

    const { data, error } = await supabase
      .from("academies")
      .select("*");

    if (!error) {

      setAcademies(data);
    }
  };

  const fetchCenters = async () => {

    const { data, error } = await supabase
      .from("centers")
      .select("*");

    if (!error) {

      setCenters(data);
    }
  };

  const handleAcademyChange = (academyId) => {

    setSelectedAcademy(academyId);

    const relatedCenters = centers.filter(
      (center) => center.academy_id === academyId
    );

    setFilteredCenters(relatedCenters);
  };

  const handleCreateBatch = async () => {

    const { error } = await supabase
      .from("batches")
      .insert([
        {
          academy_id: selectedAcademy,
          center_id: selectedCenter,
          batch_name: batchName
        }
      ]);

    if (error) {

      alert(error.message);

      return;
    }

    alert("Batch Created Successfully");

    setBatchName("");
  };

  return (

    <div style={{ padding: "20px" }}>

      <h1>Create Batch</h1>

      <select
        value={selectedAcademy}
        onChange={(e) =>
          handleAcademyChange(e.target.value)
        }
      >

        <option value="">Select Academy</option>

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

      <select
        value={selectedCenter}
        onChange={(e) =>
          setSelectedCenter(e.target.value)
        }
      >

        <option value="">Select Center</option>

        {filteredCenters.map((center) => (

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

      <button onClick={handleCreateBatch}>
        Create Batch
      </button>

    </div>
  );
}

export default Batches;