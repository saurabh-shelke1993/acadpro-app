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

  const [selectedAcademyId, setSelectedAcademyId] =
    useState(null);

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
      setSelectedAcademyId(null);

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

    setSelectedAcademyId(academy.id);
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

        <div className="academy-workspace">
          <section className="academy-form-card">
            <div className="academy-section-heading">
              <span className="academy-card-eyebrow">
                {editingAcademyId ? "Update academy" : "New academy"}
              </span>
              <h2>{editingAcademyId ? "Edit Academy" : "Create Academy"}</h2>
              <p>
                {editingAcademyId
                  ? "Update the academy name and save your changes."
                  : "Add a new academy to the platform."}
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <label htmlFor="academy-name">Academy name</label>
              <input
                id="academy-name"
                type="text"
                placeholder="Enter academy name"
                value={academyName}
                onChange={(e) => setAcademyName(e.target.value)}
              />

              <div className="academy-form-actions">
                <button type="submit" className="academy-primary-button">
                  {editingAcademyId ? "Update Academy" : "Create Academy"}
                </button>

                {editingAcademyId && (
                  <button
                    type="button"
                    className="academy-secondary-button"
                    onClick={() => {
                      setEditingAcademyId(null);
                      setAcademyName("");
                      setSelectedAcademyId(null);
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="academy-list-card">
            <div className="academy-list-header">
              <div>
                <span className="academy-card-eyebrow">Active academies</span>
                <h2>Academy List</h2>
                <p>
                  {academies.length}{" "}
                  {academies.length === 1 ? "academy" : "academies"} shown
                </p>
              </div>
              <span className="academy-list-hint">
                Hover or select an academy for actions
              </span>
            </div>

            <div className="academy-table-wrap">
              <table className="academy-table">
                <caption className="sr-only">
                  Academies. Hover or select a row to reveal management actions.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Academy Name</th>
                    <th scope="col" className="academy-actions-heading">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {academies.length === 0 ? (
                    <tr>
                      <td className="academy-empty-state" colSpan={2}>
                        <strong>No active academies</strong>
                        <span>Create your first academy to get started.</span>
                      </td>
                    </tr>
                  ) : (
                    academies.map((academy) => {
                      const isSelected = selectedAcademyId === academy.id;
                      return (
                        <tr
                          key={academy.id}
                          className={isSelected ? "academy-row-selected" : ""}
                          tabIndex={0}
                          onClick={() => setSelectedAcademyId(academy.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedAcademyId(academy.id);
                            }
                          }}
                        >
                          <td>
                            <span className="academy-row-name">{academy.academy_name}</span>
                            {isSelected && (
                              <span className="academy-row-state">Selected</span>
                            )}
                          </td>
                          <td className="academy-row-actions">
                            <div className="academy-actions">
                              <button
                                type="button"
                                aria-label={`Edit ${academy.academy_name}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleEdit(academy);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                aria-label={`Delete ${academy.academy_name}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDelete(academy.id);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

      </div>

    </Layout>
  );
};

export default Academy;