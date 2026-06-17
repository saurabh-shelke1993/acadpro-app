import { useState }
from "react";

import {
  useNavigate
}
from "react-router-dom";

import {
  supabase
}
from "../supabaseClient";

import {
  getUserDashboard
}
from "../utils/auth";

console.log("LOGIN COMPONENT RENDERED");

function Login() {

  const navigate =
    useNavigate();

  const [email,
    setEmail] =
    useState("");

  const [password,
    setPassword] =
    useState("");

  const [loading,
    setLoading] =
    useState(false);

  // ============================================
  // HANDLE USER SESSION
  // ============================================

  const handleUserSession =
    async (authUser) => {

      try {

        // FETCH USER PROFILE

        const {
          data: profileData,
          error: profileError
        } = await supabase
          .from("users")
          .select("*")
          .eq("id", authUser.id)
          .single();

        if (profileError) {

          alert(
            profileError.message
          );

          return;
        }

        // GET DASHBOARD ROUTE
const dashboardRoute =
  getUserDashboard(profileData);

console.log(
  "PROFILE DATA:",
  profileData
);

console.log(
  "DASHBOARD ROUTE:",
  dashboardRoute
);

localStorage.setItem(
  "acadpro_user",
  JSON.stringify(profileData)
);

navigate(dashboardRoute);


      } catch (err) {

        console.log(err.message);

        alert(
          "Login failed"
        );
      }
    };

  // ============================================
  // LOGIN USER
  // ============================================

  const loginUser =
    async (
      userEmail,
      userPassword
    ) => {

      try {

        setLoading(true);

        const {
          data,
          error
        } = await supabase
          .auth
          .signInWithPassword({

            email: userEmail,

            password:
              userPassword,

          });

        if (error) {

          alert(error.message);

          return;
        }

        if (!data?.user) {

          alert(
            "User not found"
          );

          return;
        }

        await handleUserSession(
          data.user
        );

      } catch (err) {

        console.log(err.message);

        alert(
          "Login failed"
        );

      } finally {

        setLoading(false);
      }
    };

  // ============================================
  // NORMAL LOGIN
  // ============================================

  const handleLogin =
    async () => {
      console.log("HANDLE LOGIN CALLED");
      if (
        !email ||
        !password
      ) {

        alert(
          "Please enter email and password"
        );

        return;
      }

      await loginUser(
        email,
        password
      );
    };

}

export default Login;