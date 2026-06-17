import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import {
  getLoggedInUser,
  isSuperAdmin
} from "../utils/auth";

import {
  createAcademy,
  getAcademies,
  updateAcademy,
  deleteAcademy
} from "../services/academyService";

const Academy = () => {

  const [user, setUser] = useState(null);

  const [academyName, setAcademyName] =
    useState("");

  const [
    editingAcademyId,
    setEditingAcademyId
  ] = useState(null);

  const [academies, setAcademies] =
    useState([]);

  const loadUser = async () => {

    const currentUser =
      await getLoggedInUser();

    setUser(currentUser);
  };

  const fetchAcademies = async () => {

    try {

      const data =
        await getAcademies();

      setAcademies(data || []);

    } catch (error) {

      console.error(error);
    }
  };

  const handleSubmit = async (e) => {

    e.preventDefault();

    if (!academyName.trim()) {

      alert(
        "Please enter academy name"
      );

      return;
    }

    const existingAcademy =
      academies.find(
        academy =>
          academy.academy_name
            .trim()
            .toLowerCase() ===
          academyName
            .trim()
            .toLowerCase() &&
          academy.id !==
            editingAcademyId
      );

    if (existingAcademy) {

      alert(
        "Academy already exists"
      );

      return;
    }

    try {

      if (editingAcademyId) {

        await updateAcademy(
          editingAcademyId,
          academyName
        );

        alert(
          "Academy Updated Successfully"
        );

      } else {

        await createAcademy({
          academy_name:
            academyName,
          owner_name:
            "Test Owner",
          is_active: true
        });

        alert(
          "Academy Created Successfully"
        );
      }

      setAcademyName("");

      setEditingAcademyId(null);

      fetchAcademies();

    } catch (error) {

      console.error(error);

      alert(
        "Operation Failed"
      );
    }
  };

  const handleEdit = (
    academy
  ) => {

    setEditingAcademyId(
      academy.id
    );

    setAcademyName(
      academy.academy_name
    );
  };

  const handleDelete = async (
    academyId
  ) => {

    const confirmDelete =
      window.confirm(
        "Are you sure you want to delete this academy?"
      );

    if (!confirmDelete) {
      return;
    }

    try {

      await deleteAcademy(
        academyId
      );

      fetchAcademies();

    } catch (error) {

      console.error(error);

      alert(
        "Delete Failed"
      );
    }
  };

  useEffect(() => {

    loadUser();

  }, []);

  useEffect(() => {

    if (!user) return;

    if (
      !isSuperAdmin(user)
    ) {

      window.location.href =
        "/dashboard";

      return;
    }

    fetchAcademies();

  }, [user]);

  if (!user) {

    return (
      <Layout>
        <div>
          Loading...
        </div>
      </Layout>
    );
  }

  return (

    <Layout>

      <div
        style={{
          padding: "20px"
        }}
      >

        <h1>
          Academy Management
        </h1>

        <form
          onSubmit={
            handleSubmit
          }
        >

          <input
            type="text"
            placeholder="Enter Academy Name"
            value={
              academyName
            }
            onChange={(e) =>
              setAcademyName(
                e.target.value
              )
            }
          />

          <br />
          <br />

          <button
            type="submit"
          >
            {
              editingAcademyId
                ? "Update Academy"
                : "Create Academy"
            }
          </button>

          {
            editingAcademyId && (
              <>
                {" "}

                <button
                  type="button"
                  onClick={() => {

                    setEditingAcademyId(
                      null
                    );

                    setAcademyName(
                      ""
                    );
                  }}
                >
                  Cancel
                </button>
              </>
            )
          }

        </form>

        <hr />

        <h2>
          Academy List
        </h2>

        <table
          border="1"
          width="100%"
        >

          <thead>

            <tr>

              <th>
                Academy Name
              </th>

              <th>
                Actions
              </th>

            </tr>

          </thead>

          <tbody>

            {
              academies.map(
                academy => (

                  <tr
                    key={
                      academy.id
                    }
                  >

                    <td>
                      {
                        academy.academy_name
                      }
                    </td>

                    <td>

                      <button
                        onClick={() =>
                          handleEdit(
                            academy
                          )
                        }
                      >
                        Edit
                      </button>

                      {" "}

                      <button
                        onClick={() =>
                          handleDelete(
                            academy.id
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

    </Layout>
  );
};

export default Academy;