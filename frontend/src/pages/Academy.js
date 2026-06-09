import React, { useEffect, useState } from "react";

import {
  createAcademy,
  getAcademies
} from "../services/academyService";

const Academy = () => {

  const [academyName, setAcademyName] = useState("");

  const [academies, setAcademies] = useState([]);

  const handleSubmit = async (e) => {

    e.preventDefault();

    try {

      await createAcademy({
        academy_name: academyName,
        owner_name: "Test Owner"
      });

      alert("Academy Created Successfully");

      setAcademyName("");

      fetchAcademies();

    } catch (error) {

      console.error("FULL ERROR:", error);

      alert(JSON.stringify(error));
    }
  };

  const fetchAcademies = async () => {

    try {

      const data = await getAcademies();

      setAcademies(data);

    } catch (error) {

      console.error(error);
    }
  };

  useEffect(() => {

    fetchAcademies();

  }, []);

  return (
    <div style={{ padding: "20px" }}>

      <h1>Create Academy</h1>

      <form onSubmit={handleSubmit}>

        <input
          type="text"
          placeholder="Enter Academy Name"
          value={academyName}
          onChange={(e) => setAcademyName(e.target.value)}
        />

        <br />
        <br />

        <button type="submit">
          Create Academy
        </button>

      </form>

      <hr />

      <h2>Academy List</h2>

      {
        academies.map((academy) => (
          <div key={academy.id}>

            <p>
              {academy.academy_name}
            </p>

          </div>
        ))
      }

    </div>
  );
};

export default Academy;