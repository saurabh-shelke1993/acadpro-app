import {
  useEffect,
  useState
}
from "react";

import {
  Navigate
}
from "react-router-dom";

import {
  getCurrentUser
}
from "../utils/auth";

function ProtectedRoute({

  children,

  allowedRoles = []

}) {

  const [loading,
    setLoading] =
    useState(true);

  const [user,
    setUser] =
    useState(null);

  // ============================================
  // LOAD USER
  // ============================================

  useEffect(() => {

    const loadUser =
      async () => {

        try {

          const currentUser =
            await getCurrentUser();

          setUser(currentUser);

        } catch (err) {

          console.log(err.message);

        } finally {

          setLoading(false);
        }
      };

    loadUser();

  }, []);

  // ============================================
  // LOADING
  // ============================================

  if (loading) {

    return (
      <div
        style={{
          padding: "40px"
        }}
      >
        Loading...
      </div>
    );
  }

  // ============================================
  // NOT LOGGED IN
  // ============================================

  if (!user) {

    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  // ============================================
  // ROLE CHECK
  // ============================================

  if (
    allowedRoles.length > 0 &&
    !allowedRoles.includes(
      user.role
    )
  ) {

    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  // ============================================
  // ALLOWED
  // ============================================

  return children;
}

export default ProtectedRoute;