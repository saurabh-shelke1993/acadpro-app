import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { getUserDashboard } from "../utils/auth";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleLogin = async (event) => {
    event.preventDefault();
    setMessage("");

    if (!email.trim() || !password) {
      setMessage("Enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;
      if (!data?.user) throw new Error("Unable to sign in. Please try again.");

      const { data: profileData, error: profileError } = await supabase
        .from("users")
        .select("*")
        .eq("id", data.user.id)
        .single();

      if (profileError) throw profileError;
      if (!profileData) throw new Error("Your user profile could not be found.");

      localStorage.setItem("acadpro_user", JSON.stringify(profileData));
      navigate(getUserDashboard(profileData));
    } catch (error) {
      console.error("Login failed:", error);
      setMessage(error.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.brandMark} aria-hidden="true">⚽</div>
        <h1 style={styles.title}>AcadPro</h1>
        <p style={styles.subtitle}>Sign in to your academy dashboard</p>

        <form onSubmit={handleLogin}>
          <label htmlFor="login-email" style={styles.label}>Email address</label>
          <input
            id="login-email"
            style={styles.input}
            type="email"
            autoComplete="username"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="login-password" style={styles.label}>Password</label>
          <input
            id="login-password"
            style={styles.input}
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {message && (
            <p role="alert" style={styles.error}>{message}</p>
          )}

          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={styles.parentLink}>
          Are you a parent? <a href="/parent">Open the Parent Portal</a>
        </p>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    boxSizing: "border-box",
    background: "linear-gradient(135deg, #eef4ff 0%, #f8fafc 100%)",
    fontFamily: "'Segoe UI', Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    padding: "36px",
    boxSizing: "border-box",
    borderRadius: "16px",
    background: "#ffffff",
    boxShadow: "0 12px 36px rgba(15, 23, 42, 0.12)",
  },
  brandMark: {
    width: "52px",
    height: "52px",
    display: "grid",
    placeItems: "center",
    borderRadius: "14px",
    background: "#e8f0ff",
    fontSize: "28px",
  },
  title: { margin: "18px 0 6px", color: "#172554", fontSize: "30px" },
  subtitle: { margin: "0 0 28px", color: "#64748b" },
  label: { display: "block", margin: "16px 0 7px", color: "#334155", fontWeight: 600 },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 13px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    fontSize: "15px",
  },
  error: {
    margin: "14px 0 0",
    padding: "10px 12px",
    borderRadius: "8px",
    background: "#fef2f2",
    color: "#b91c1c",
    fontSize: "14px",
  },
  button: {
    width: "100%",
    marginTop: "22px",
    padding: "13px",
    border: 0,
    borderRadius: "8px",
    background: "#1d4ed8",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: 600,
    cursor: "pointer",
  },
  parentLink: { margin: "24px 0 0", textAlign: "center", color: "#64748b", fontSize: "14px" },
};

export default Login;
