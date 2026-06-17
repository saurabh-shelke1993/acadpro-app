import {
  BrowserRouter,
  Routes,
  Route,
  Navigate
} from "react-router-dom";

import ProtectedRoute from "../components/ProtectedRoute";

// ============================================
// PAGES
// ============================================

import Login from "../pages/Login";

import Dashboard from "../pages/Dashboard";
import Academy from "../pages/Academy";
import Centers from "../pages/Centers";
import Batches from "../pages/Batches";
import Players from "../pages/Players";
import Attendance from "../pages/Attendance";
import AttendanceHistory from "../pages/AttendanceHistory";
import SubscriptionPlans from "../pages/SubscriptionPlans";
import PlayerSubscriptions from "../pages/PlayerSubscriptions";
import PaymentDues from "../pages/PaymentDues";
import PaymentCollections from "../pages/PaymentCollections";
import Coaches from "../pages/Coaches";
import CoachBatchMapping from "../pages/CoachBatchMapping";

import CoachDashboard from "../pages/CoachDashboard";
import CoachAttendance from "../pages/CoachAttendance";

// ============================================
// APP ROUTES
// ============================================

function AppRoutes() {

  return (

    <BrowserRouter>

      <Routes>

        {/* ============================================
            DEFAULT
        ============================================ */}

        <Route
          path="/"
          element={<Navigate to="/login" replace />}
        />

        {/* ============================================
            LOGIN
        ============================================ */}

        <Route
          path="/login"
          element={<Login />}
        />

        {/* ============================================
            SUPER ADMIN + ACADEMY OWNER
        ============================================ */}

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute
              allowedRoles={[
                "super_admin",
                "academy_owner"
              ]}
            >
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/academy"
          element={
            <ProtectedRoute
              allowedRoles={[
                "super_admin"
              ]}
            >
              <Academy />
            </ProtectedRoute>
          }
        />

        <Route
          path="/centers"
          element={
            <ProtectedRoute
              allowedRoles={[
                "super_admin",
                "academy_owner"
              ]}
            >
              <Centers />
            </ProtectedRoute>
          }
        />

        <Route
          path="/batches"
          element={
            <ProtectedRoute
              allowedRoles={[
                "super_admin",
                "academy_owner"
              ]}
            >
              <Batches />
            </ProtectedRoute>
          }
        />

        <Route
          path="/players"
          element={
            <ProtectedRoute
              allowedRoles={[
                "super_admin",
                "academy_owner"
              ]}
            >
              <Players />
            </ProtectedRoute>
          }
        />

        <Route
          path="/attendance"
          element={
            <ProtectedRoute
              allowedRoles={[
                "super_admin",
                "academy_owner"
              ]}
            >
              <Attendance />
            </ProtectedRoute>
          }
        />

        <Route
          path="/attendance-history"
          element={
            <ProtectedRoute
              allowedRoles={[
                "super_admin",
                "academy_owner",
                "coach"
              ]}
            >
              <AttendanceHistory />
            </ProtectedRoute>
          }
        />

        <Route
          path="/subscription-plans"
          element={
            <ProtectedRoute
              allowedRoles={[
                "super_admin",
                "academy_owner"
              ]}
            >
              <SubscriptionPlans />
            </ProtectedRoute>
          }
        />

        <Route
          path="/player-subscriptions"
          element={
            <ProtectedRoute
              allowedRoles={[
                "super_admin",
                "academy_owner"
              ]}
            >
              <PlayerSubscriptions />
            </ProtectedRoute>
          }
        />

        <Route
          path="/payment-dues"
          element={
            <ProtectedRoute
              allowedRoles={[
                "super_admin",
                "academy_owner"
              ]}
            >
              <PaymentDues />
            </ProtectedRoute>
          }
        />

        <Route
          path="/payment-collections"
          element={
            <ProtectedRoute
              allowedRoles={[
                "super_admin",
                "academy_owner"
              ]}
            >
              <PaymentCollections />
            </ProtectedRoute>
          }
        />

        <Route
          path="/coaches"
          element={
            <ProtectedRoute
              allowedRoles={[
                "super_admin",
                "academy_owner"
              ]}
            >
              <Coaches />
            </ProtectedRoute>
          }
        />

        <Route
          path="/coach-batch-mapping"
          element={
            <ProtectedRoute
              allowedRoles={[
                "super_admin",
                "academy_owner"
              ]}
            >
              <CoachBatchMapping />
            </ProtectedRoute>
          }
        />

        {/* ============================================
            COACH MODULES
        ============================================ */}

        <Route
          path="/coach-dashboard"
          element={
            <ProtectedRoute
              allowedRoles={[
                "coach"
              ]}
            >
              <CoachDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/coach-attendance"
          element={
            <ProtectedRoute
              allowedRoles={[
                "coach"
              ]}
            >
              <CoachAttendance />
            </ProtectedRoute>
          }
        />

        {/* ============================================
            FALLBACK
        ============================================ */}

        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />

      </Routes>

    </BrowserRouter>
  );
}

export default AppRoutes;