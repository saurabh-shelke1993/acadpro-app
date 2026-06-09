import React, { useEffect, useState } from "react";

import {
  getAcademies,
  createCenter
} from "../services/academyService";

const Centers = () => {

  const [academies, setAcademies] = useState([]);

  const [selectedAcademy, setSelectedAcademy] = useState("");

  const [centerName, setCenterName] = useState("");

  useEffect(() => {

    fetchAcademies();

  }, []);

  const fetchAcademies = async () => {

    try {

      const data = await getAcademies();

      setAcademies(data);

    } catch (error) {

      console.error(error);
    }
  };
  const handleCreateCenter = async () => {

  try {

    await createCenter({

      academy_id: selectedAcademy,

      center_name: centerName

    });

    alert("Center Created Successfully");

    setCenterName("");

  } catch (error) {

    console.error(error);

    alert(error.message);
  }
};
  return (
    <div style={{ padding: "20px" }}>

      <h1>Create Center</h1>

      <select
        value={selectedAcademy}
        onChange={(e) => setSelectedAcademy(e.target.value)}
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

      <input
        type="text"
        placeholder="Enter Center Name"
        value={centerName}
        onChange={(e) => setCenterName(e.target.value)}
      />
    <br />
    <br />

    <button onClick={handleCreateCenter}>
    Create Center
    </button>
    </div>
  );
};

export default Centers;