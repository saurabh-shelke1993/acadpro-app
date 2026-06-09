import {
  BrowserRouter,
  Routes,
  Route,
  Navigate
} from "react-router-dom";

import ProtectedRoute from "../components/ProtectedRoute";

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

function AppRoutes() {

  return (
    <BrowserRouter>

      <Routes>

        <Route
          path="/"
          element={<Navigate to="/login" />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/academy"
          element={
            <ProtectedRoute>
              <Academy />
            </ProtectedRoute>
          }
        />

        <Route
          path="/centers"
          element={
            <ProtectedRoute>
              <Centers />
            </ProtectedRoute>
          }
        />

        <Route
          path="/batches"
          element={
            <ProtectedRoute>
              <Batches />
            </ProtectedRoute>
          }
        />

        <Route
          path="/players"
          element={
            <ProtectedRoute>
              <Players />
            </ProtectedRoute>
          }
        />

        <Route
          path="/attendance"
          element={
            <ProtectedRoute>
              <Attendance />
            </ProtectedRoute>
          }
        />

        <Route
          path="/attendance-history"
          element={
            <ProtectedRoute>
              <AttendanceHistory />
            </ProtectedRoute>
          }
        />

        <Route
          path="/subscription-plans"
          element={
            <ProtectedRoute>
              <SubscriptionPlans />
            </ProtectedRoute>
          }
        />

        <Route
          path="/player-subscriptions"
          element={
            <ProtectedRoute>
              <PlayerSubscriptions />
            </ProtectedRoute>
          }
        />

        <Route
          path="/payment-dues"
          element={
            <ProtectedRoute>
              <PaymentDues />
            </ProtectedRoute>
          }
        />

        <Route
          path="/payment-collections"
          element={
            <ProtectedRoute>
              <PaymentCollections />
            </ProtectedRoute>
          }
        />

      </Routes>

    </BrowserRouter>
  );
}

export default AppRoutes;