import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { getUserDashboard } from "../utils/auth";
import "../styles/login.css";

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
    <main className="login-page">
      <section className="login-story" aria-label="Kheltriva introduction">
        <div className="login-story-brand">
          <img src="/assets/kheltriva-logo.svg" alt="Kheltriva — Football Academy Management Platform" />
        </div>

        <div className="login-story-copy">
          <p className="login-eyebrow">One platform. Every part of the game.</p>
          <h2>Build a stronger academy, on and off the pitch.</h2>
          <p>Bring players, coaches, training schedules, attendance, and academy finances together in one place.</p>
        </div>

        <p className="login-story-footer">Made for the people who make football happen.</p>
      </section>

      <section className="login-form-panel" aria-label="Sign in">
        <div className="login-card">
          <div className="login-card-brand">
            <img src="/assets/kheltriva-logo.svg" alt="Kheltriva — Football Academy Management Platform" />
          </div>

          <h1>Welcome back</h1>
          <p className="login-card-intro">Sign in to continue to your academy workspace.</p>

          <form onSubmit={handleLogin}>
            <label htmlFor="login-email" className="login-field">Email address</label>
            <input
              id="login-email"
              className="login-input"
              type="email"
              autoComplete="username"
              placeholder="Enter your email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <label htmlFor="login-password" className="login-field">Password</label>
            <input
              id="login-password"
              className="login-input"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />

            {message && <p role="alert" className="login-error">{message}</p>}

            <button className="login-submit" type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="login-parent-link">
            Are you a parent? <a href="/parent">Open the Parent Portal</a>
          </p>
        </div>
      </section>
    </main>
  );
}

export default Login;
