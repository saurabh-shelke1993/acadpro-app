import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import Layout from "../components/Layout";
import {
  getLoggedInUser,
  isSuperAdmin,
  getAcademyId
} from "../utils/auth";

function PlayerSubscriptions() {

  const [players, setPlayers] = useState([]);

const [academies, setAcademies] = useState([]);
const [centers, setCenters] = useState([]);
const [batches, setBatches] = useState([]);

const [selectedAcademy, setSelectedAcademy] = useState("");
const [selectedCenter, setSelectedCenter] = useState("");
const [selectedBatch, setSelectedBatch] = useState("");
const [loggedInUser, setLoggedInUser] = useState(null);

const [plans, setPlans] = useState([]);

const [subscriptions, setSubscriptions] = useState([]);

const [selectedPlayer, setSelectedPlayer] = useState("");

const [selectedPlan, setSelectedPlan] = useState("");

const [isEditing, setIsEditing] = useState(false);

const [editingSubscriptionId,
  setEditingSubscriptionId] = useState(null);

const [startDate, setStartDate] = useState(
  new Date().toISOString().split("T")[0]
);

useEffect(() => {
  fetchAcademies();
  fetchPlayers();
  fetchPlans();
  fetchSubscriptions();
}, []);

useEffect(() => {

  fetchPlayers();

}, [
  selectedAcademy,
  selectedCenter,
  selectedBatch
]);

useEffect(() => {
  loadUser();
}, []);

const loadUser = async () => {
  const user = await getLoggedInUser();
  console.log("SUBSCRIPTION USER =", user);
  setLoggedInUser(user);
};

useEffect(() => {

  if (loggedInUser) {
    fetchAcademies();
  }

}, [loggedInUser]);

useEffect(() => {

  if (selectedAcademy) {
    fetchCenters(selectedAcademy);
  }

}, [selectedAcademy]);

useEffect(() => {

  if (selectedCenter) {
    fetchBatches(selectedCenter);
  }

}, [selectedCenter]);

useEffect(() => {

  fetchSubscriptions();

}, [
  selectedAcademy,
  selectedCenter,
  selectedBatch,
  selectedPlayer
]);

const fetchAcademies = async () => {

  if (isSuperAdmin(loggedInUser)) {

    const { data } = await supabase
      .from("academies")
      .select("*")
      .eq("is_active", true);

    setAcademies(data || []);

  } else {

    const academyId = getAcademyId(loggedInUser);

    const { data } = await supabase
      .from("academies")
      .select("*")
      .eq("id", academyId);

    setAcademies(data || []);

    if (data?.length > 0) {
      setSelectedAcademy(data[0].id);
    }
  }
};

const fetchCenters = async (academyId) => {

  const { data } = await supabase
    .from("centers")
    .select("*")
    .eq("academy_id", academyId)
    .eq("is_active", true);

  setCenters(data || []);
};

const fetchBatches = async (centerId) => {

  const { data } = await supabase
    .from("batches")
    .select("*")
    .eq("center_id", centerId)
    .eq("is_active", true);

  setBatches(data || []);
};

const fetchPlayers = async () => {

  let query = supabase
    .from("players")
    .select(`
      id,
      full_name,
      academy_id,
      center_id,
      batch_id
    `)
    .eq("is_active", true);

  if (selectedAcademy) {
    query = query.eq("academy_id", selectedAcademy);
  }

  if (selectedCenter) {
    query = query.eq("center_id", selectedCenter);
  }

  if (selectedBatch) {
    query = query.eq("batch_id", selectedBatch);
  }

  const { data, error } = await query;

  if (error) {
    console.log(error);
  } else {
    setPlayers(data || []);
  }
};

const fetchPlans = async () => {

  let query = supabase
    .from("subscription_plans")
    .select(`
      id,
      academy_id,
      plan_name,
      amount
    `)
    .eq("is_active", true);

  if (selectedAcademy) {
    query = query.eq(
      "academy_id",
      selectedAcademy
    );
  }

  const { data, error } = await query;

  if (error) {
    console.log(error);
  } else {
    setPlans(data || []);
  }
};


const fetchSubscriptions = async () => {

  let query = supabase
    .from("player_subscriptions")
    .select(`
  id,
  player_id,
  subscription_plan_id,
  start_date,
  end_date,
  status,

      players (
        id,
        full_name,
        academy_id,
        center_id,
        batch_id,

        academies (
          academy_name
        ),

        centers (
          center_name
        ),

        batches (
          batch_name
        )
      ),

      subscription_plans (
        plan_name,
        amount
      )
    `)
    .eq("status", "active");

  const { data, error } = await query;

  if (error) {

    console.log(error);

  } else {

    let filteredData = data || [];

    if (selectedAcademy) {
      filteredData = filteredData.filter(
        (item) =>
          item.players?.academy_id === selectedAcademy
      );
    }

    if (selectedCenter) {
      filteredData = filteredData.filter(
        (item) =>
          item.players?.center_id === selectedCenter
      );
    }

    if (selectedBatch) {
      filteredData = filteredData.filter(
        (item) =>
          item.players?.batch_id === selectedBatch
      );
    }

    if (selectedPlayer) {
      filteredData = filteredData.filter(
        (item) =>
          item.players?.id === selectedPlayer
      );
    }

    setSubscriptions(filteredData);
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

    const { data: existingSubscription } =
  await supabase
    .from("player_subscriptions")
    .select("id")
    .eq("player_id", selectedPlayer)
    .eq("subscription_plan_id", selectedPlan)
    .eq("status", "active");

    if (existingSubscription?.length > 0) {
  alert(
    "Player already has this active subscription"
  );
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

      setSelectedPlan("");

      setStartDate("");

      fetchSubscriptions();
    }
  };

const handleEditSubscription = (
  subscription
) => {

  setIsEditing(true);

  setEditingSubscriptionId(
    subscription.id
  );

  setSelectedPlayer(
    subscription.player_id
  );

  setSelectedPlan(
    subscription.subscription_plan_id
  );

  setStartDate(
    subscription.start_date
  );
};
  
const handleUpdateSubscription = async () => {

  const { error } = await supabase
    .from("player_subscriptions")
    .update({
      player_id: selectedPlayer,
      subscription_plan_id:
        selectedPlan,
      start_date: startDate
    })
    .eq(
      "id",
      editingSubscriptionId
    );

  if (error) {

    alert(error.message);

  } else {

    alert(
      "Subscription Updated Successfully"
    );

    setIsEditing(false);

    setEditingSubscriptionId(null);

    setSelectedPlayer("");

    setSelectedPlan("");

    setStartDate("");

    fetchSubscriptions();
  }
};

const handleDeactivateSubscription =
  async (id) => {

    const confirmed =
      window.confirm(
        "Deactivate this subscription?"
      );

    if (!confirmed) return;

    const { error } =
      await supabase
        .from(
          "player_subscriptions"
        )
        .update({
          status: "inactive"
        })
        .eq("id", id);

    if (error) {

      alert(error.message);

    } else {

      alert(
        "Subscription Deactivated"
      );

      fetchSubscriptions();
    }
};

return (
  <Layout>
    <div style={{ padding: "20px" }}>
      <h1>Player Subscriptions</h1>
{/* Academy */}

{isSuperAdmin(loggedInUser) && (

  <>
    <select
      value={selectedAcademy}
      onChange={(e) =>
        setSelectedAcademy(
          e.target.value
        )
      }
    >

      <option value="">
        Select Academy
      </option>

      {academies.map((academy) => (

        <option
          key={academy.id}
          value={academy.id}
        >

          {academy.academy_name}

        </option>

      ))}

    </select>

    <br />
    <br />
  </>

)}

{/* Center */}

<select
  value={selectedCenter}
  onChange={(e) =>
    setSelectedCenter(
      e.target.value
    )
  }
>

  <option value="">
    Select Center
  </option>

  {centers.map((center) => (

    <option
      key={center.id}
      value={center.id}
    >

      {center.center_name}

    </option>

  ))}

</select>

<br />
<br />

{/* Batch */}

<select
  value={selectedBatch}
  onChange={(e) =>
    setSelectedBatch(
      e.target.value
    )
  }
>

  <option value="">
    Select Batch
  </option>

  {batches.map((batch) => (

    <option
      key={batch.id}
      value={batch.id}
    >

      {batch.batch_name}

    </option>

  ))}

</select>

<br />
<br />

      {/* Player Dropdown */}

      <select
        value={selectedPlayer}
        onChange={(e) => {

          const playerId =
            e.target.value;

          setSelectedPlayer(playerId);

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

{isEditing ? (

  <button
    onClick={
      handleUpdateSubscription
    }
  >
    Update Subscription
  </button>

) : (

  <button
    onClick={createSubscription}
  >
    Create Subscription
  </button>

)}

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

  {isSuperAdmin(loggedInUser) && (
    <th>Academy</th>
  )}

  <th>Center</th>

  <th>Batch</th>

  <th>Player</th>

  <th>Plan</th>

  <th>Amount</th>

  <th>Start Date</th>

  <th>End Date</th>

  <th>Status</th>

  <th>Actions</th>

</tr>
        </thead>

        <tbody>

          {
            subscriptions.map(
              (subscription) => (

<tr
  key={subscription.id}
>

  {isSuperAdmin(loggedInUser) && (
    <td>
      {
        subscription.players
          ?.academies
          ?.academy_name
      }
    </td>
  )}

  <td>
    {
      subscription.players
        ?.centers
        ?.center_name
    }
  </td>

  <td>
    {
      subscription.players
        ?.batches
        ?.batch_name
    }
  </td>

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

                  <td>{subscription.end_date || "-"}</td>

                  <td>
                    {
                      subscription.status
                    }
                  </td>

                  <td>

  <button
    onClick={() =>
      handleEditSubscription(
        subscription
      )
    }
  >
    Edit
  </button>

  <button
    onClick={() =>
      handleDeactivateSubscription(
        subscription.id
      )
    }
    style={{
      marginLeft: "10px"
    }}
  >
    Deactivate
  </button>

</td>

                </tr>

              )
            )
          }

        </tbody>

      </table>

    </div>
  </Layout>
);
}

export default PlayerSubscriptions;