import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function PlayerSubscriptions() {

  const [players, setPlayers] = useState([]);

  const [plans, setPlans] = useState([]);

  const [selectedPlayer, setSelectedPlayer] = useState("");

  const [selectedPlayerAcademy, setSelectedPlayerAcademy] = useState("");

  const [selectedPlan, setSelectedPlan] = useState("");

  const [startDate, setStartDate] = useState("");

  const [subscriptions, setSubscriptions] = useState([]);

  useEffect(() => {

    fetchPlayers();

    fetchPlans();

    fetchSubscriptions();

  }, []);

  const fetchPlayers = async () => {

    const { data, error } = await supabase
      .from("players")
      .select(`
        id,
        full_name,
        academy_id,

        academies (
          academy_name
        )
      `);

    if (error) {

      console.log(error);

    } else {

      setPlayers(data);

    }
  };

  const fetchPlans = async () => {

    const { data, error } = await supabase
      .from("subscription_plans")
      .select(`
        id,
        academy_id,
        plan_name,
        amount,

        academies (
          academy_name
        )
      `);

    if (error) {

      console.log(error);

    } else {

      setPlans(data);

    }
  };

  const fetchSubscriptions = async () => {

    const { data, error } = await supabase
      .from("player_subscriptions")
      .select(`
        id,
        start_date,
        status,

        players (
          full_name
        ),

        subscription_plans (
          plan_name,
          amount
        )
      `);

    if (error) {

      console.log(error);

    } else {

      setSubscriptions(data);

    }
  };

  const createSubscription = async () => {

    if (
      !selectedPlayer ||
      !selectedPlan ||
      !startDate
    ) {

      alert("Please fill all fields");

      return;
    }

    const { error } = await supabase
      .from("player_subscriptions")
      .insert([
        {
          player_id: selectedPlayer,

          subscription_plan_id: selectedPlan,

          start_date: startDate,

          status: "active"
        }
      ]);

    if (error) {

      alert(error.message);

    } else {

      alert(
        "Subscription Created Successfully"
      );

      setSelectedPlayer("");

      setSelectedPlayerAcademy("");

      setSelectedPlan("");

      setStartDate("");

      fetchSubscriptions();
    }
  };

  return (

    <div style={{ padding: "20px" }}>

      <h1>Player Subscriptions</h1>

      {/* Player Dropdown */}

      <select
        value={selectedPlayer}
        onChange={(e) => {

          const playerId =
            e.target.value;

          setSelectedPlayer(playerId);

          const selectedPlayerData =
            players.find(
              (player) =>
                player.id === playerId
            );

          if (selectedPlayerData) {

            setSelectedPlayerAcademy(
              selectedPlayerData.academy_id
            );
          }
        }}
      >

        <option value="">
          Select Player
        </option>

        {
          players.map((player) => (

            <option
              key={player.id}
              value={player.id}
            >

              {player.full_name}

              {" - "}

              {
                player.academies
                ?.academy_name
              }

            </option>

          ))
        }

      </select>

      <br />
      <br />

      {/* Plan Dropdown */}

      <select
        value={selectedPlan}
        onChange={(e) =>
          setSelectedPlan(
            e.target.value
          )
        }
      >

        <option value="">
          Select Plan
        </option>

        {
          plans
            .filter(
              (plan) =>
                plan.academy_id ===
                selectedPlayerAcademy
            )
            .map((plan) => (

              <option
                key={plan.id}
                value={plan.id}
              >

                {
                  plan.plan_name
                }

                {" - ₹"}

                {plan.amount}

                {" - "}

                {
                  plan.academies
                  ?.academy_name
                }

              </option>

            ))
        }

      </select>

      <br />
      <br />

      {/* Start Date */}

      <input
        type="date"
        value={startDate}
        onChange={(e) =>
          setStartDate(
            e.target.value
          )
        }
      />

      <br />
      <br />

      <button
        onClick={createSubscription}
      >
        Create Subscription
      </button>

      <hr />
      <br />

      <h2>Subscriptions List</h2>

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

            <th>Plan</th>

            <th>Amount</th>

            <th>Start Date</th>

            <th>Status</th>

          </tr>

        </thead>

        <tbody>

          {
            subscriptions.map(
              (subscription) => (

                <tr
                  key={subscription.id}
                >

                  <td>
                    {
                      subscription.players
                      ?.full_name
                    }
                  </td>

                  <td>
                    {
                      subscription
                      .subscription_plans
                      ?.plan_name
                    }
                  </td>

                  <td>
                    ₹
                    {
                      subscription
                      .subscription_plans
                      ?.amount
                    }
                  </td>

                  <td>
                    {
                      subscription
                      .start_date
                    }
                  </td>

                  <td>
                    {
                      subscription.status
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

export default PlayerSubscriptions;