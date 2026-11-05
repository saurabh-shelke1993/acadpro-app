import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getCurrentUser } from "../utils/auth";
import Attendance from "./Attendance";
import CoachAttendance from "./CoachAttendance";
import AttendanceHistory from "./AttendanceHistory";

const MANAGER_ROLES = new Set(["super_admin", "academy_owner", "coach"]);

/**
 * AM5: The canonical URL is /attendance?view=mark|history.
 * Existing pages still own their scoped fetches, writes and Layout.
 * Database/RLS authorization is unchanged and remains authoritative.
 */
export default function AttendanceWorkspace() {
  const location = useLocation();
  const [authState, setAuthState] = useState({ loading: true, user: null });

  useEffect(() => {
    let current = true;
    getCurrentUser()
      .then((user) => {
        if (current) setAuthState({ loading: false, user });
      })
      .catch((error) => {
        console.error("Attendance workspace could not load user scope:", error);
        if (current) setAuthState({ loading: false, user: null });
      });
    return () => { current = false; };
  }, []);

  if (authState.loading) {
    return <div className="app-route-loading" role="status" aria-live="polite">Loading attendance…</div>;
  }

  const role = authState.user?.role;
  if (!MANAGER_ROLES.has(role)) {
    return <Navigate to="/login" replace />;
  }

  const params = new URLSearchParams(location.search);
  const requestedView = params.get("view");
  const resolvedView = role === "super_admin"
    ? "history"
    : requestedView === "history" ? "history" : "mark";

  // Normalize direct links, unknown views and Super Admin Mark requests once.
  // Preserve centerId, batchId, scheduleId, date, any other query and hash.
  if (requestedView !== resolvedView) {
    params.set("view", resolvedView);
    return (
      <Navigate
        to={{ pathname: "/attendance", search: `?${params.toString()}`, hash: location.hash }}
        replace
      />
    );
  }

  if (resolvedView === "history") return <AttendanceHistory />;
  return role === "coach" ? <CoachAttendance /> : <Attendance />;
}

/**
 * AM5 compatibility for existing dashboards, bookmarks and shared URLs.
 * ProtectedRoute still evaluates the former route's role guards.
 */
export function LegacyAttendanceRedirect({ view }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set("view", view);
  return (
    <Navigate
      to={{ pathname: "/attendance", search: `?${params.toString()}`, hash: location.hash }}
      replace
    />
  );
}
