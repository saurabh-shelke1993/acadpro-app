import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function Dashboard() {

  const [totalPlayers, setTotalPlayers] = useState(0);

  const [totalAcademies, setTotalAcademies] = useState(0);

  const [totalSubscriptions, setTotalSubscriptions] = useState(0);

  const [pendingAmount, setPendingAmount] = useState(0);

  const [collectionsAmount, setCollectionsAmount] = useState(0);

  const [recentPayments, setRecentPayments] = useState([]);

  const [pendingDues, setPendingDues] = useState([]);

  useEffect(() => {

    fetchDashboardData();

  }, []);

  const fetchDashboardData = async () => {

    /* PLAYERS */

    const {
      count: playersCount
    } = await supabase
      .from("players")
      .select("*", {
        count: "exact",
        head: true
      });

    setTotalPlayers(playersCount || 0);

    /* ACADEMIES */

    const {
      count: academiesCount
    } = await supabase
      .from("academies")
      .select("*", {
        count: "exact",
        head: true
      });

    setTotalAcademies(
      academiesCount || 0
    );

    /* SUBSCRIPTIONS */

    const {
      count: subscriptionsCount
    } = await supabase
      .from("player_subscriptions")
      .select("*", {
        count: "exact",
        head: true
      });

    setTotalSubscriptions(
      subscriptionsCount || 0
    );

    /* PENDING DUES */

    const { data: duesData } =
      await supabase
        .from("payment_dues")
        .select(`
          remaining_amount,

          players (
            full_name
          )
        `);

    let pendingTotal = 0;

    duesData?.forEach((due) => {

      pendingTotal +=
        Number(
          due.remaining_amount || 0
        );
    });

    setPendingAmount(
      pendingTotal
    );

    setPendingDues(duesData || []);

    /* COLLECTIONS */

    const { data: paymentsData } =
      await supabase
        .from("payments")
        .select(`
          amount_paid,

          players (
            full_name
          ),

          payment_date
        `)
        .order("payment_date", {
          ascending: false
        });

    let collected = 0;

    paymentsData?.forEach(
      (payment) => {

        collected +=
          Number(
            payment.amount_paid || 0
          );
      }
    );

    setCollectionsAmount(
      collected
    );

    setRecentPayments(
      paymentsData || []
    );
  };

  return (

    <div style={{ padding: "20px" }}>

      <h1>AcadPro Dashboard</h1>

      {/* KPI CARDS */}

      <div
        style={{
          display: "flex",
          gap: "20px",
          flexWrap: "wrap",
          marginBottom: "30px"
        }}
      >

        <div
          style={{
            border: "1px solid black",
            padding: "20px",
            width: "200px"
          }}
        >

          <h3>Total Players</h3>

          <h2>{totalPlayers}</h2>

        </div>

        <div
          style={{
            border: "1px solid black",
            padding: "20px",
            width: "200px"
          }}
        >

          <h3>Total Academies</h3>

          <h2>{totalAcademies}</h2>

        </div>

        <div
          style={{
            border: "1px solid black",
            padding: "20px",
            width: "200px"
          }}
        >

          <h3>Subscriptions</h3>

          <h2>
            {totalSubscriptions}
          </h2>

        </div>

        <div
          style={{
            border: "1px solid black",
            padding: "20px",
            width: "200px"
          }}
        >

          <h3>Pending Amount</h3>

          <h2>
            ₹{pendingAmount}
          </h2>

        </div>

        <div
          style={{
            border: "1px solid black",
            padding: "20px",
            width: "200px"
          }}
        >

          <h3>Total Collections</h3>

          <h2>
            ₹{collectionsAmount}
          </h2>

        </div>

      </div>

      {/* RECENT PAYMENTS */}

      <h2>Recent Payments</h2>

      <table
        border="1"
        cellPadding="10"
        style={{
          borderCollapse: "collapse",
          width: "100%",
          marginBottom: "30px"
        }}
      >

        <thead>

          <tr>

            <th>Player</th>

            <th>Amount</th>

            <th>Date</th>

          </tr>

        </thead>

        <tbody>

          {
            recentPayments.map(
              (payment, index) => (

                <tr key={index}>

                  <td>
                    {
                      payment.players
                      ?.full_name
                    }
                  </td>

                  <td>
                    ₹
                    {
                      payment.amount_paid
                    }
                  </td>

                  <td>
                    {
                      payment.payment_date
                    }
                  </td>

                </tr>

              )
            )
          }

        </tbody>

      </table>

      {/* PENDING DUES */}

      <h2>Pending Dues</h2>

      <table
        border="1"
        cellPadding="10"
        style={{
          borderCollapse: "collapse",
          width: "100%"
        }}
      >

        <thead>

          <tr>

            <th>Player</th>

            <th>Remaining Amount</th>

          </tr>

        </thead>

        <tbody>

          {
            pendingDues.map(
              (due, index) => (

                <tr key={index}>

                  <td>
                    {
                      due.players
                      ?.full_name
                    }
                  </td>

                  <td>
                    ₹
                    {
                      due.remaining_amount
                    }
                  </td>

                </tr>

              )
            )
          }

        </tbody>

      </table>

    </div>
  );
}

export default Dashboard;