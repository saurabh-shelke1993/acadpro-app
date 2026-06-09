import React from "react";
import Centers from "../pages/Centers";
import Batches from "../pages/Batches";
import Players from "../pages/Players";
import Attendance from "../pages/Attendance";
import AttendanceHistory from "../pages/AttendanceHistory";
import SubscriptionPlans from "../pages/SubscriptionPlans";
import PlayerSubscriptions from "../pages/PlayerSubscriptions";
import PaymentDues from "../pages/PaymentDues";
import PaymentCollections from "../pages/PaymentCollections";
import Dashboard from "../pages/Dashboard";
import {
  BrowserRouter,
  Routes,
  Route
} from "react-router-dom";

import Academy from "../pages/Academy";

const Home = () => {
  return <h1>HOME ROUTE WORKING</h1>;
};

const AppRoutes = () => {
  return (
    <BrowserRouter>
<Routes>

  <Route path="/" element={<Home />} />
  <Route path="/academy" element={<Academy />} />
  <Route path="/centers" element={<Centers />} />
  <Route path="/batches" element={<Batches />} />
  <Route path="/players" element={<Players />} />
  <Route path="/attendance" element={<Attendance />} />
  <Route path="/attendance-history" element={<AttendanceHistory />} />
  <Route path="/subscription-plans" element={<SubscriptionPlans />} />
  <Route path="/player-subscriptions" element={<PlayerSubscriptions />} />
  <Route path="/payment-dues" element={<PaymentDues />} />
  <Route path="/payment-collections" element={<PaymentCollections />} />
  <Route
  path="/dashboard"
  element={<Dashboard />}
/>

</Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;