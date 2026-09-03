import { supabase } from "../supabaseClient";
import { DEV_USERS } from "../utils/devUsers";

function DevToolbar() {
  const switchUser = async (email, password) => {
    try {
      // LOGOUT CURRENT USER
      await supabase.auth.signOut();

      // LOGIN NEW USER
      const { error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (error) throw error;

      // FETCH USER PROFILE
      const { data: profileData, error: profileError } =
        await supabase
          .from("users")
          .select("*")
          .eq("email", email)
          .single();

      if (profileError) {
        throw profileError;
      }

      // STORE CURRENT APP USER
      localStorage.setItem(
        "acadpro_user",
        JSON.stringify(profileData)
      );

      // REDIRECT BASED ON ROLE
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
        bottom: "12px",
        left: "50%",
        transform: "translateX(-50%)",

        display: "flex",
        alignItems: "center",
        gap: "6px",

        background: "#111827",
        padding: "7px 9px",
        borderRadius: "8px",

        zIndex: 9999,
        boxShadow: "0px 2px 10px rgba(0,0,0,0.25)",

        maxWidth: "calc(100vw - 20px)",
        overflowX: "auto",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          color: "white",
          fontSize: "12px",
          fontWeight: "600",
          marginRight: "3px",
        }}
      >
        DEV
      </span>

      {Object.values(DEV_USERS).map((user) => (
        <button
          key={user.email}
          onClick={() =>
            switchUser(user.email, user.password)
          }
          style={{
            padding: "5px 9px",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",

            background: "#ffffff",
            color: "#111827",

            fontSize: "12px",
            fontWeight: "500",

            whiteSpace: "nowrap",
          }}
        >
          {user.label}
        </button>
      ))}
    </div>
  );
}

export default DevToolbar;