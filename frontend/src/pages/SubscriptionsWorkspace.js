import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getCurrentUser } from "../utils/auth";
import PlayerSubscriptions from "./PlayerSubscriptions";
import SubscriptionPlans from "./SubscriptionPlans";

const MANAGER_ROLES = new Set(["super_admin", "academy_owner"]);

/**
 * SM2–SM3: route/view composition only.
 * The existing pages own their Layout, forms, reads and mutations independently.
 * ProtectedRoute and Supabase RLS remain the authorization boundaries.
 */
export default function SubscriptionsWorkspace() {
  const location = useLocation();
  const [auth, setAuth] = useState({ loading: true, user: null });

  useEffect(() => {
    let mounted = true;
    getCurrentUser()
      .then((user) => {
        if (mounted) setAuth({ loading: false, user });
      })
      .catch((error) => {
        console.error("Subscriptions workspace could not load user scope:", error);
        if (mounted) setAuth({ loading: false, user: null });
      });
    return () => { mounted = false; };
  }, []);

  if (auth.loading) {
    return <div className="app-route-loading" role="status" aria-live="polite">Loading subscriptions…</div>;
  }
  if (!MANAGER_ROLES.has(auth.user?.role)) {
    return <Navigate to="/login" replace />;
  }

  const params = new URLSearchParams(location.search);
  const requestedView = params.get("view");
  const resolvedView = requestedView === "plans" ? "plans" : "players";

  // Normalize missing/unsupported views, keeping other query params and hash.
  if (requestedView !== resolvedView) {
    params.set("view", resolvedView);
    return (
      <Navigate
        to={{ pathname: "/subscriptions", search: `?${params.toString()}`, hash: location.hash }}
        replace
      />
    );
  }
  return resolvedView === "plans" ? <SubscriptionPlans /> : <PlayerSubscriptions />;
}

/** Old bookmarks remain role-protected before redirecting. */
export function LegacySubscriptionsRedirect({ view }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set("view", view);
  return (
    <Navigate
      to={{ pathname: "/subscriptions", search: `?${params.toString()}`, hash: location.hash }}
      replace
    />
  );
}
