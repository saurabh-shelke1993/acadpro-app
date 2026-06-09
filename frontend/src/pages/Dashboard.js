import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../services/supabase";

import {
  getLoggedInUser,
  isAcademyOwner,
  isSuperAdmin,
  logoutUser,
  getAcademyId,
} from "../utils/auth";

function Dashboard() {
  const navigate = useNavigate();

  const user = getLoggedInUser();
  const academyId = getAcademyId();

  const [players, setPlayers] = useState([]);
  const [academies, setAcademies] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paymentDues, setPaymentDues] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      let academyPlayers = [];

      // =========================
      // PLAYERS
      // =========================

      let playersQuery = supabase
        .from("players")
        .select("*");

      if (isAcademyOwner()) {
        playersQuery = playersQuery.eq(
          "academy_id",
          academyId
        );
      }

      const {
        data: playersData,
        error: playersError,
      } = await playersQuery;

      if (playersError) {
        console.error(playersError);
        return;
      }

      academyPlayers = playersData || [];

      setPlayers(academyPlayers);

      const playerIds = academyPlayers.map(
        (player) => player.id
      );

      // =========================
      // ACADEMIES
      // =========================

      if (isSuperAdmin()) {
        const { data: academiesData } =
          await supabase
            .from("academies")
            .select("*");

        setAcademies(academiesData || []);
      }

      // =========================
      // SUBSCRIPTIONS
      // =========================

      let subscriptionsQuery = supabase
        .from("player_subscriptions")
        .select("*");

      if (isAcademyOwner()) {
        subscriptionsQuery =
          subscriptionsQuery.in(
            "player_id",
            playerIds
          );
      }

      const {
        data: subscriptionsData,
        error: subscriptionsError,
      } = await subscriptionsQuery;

      if (subscriptionsError) {
        console.error(subscriptionsError);
      }

      setSubscriptions(subscriptionsData || []);

      // =========================
      // PAYMENTS
      // =========================

let paymentsQuery = supabase
  .from("payments")
  .select(`
    *,
    players(full_name)
  `);

      if (isAcademyOwner()) {
        paymentsQuery = paymentsQuery.in(
          "player_id",
          playerIds
        );
      }

      const {
        data: paymentsData,
        error: paymentsError,
      } = await paymentsQuery;

      if (paymentsError) {
        console.error(paymentsError);
      }

      setPayments(paymentsData || []);

      // =========================
      // PAYMENT DUES
      // =========================

      let duesQuery = supabase
        .from("payment_dues")
        .select(`
          *,
          players(full_name)
        `);

      if (isAcademyOwner()) {
        duesQuery = duesQuery.in(
          "player_id",
          playerIds
        );
      }

      const {
        data: duesData,
        error: duesError,
      } = await duesQuery;

      if (duesError) {
        console.error(duesError);
      }

      setPaymentDues(duesData || []);

    } catch (error) {
      console.error(error);
    }
  };

  const handleLogout = () => {
    logoutUser();
    navigate("/login");
  };

  const totalPendingAmount = paymentDues.reduce(
    (total, due) =>
      total + Number(due.remaining_amount || 0),
    0
  );

  const totalCollections = payments.reduce(
    (total, payment) =>
      total + Number(payment.amount_paid || 0),
    0
  );

  return (
    <div style={{ padding: "20px" }}>
      <h1>AcadPro Dashboard</h1>

      <button onClick={handleLogout}>
        Logout
      </button>

      <br />
      <br />

      <h2>
        Logged In: {user?.full_name}
      </h2>

      <h3>
        Role: {user?.role}
      </h3>

      {isAcademyOwner() && (
        <h3>
          Academy: {user?.academy_name}
        </h3>
      )}

      <br />

      <div
        style={{
          display: "flex",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        {/* Total Players */}
        <div
          style={{
            border: "1px solid black",
            padding: "20px",
            width: "220px",
          }}
        >
          <h2>Total Players</h2>
          <h1>{players.length}</h1>
        </div>

        {/* Total Academies */}
        {isSuperAdmin() && (
          <div
            style={{
              border: "1px solid black",
              padding: "20px",
              width: "220px",
            }}
          >
            <h2>Total Academies</h2>
            <h1>{academies.length}</h1>
          </div>
        )}

        {/* Subscriptions */}
        <div
          style={{
            border: "1px solid black",
            padding: "20px",
            width: "220px",
          }}
        >
          <h2>Subscriptions</h2>
          <h1>{subscriptions.length}</h1>
        </div>

        {/* Pending Amount */}
        <div
          style={{
            border: "1px solid black",
            padding: "20px",
            width: "220px",
          }}
        >
          <h2>Pending Amount</h2>
          <h1>₹{totalPendingAmount}</h1>
        </div>

        {/* Collections */}
        <div
          style={{
            border: "1px solid black",
            padding: "20px",
            width: "220px",
          }}
        >
          <h2>Total Collections</h2>
          <h1>₹{totalCollections}</h1>
        </div>
      </div>

      <br />
      <br />

      {/* Recent Payments */}
      <h1>Recent Payments</h1>

      <table
        border="1"
        cellPadding="10"
        width="100%"
      >
        <thead>
          <tr>
            <th>Player</th>
            <th>Amount</th>
            <th>Date</th>
          </tr>
        </thead>

        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td>{payment.players?.full_name}</td>
              <td>₹{payment.amount_paid}</td>
              <td>{payment.payment_date}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <br />
      <br />

      {/* Pending Dues */}
      <h1>Pending Dues</h1>

      <table
        border="1"
        cellPadding="10"
        width="100%"
      >
        <thead>
          <tr>
            <th>Player</th>
            <th>Remaining Amount</th>
          </tr>
        </thead>

        <tbody>
          {paymentDues.map((due) => (
            <tr key={due.id}>
              <td>
                {due.players?.full_name}
              </td>

              <td>
                ₹{due.remaining_amount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Dashboard;