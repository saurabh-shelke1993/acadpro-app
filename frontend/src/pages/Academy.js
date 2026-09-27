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
import "./Academy.css";

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

      <div className="academy-page">

        <div className="academy-page-header">
          <div>
            <span className="academy-page-eyebrow">Academy management</span>
            <h1>Academies</h1>
            <p>Create and manage active academies.</p>
          </div>
          <div className="academy-page-count">
            <strong>{academies.length}</strong>
            <span>active academies</span>
          </div>
        </div>

        <section className="academy-form-card">
          <div className="academy-section-heading">
            <h2>{editingAcademyId ? "Edit Academy" : "Create Academy"}</h2>
            <p>{editingAcademyId ? "Update the academy name and save your changes." : "Add a new academy to the platform."}</p>
          </div>
          <form onSubmit={handleSubmit}>

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
        </section>

        <div className="academy-list-header">
          <div>
            <h2>Academy List</h2>
            <p>{academies.length} {academies.length === 1 ? "academy" : "academies"} shown</p>
          </div>
        </div>

        <div className="academy-table-wrap">
        <table className="academy-table">
            <caption className="sr-only">Academies and available management actions</caption>

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
            {academies.length === 0 ? (
              <tr>
                <td className="academy-empty-state" colSpan={2}>
                  <strong>No active academies</strong>
                  <span>Create your first academy above.</span>
                </td>
              </tr>
            ) : (
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
                        aria-label={`Edit ${academy.academy_name}`}
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
                        aria-label={`Delete ${academy.academy_name}`}
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
            )}
          </tbody>
        </table>
        </div>

      </div>

    </Layout>
  );
};

export default Academy;