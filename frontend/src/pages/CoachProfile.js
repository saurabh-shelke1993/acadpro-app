import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import { getCurrentUser } from "../utils/auth";
import { isAcademyOwner, isCoach, isSuperAdmin } from "../utils/roles";
import {
  createCoachCertification,
  deleteCoachCertification,
  getCoachCertifications,
  getCoachProfile,
  getMyCoachProfile,
  getParentCoachProfiles,
  updateCoachCertification,
  updateCoachProfile,
  updateMyCoachProfile,
} from "../services/coachProfileService";
import "./CoachProfile.css";

const EMPTY_FORM = {
  full_name: "",
  email: "",
  phone: "",
  profile_image: "",
  specialization: "",
  experience_years: "",
  joining_date: "",
  bio: "",
};

const EMPTY_CERTIFICATION = {
  certificate_name: "",
  issuing_organization: "",
  certificate_number: "",
  issue_date: "",
  expiry_date: "",
};

const formatDate = (value) => {
  if (!value) return "Not available";
  const date = new Date(String(value).includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (value) => (value ? String(value).slice(0, 5) : "Not available");

const getInitials = (name) =>
  String(name || "Coach")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

const CoachProfile = () => {
  const { coachId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [certifications, setCertifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [certSaving, setCertSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [certificationForm, setCertificationForm] = useState(EMPTY_CERTIFICATION);
  const [editingCertificationId, setEditingCertificationId] = useState(null);

  const isSelf = isCoach(user);
  const isParent = user?.role === "parent";
  const canManageProfile =
    !isParent && (isSuperAdmin(user) || isAcademyOwner(user));
  const canManageCertifications =
    isSuperAdmin(user) || isAcademyOwner(user);
  const canEditOwnProfile = isSelf && !isParent;
  const canEditProfile = canEditOwnProfile || canManageProfile;

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const currentUser = user || (await getCurrentUser());
      if (!user) setUser(currentUser);

      let nextProfile;

      if (isParent || currentUser?.role === "parent") {
        const profiles = await getParentCoachProfiles();
        nextProfile = profiles.find((item) => item.id === coachId);
        if (!nextProfile) {
          throw new Error("This coach profile is not available for your linked child.");
        }
      } else if (isSelf) {
        nextProfile = await getMyCoachProfile();
      } else if (coachId) {
        nextProfile = await getCoachProfile(coachId);
      } else {
        throw new Error("Coach ID is required.");
      }

      setProfile(nextProfile);
      setForm({
        full_name: nextProfile.full_name || "",
        email: nextProfile.email || "",
        phone: nextProfile.phone || "",
        profile_image: nextProfile.profile_image || "",
        specialization: nextProfile.specialization || "",
        experience_years:
          nextProfile.experience_years === null ||
          nextProfile.experience_years === undefined
            ? ""
            : String(nextProfile.experience_years),
        joining_date: nextProfile.joining_date || "",
        bio: nextProfile.bio || "",
      });

      if (!isParent && nextProfile?.id) {
        try {
          setCertifications(await getCoachCertifications(nextProfile.id));
        } catch (certError) {
          setCertifications([]);
          setMessage(certError.message || "Certifications could not be loaded.");
        }
      } else {
        setCertifications([]);
      }
    } catch (loadError) {
      setError(loadError.message || "Unable to load coach profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (mounted) setUser(currentUser);
      } catch (loadError) {
        if (mounted) setError(loadError.message || "Unable to verify your session.");
      }
    };

    initialize();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (user) loadProfile();
    // The route identity and authenticated role determine the profile scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, coachId]);

  const centers = useMemo(() => {
    const seen = new Set();
    return (profile?.assignments || [])
      .map((assignment) => assignment.center)
      .filter((center) => center?.center_name)
      .filter((center) => {
        if (seen.has(center.center_name)) return false;
        seen.add(center.center_name);
        return true;
      });
  }, [profile]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const updated = canManageProfile
        ? await updateCoachProfile(profile?.id, form)
        : await updateMyCoachProfile(form);
      setProfile(updated);
      setEditing(false);
      setMessage("Profile updated successfully.");
    } catch (saveError) {
      setError(saveError.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const resetCertificationForm = () => {
    setCertificationForm(EMPTY_CERTIFICATION);
    setEditingCertificationId(null);
  };

  const handleCertificationSubmit = async (event) => {
    event.preventDefault();
    if (!profile?.id) return;

    setCertSaving(true);
    setError("");
    setMessage("");

    try {
      if (editingCertificationId) {
        await updateCoachCertification(editingCertificationId, certificationForm);
        setMessage("Certification updated successfully.");
      } else {
        await createCoachCertification({
          coach_id: profile.id,
          ...certificationForm,
        });
        setMessage("Certification added successfully.");
      }

      setCertifications(await getCoachCertifications(profile.id));
      resetCertificationForm();
    } catch (certError) {
      setError(certError.message || "Failed to save certification.");
    } finally {
      setCertSaving(false);
    }
  };

  const startCertificationEdit = (certification) => {
    setEditingCertificationId(certification.id);
    setCertificationForm({
      certificate_name: certification.certificate_name || "",
      issuing_organization: certification.issuing_organization || "",
      certificate_number: certification.certificate_number || "",
      issue_date: certification.issue_date || "",
      expiry_date: certification.expiry_date || "",
    });
  };

  const handleCertificationDelete = async (certification) => {
    if (!window.confirm(`Delete ${certification.certificate_name}?`)) return;

    setError("");
    setMessage("");

    try {
      await deleteCoachCertification(certification.id);
      setCertifications((current) =>
        current.filter((item) => item.id !== certification.id)
      );
      if (editingCertificationId === certification.id) {
        resetCertificationForm();
      }
      setMessage("Certification deleted successfully.");
    } catch (deleteError) {
      setError(deleteError.message || "Failed to delete certification.");
    }
  };

  if (loading) {
    return (
      <Layout>
        <main className="coach-profile-page coach-profile-state-page">
          <section className="coach-profile-state-card" role="status" aria-live="polite">
            <div className="coach-profile-spinner" aria-hidden="true" />
            <h1>Loading coach profile</h1>
            <p>Loading profile details and assignments…</p>
          </section>
        </main>
      </Layout>
    );
  }

  if (error && !profile) {
    return (
      <Layout>
        <main className="coach-profile-page coach-profile-state-page">
          <section className="coach-profile-state-card" role="alert">
            <span className="coach-profile-eyebrow">Coach profile</span>
            <h1>Unable to load profile</h1>
            <p>{error}</p>
            <button type="button" className="coach-profile-secondary-button" onClick={loadProfile}>
              Try again
            </button>
          </section>
        </main>
      </Layout>
    );
  }

  return (
    <Layout>
      <main className="coach-profile-page">
        {error ? <div className="coach-profile-alert coach-profile-alert-error" role="alert">{error}</div> : null}
        {message ? <div className="coach-profile-alert coach-profile-alert-success" role="status" aria-live="polite">{message}</div> : null}

        <section className="coach-profile-hero">
          <div className="coach-profile-avatar">
            {profile?.profile_image ? (
              <img src={profile.profile_image} alt="" />
            ) : (
              <span aria-hidden="true">{getInitials(profile?.full_name)}</span>
            )}
          </div>
          <div className="coach-profile-identity">
            <span className="coach-profile-status">
              {profile?.is_active === false ? "Inactive" : "Active"}
            </span>
            <h2>{profile?.full_name || "Coach"}</h2>
            <p>{profile?.specialization || "Football Coach"}</p>
          </div>
          <div className="coach-profile-hero-actions">
            <button
              type="button"
              className="coach-profile-secondary-button"
              onClick={() => navigate(isSelf ? "/coach-dashboard" : "/coaches")}
            >
              ← Back
            </button>
            {canEditProfile && !editing ? (
              <button type="button" className="coach-profile-primary-button" onClick={() => setEditing(true)}>
                Edit Profile
              </button>
            ) : null}
          </div>
        </section>

        {editing && canEditProfile ? (
          <form className="coach-profile-card" onSubmit={handleSaveProfile}>
            <div className="coach-profile-card-heading">
              <div>
                <span className="coach-profile-section-kicker">Self service</span>
                <h2>Edit profile</h2>
              </div>
            </div>

            <div className="coach-profile-form-grid">
              <ProfileField label="Full name" name="full_name" value={form.full_name} onChange={handleChange} required />
              <ProfileField label="Email" name="email" type="email" value={form.email} onChange={handleChange} />
              <ProfileField label="Phone" name="phone" value={form.phone} onChange={handleChange} />
              <ProfileField label="Profile image URL" name="profile_image" value={form.profile_image} onChange={handleChange} />
              <ProfileField label="Specialization" name="specialization" value={form.specialization} onChange={handleChange} />
              <ProfileField label="Experience (years)" name="experience_years" type="number" min="0" step="1" value={form.experience_years} onChange={handleChange} />
              <ProfileField label="Joining date" name="joining_date" type="date" value={form.joining_date} onChange={handleChange} />
              <label className="coach-profile-field coach-profile-field-wide">
                <span>Bio</span>
                <textarea name="bio" value={form.bio} onChange={handleChange} rows="5" />
              </label>
            </div>

            <div className="coach-profile-form-actions">
              <button type="button" className="coach-profile-secondary-button" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="coach-profile-primary-button" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        ) : null}

        <div className="coach-profile-content-grid">
          <section className="coach-profile-card">
            <div className="coach-profile-card-heading">
              <div>
                <span className="coach-profile-section-kicker">Profile information</span>
                <h2>Personal details</h2>
              </div>
            </div>
            <div className="coach-profile-details-grid">
              <Detail label="Full name" value={profile?.full_name} />
              <Detail label="Email" value={profile?.email} />
              <Detail label="Phone" value={profile?.phone} />
              <Detail label="Specialization" value={profile?.specialization} />
              <Detail label="Experience" value={profile?.experience_years != null ? `${profile.experience_years} years` : null} />
              <Detail label="Joining date" value={formatDate(profile?.joining_date)} />
              <Detail label="Academy" value={profile?.academy?.academy_name} />
              <Detail label="Status" value={profile?.is_active === false ? "Inactive" : "Active"} />
            </div>
            {profile?.bio ? (
              <div className="coach-profile-bio">
                <span>About</span>
                <p>{profile.bio}</p>
              </div>
            ) : null}
          </section>

          <section className="coach-profile-card">
            <div className="coach-profile-card-heading">
              <div>
                <span className="coach-profile-section-kicker">Training scope</span>
                <h2>Centers & batches</h2>
              </div>
              <span className="coach-profile-count">{profile?.assignments?.length || 0} active batches</span>
            </div>

            {centers.length > 0 ? (
              <div className="coach-profile-center-list">
                {centers.map((center) => <span key={center.center_name}>{center.center_name}</span>)}
              </div>
            ) : (
              <p className="coach-profile-muted">No center assignment available.</p>
            )}

            <div className="coach-profile-assignment-list">
              {(profile?.assignments || []).length > 0 ? (
                profile.assignments.map((assignment) => (
                  <article key={assignment.id} className="coach-profile-assignment">
                    <div>
                      {assignment.batch?.id ? (
                        <a
                          className="coach-profile-assignment-link"
                          href={`/batches?academyId=${profile?.academy_id || ""}&centerId=${assignment.batch?.center_id || ""}&batchId=${assignment.batch.id}`}
                        >
                          {assignment.batch?.batch_name || "Batch"}
                        </a>
                      ) : (
                        <strong>{assignment.batch?.batch_name || "Batch"}</strong>
                      )}
                      <span>{assignment.center?.center_name || "Center not available"}</span>
                    </div>
                    <div className="coach-profile-assignment-meta">
                      <span>{assignment.batch?.age_group || "Age group not available"}</span>
                      <span>
                        {formatTime(assignment.batch?.start_time)} – {formatTime(assignment.batch?.end_time)}
                      </span>
                    </div>
                  </article>
                ))
              ) : (
                <p className="coach-profile-muted">No active batch assignments.</p>
              )}
            </div>
          </section>
        </div>

        {!isParent ? (
          <section className="coach-profile-card">
            <div className="coach-profile-card-heading">
              <div>
                <span className="coach-profile-section-kicker">Credentials</span>
                <h2>Certifications</h2>
              </div>
              <span className="coach-profile-count">{certifications.length}</span>
            </div>

            {canManageCertifications ? (
              <form className="coach-profile-cert-form" onSubmit={handleCertificationSubmit}>
                <ProfileField label="Certificate name" value={certificationForm.certificate_name} onChange={(e) => setCertificationForm((c) => ({ ...c, certificate_name: e.target.value }))} required />
                <ProfileField label="Issuing organization" value={certificationForm.issuing_organization} onChange={(e) => setCertificationForm((c) => ({ ...c, issuing_organization: e.target.value }))} />
                <ProfileField label="Certificate number" value={certificationForm.certificate_number} onChange={(e) => setCertificationForm((c) => ({ ...c, certificate_number: e.target.value }))} />
                <ProfileField label="Issue date" type="date" value={certificationForm.issue_date} onChange={(e) => setCertificationForm((c) => ({ ...c, issue_date: e.target.value }))} />
                <ProfileField label="Expiry date" type="date" value={certificationForm.expiry_date} onChange={(e) => setCertificationForm((c) => ({ ...c, expiry_date: e.target.value }))} />
                <div className="coach-profile-cert-actions">
                  <button type="submit" className="coach-profile-primary-button" disabled={certSaving}>
                    {certSaving ? "Saving…" : editingCertificationId ? "Update certification" : "Add certification"}
                  </button>
                  {editingCertificationId ? (
                    <button type="button" className="coach-profile-secondary-button" onClick={resetCertificationForm} disabled={certSaving}>
                      Cancel
                    </button>
                  ) : null}
                </div>
              </form>
            ) : null}

            {certifications.length > 0 ? (
              <div className="coach-profile-cert-list">
                {certifications.map((certification) => (
                  <article key={certification.id} className="coach-profile-cert-item">
                    <div>
                      <strong>{certification.certificate_name}</strong>
                      <span>{certification.issuing_organization || "Issuing organization not available"}</span>
                      {certification.certificate_number ? <small>#{certification.certificate_number}</small> : null}
                    </div>
                    <div className="coach-profile-cert-meta">
                      <span>Issued: {formatDate(certification.issue_date)}</span>
                      <span>Expiry: {formatDate(certification.expiry_date)}</span>
                      {canManageCertifications ? (
                        <div className="coach-profile-inline-actions">
                          <button type="button" className="coach-profile-secondary-button" onClick={() => startCertificationEdit(certification)}>Edit</button>
                          <button type="button" className="coach-profile-danger-button" onClick={() => handleCertificationDelete(certification)}>Delete</button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="coach-profile-muted">No certifications have been added yet.</p>
            )}
          </section>
        ) : null}
      </main>
    </Layout>
  );
};

const ProfileField = ({ label, name, type = "text", value, onChange, ...props }) => (
  <label className="coach-profile-field">
    <span>{label}</span>
    <input name={name} type={type} value={value ?? ""} onChange={onChange} {...props} />
  </label>
);

const Detail = ({ label, value }) => (
  <div className="coach-profile-detail">
    <span>{label}</span>
    <strong>{value || "Not available"}</strong>
  </div>
);

export default CoachProfile;
