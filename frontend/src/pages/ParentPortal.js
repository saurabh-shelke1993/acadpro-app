import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { logoutUser } from "../utils/auth";

const ParentPortal = () => {
  const [parent, setParent] = useState(null);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadParentPortal = async () => {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: sessionError,
      } = await supabase.auth.getUser();

      if (sessionError || !user) {
        if (mounted) {
          setError("Your session could not be verified. Please sign in again.");
          setLoading(false);
        }
        return;
      }

      const { data: parentRecord, error: parentError } = await supabase
        .from("parents")
        .select("id, parent_name, email, user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (parentError) {
        if (mounted) {
          setError("We could not load your parent profile.");
          setLoading(false);
        }
        return;
      }

      if (!parentRecord) {
        if (mounted) {
          setError(
            "No parent profile is linked to this login. Please contact your academy administrator."
          );
          setLoading(false);
        }
        return;
      }

      const { data: childRecords, error: childrenError } = await supabase
        .from("players")
        .select("id, full_name, dob, player_status")
        .eq("parent_id", parentRecord.id)
        .order("full_name", { ascending: true });

      if (childrenError) {
        if (mounted) {
          setError("We could not load your linked children.");
          setLoading(false);
        }
        return;
      }

      if (mounted) {
        setParent(parentRecord);
        setChildren(childRecords || []);
        setLoading(false);
      }
    };

    loadParentPortal();

    return () => {
      mounted = false;
    };
  }, []);

const handleLogout = async () => {
  await logoutUser();
};

  if (loading) {
    return <main style={styles.container}>Loading your parent portal…</main>;
  }

  return (
    <main style={styles.container}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Parent Portal</h1>
          <p style={styles.subtitle}>
            {parent ? `Welcome, ${parent.parent_name || "Parent"}` : "AcadPro"}
          </p>
        </div>
        <button type="button" onClick={handleLogout} style={styles.logoutButton}>
          Sign out
        </button>
      </header>

      {error ? (
        <section role="alert" style={styles.card}>
          <h2 style={styles.sectionTitle}>Unable to load portal</h2>
          <p style={styles.message}>{error}</p>
        </section>
      ) : children.length === 0 ? (
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>No linked children yet</h2>
          <p style={styles.message}>
            Your login is valid, but no player profile is currently linked to it.
            Please contact your academy administrator.
          </p>
        </section>
      ) : (
        <section>
          <h2 style={styles.sectionTitle}>Your children</h2>
          <div style={styles.grid}>
            {children.map((child) => (
              <article key={child.id} style={styles.card}>
                <div style={styles.avatar} aria-hidden="true">
                  {(child.full_name || "?").charAt(0).toUpperCase()}
                </div>
                <h3 style={styles.childName}>{child.full_name}</h3>
                {child.dob && <p style={styles.detail}>Date of birth: {child.dob}</p>}
                {child.player_status && (
                  <p style={styles.detail}>Status: {child.player_status}</p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
};

const styles = {
  container: {
    maxWidth: "1000px",
    margin: "0 auto",
    padding: "32px 20px",
    fontFamily: "Arial, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "28px",
  },
  title: { margin: 0, fontSize: "30px" },
  subtitle: { margin: "6px 0 0", color: "#666" },
  logoutButton: {
    padding: "10px 16px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    background: "white",
    cursor: "pointer",
  },
  sectionTitle: { margin: "0 0 16px", fontSize: "22px" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
  },
  card: {
    padding: "24px",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    background: "#fff",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  },
  avatar: {
    width: "52px",
    height: "52px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#e8f0fe",
    color: "#1a73e8",
    fontSize: "24px",
    fontWeight: "bold",
    marginBottom: "14px",
  },
  childName: { margin: "0 0 12px", fontSize: "20px" },
  detail: { margin: "6px 0", color: "#555" },
  message: { margin: 0, color: "#555", lineHeight: 1.5 },
};

export default ParentPortal;
