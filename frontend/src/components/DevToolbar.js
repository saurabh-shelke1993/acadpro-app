import { supabase } from "../supabaseClient";
import { DEV_USERS } from "../utils/devUsers";

function DevToolbar() {

  const switchUser = async (email, password) => {
    try {

      // LOGOUT CURRENT USER
      await supabase.auth.signOut();

      // LOGIN NEW USER
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // REFRESH APP
      const { data: profileData } = await supabase
  .from("users")
  .select("*")
  .eq("email", email)
  .single();

localStorage.setItem(
  "acadpro_user",
  JSON.stringify(profileData)
);

if (profileData?.role === "coach") {
  window.location.href = "/coach-dashboard";
} else if (profileData?.role === "parent") {
  window.location.href = "/parent-portal";
} else {
  window.location.href = "/dashboard";
}

    } catch (err) {
      alert(err.message);
    }
  };

  // HIDE IN PRODUCTION
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        background: "#111827",
        padding: "15px",
        borderRadius: "10px",
        zIndex: 9999,
        boxShadow: "0px 0px 10px rgba(0,0,0,0.3)",
      }}
    >
      <h4 style={{ color: "white", marginBottom: "10px" }}>
        Dev Toolbar
      </h4>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {Object.values(DEV_USERS).map((user) => (
          <button
            key={user.role}
            onClick={() =>
              switchUser(user.email, user.password)
            }
            style={{
              padding: "8px",
              cursor: "pointer",
            }}
          >
            {user.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default DevToolbar;