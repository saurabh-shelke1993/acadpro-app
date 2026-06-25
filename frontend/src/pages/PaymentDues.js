import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import Layout from "../components/Layout";
import {
  getLoggedInUser,
  isSuperAdmin
} from "../utils/auth";

function PaymentDues() {

  const [academies, setAcademies] = useState([]);
const [centers, setCenters] = useState([]);
const [batches, setBatches] = useState([]);
const [players, setPlayers] = useState([]);

const [selectedAcademy, setSelectedAcademy] = useState("");
const [selectedCenter, setSelectedCenter] = useState("");
const [selectedBatch, setSelectedBatch] = useState("");
const [selectedPlayer, setSelectedPlayer] = useState("");
  const [subscriptions, setSubscriptions] = useState([]);

  const [selectedSubscription, setSelectedSubscription] = useState("");

  const [selectedSubscriptionData, setSelectedSubscriptionData] = useState(null);

  const [dueType, setDueType] = useState("");

  const [dueDate, setDueDate] = useState("");

  const [duesList, setDuesList] = useState([]);

  const [editingDue, setEditingDue] =
  useState(null);

const [editDueDate, setEditDueDate] =
  useState("");

const [editDueType, setEditDueType] =
  useState("");

const [statusFilter, setStatusFilter] =
  useState("");

 const [loggedInUser, setLoggedInUser] =
  useState(null); 

useEffect(() => {
  fetchAcademies();
  fetchPaymentDues();

},[
  statusFilter,
  selectedAcademy,
  selectedCenter,
  selectedBatch,
  selectedPlayer
]);

useEffect(() => {

  if (selectedAcademy) {

    fetchCenters(selectedAcademy);

  } else {

    setCenters([]);
    setSelectedCenter("");

  }

}, [selectedAcademy]);

useEffect(() => {

  if (selectedCenter) {

    fetchBatches(selectedCenter);

  } else {

    setBatches([]);
    setSelectedBatch("");

  }

}, [selectedCenter]);

useEffect(() => {

  if (selectedBatch) {

    fetchPlayers(selectedBatch);

  } else {

    setPlayers([]);
    setSelectedPlayer("");

  }

}, [selectedBatch]);

useEffect(() => {

  if (selectedPlayer) {

    fetchSubscriptionsByPlayer(
      selectedPlayer
    );

  } else {

    setSubscriptions([]);

    setSelectedSubscription("");

    setSelectedSubscriptionData(
      null
    );

  }

}, [selectedPlayer]);

useEffect(() => {

  fetchLoggedInUser();

}, []);

useEffect(() => {

  if (!loggedInUser) return;

  fetchAcademies();

  fetchPaymentDues();

}, [
  loggedInUser,
  statusFilter,
  selectedAcademy,
  selectedCenter,
  selectedBatch,
  selectedPlayer
]);

  const fetchSubscriptions = async () => {

    const { data, error } = await supabase
      .from("player_subscriptions")
      .select(`
  id,
  player_id,

  players (
    full_name
  ),

  subscription_plans (
    plan_name,
    amount
  )
`)

    if (error) {

      console.log(error);

    } else {

      setSubscriptions(data);

    }
  };

  const fetchLoggedInUser =
async () => {

  const user =
    await getLoggedInUser();

  setLoggedInUser(user);

};

  const fetchAcademies =
async () => {

  if (!loggedInUser)
    return;
let query =
  supabase
    .from("academies")
    .select("id, academy_name");

if (
  loggedInUser &&
  !isSuperAdmin(loggedInUser)
) {

  query =
    query.eq(
      "id",
      loggedInUser.academy_id
    );

}

const {
  data,
  error
} = await query.order(
  "academy_name"
);

  if (error) {

    console.log(error);

  } else {

    setAcademies(data);

  }
};

const fetchCenters = async (academyId) => {

  const { data, error } = await supabase
    .from("centers")
    .select("id, center_name")
    .eq("academy_id", academyId)
    .order("center_name");

  if (error) {

    console.log(error);

  } else {

    setCenters(data);

  }
};

const fetchBatches = async (centerId) => {

  const { data, error } = await supabase
    .from("batches")
    .select("id, batch_name")
    .eq("center_id", centerId)
    .order("batch_name");

  if (error) {

    console.log(error);

  } else {

    setBatches(data);

  }
};

const fetchPlayers = async (batchId) => {

  const { data, error } = await supabase
    .from("players")
    .select(`
      id,
      full_name
    `)
    .eq("batch_id", batchId)
    .order("full_name");

  if (error) {

    console.log(error);

  } else {

    setPlayers(data);

  }
};


const fetchSubscriptionsByPlayer = async (
  playerId
) => {

  const { data, error } =
    await supabase
      .from("player_subscriptions")
      .select(`
        id,
        player_id,

        players (
          full_name
        ),

        subscription_plans (
          plan_name,
          amount
        )
      `)
      .eq("player_id", playerId);

  if (error) {

    console.log(error);

  } else {

    setSubscriptions(data);

  }
};


const fetchPaymentDues = async (
  playerId = null
) => {

  let query = supabase
    .from("payment_dues")
    .select(`
      id,
      due_type,
      due_date,
      total_amount,
      paid_amount,
      remaining_amount,
    due_status,

player_subscriptions (
  subscription_plans (
    plan_name
  )
),

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
)
    `);

  if (playerId) {

    query = query.eq(
      "player_id",
      playerId
    );

}

  const { data, error } =
    await query.order(
      "due_date",
      {
        ascending: false
      }
    );

  if (error) {

    console.log(error);

  } else {
 let filteredData = data || [];

 if (loggedInUser) {

  if (isSuperAdmin(loggedInUser)) {

    if (selectedAcademy) {

      filteredData =
        filteredData.filter(
          due =>
            due.players?.academy_id ===
            selectedAcademy
        );

    }

  } else {

    filteredData =
      filteredData.filter(
        due =>
          due.players?.academy_id ===
          loggedInUser.academy_id
      );

  }

}


if (selectedCenter) {

  filteredData = filteredData.filter(
    (due) =>
      due.players?.center_id ===
      selectedCenter
  );

}

if (selectedBatch) {

  filteredData = filteredData.filter(
    (due) =>
      due.players?.batch_id ===
      selectedBatch
  );

}

if (selectedPlayer) {

  filteredData = filteredData.filter(
    (due) =>
      due.players?.id ===
      selectedPlayer
  );

}

console.log(
  "STATUS FILTER:",
  statusFilter
);

if (statusFilter) {

  filteredData =
    filteredData.filter(
      (due) =>
        due.due_status ===
        statusFilter.toLowerCase()
    );
console.log(
  "FILTERED DATA:",
  filteredData
);
}

   setDuesList(filteredData);

  }

};

  const createPaymentDue = async () => {

    if (
      !selectedSubscription ||
      !dueType ||
      !dueDate
    ) {

      alert("Please fill all fields");

      return;
    }

    const playerId =
      selectedSubscriptionData.player_id;

    const amount =
      selectedSubscriptionData
      .subscription_plans.amount;

      const { data: existingDue } =
  await supabase
    .from("payment_dues")
    .select("id")
    .eq(
      "subscription_id",
      selectedSubscription
    )
    .eq(
      "due_date",
      dueDate
    );

    if (
  existingDue &&
  existingDue.length > 0
) {

  alert(
    "Due already exists for this subscription"
  );

  return;
}

    const { error } = await supabase
      .from("payment_dues")
      .insert([
        {
          player_id: playerId,

          subscription_id:
            selectedSubscription,

          due_type: dueType,

          due_date: dueDate,

          total_amount: amount,

          paid_amount: 0,

          due_status: "pending"
        }
      ]);

    if (error) {

      alert(error.message);

    } else {

      alert(
        "Payment Due Generated Successfully"
      );

setSelectedAcademy("");
setSelectedCenter("");
setSelectedBatch("");
setSelectedPlayer("");

setSubscriptions([]);
setSelectedSubscription("");
setSelectedSubscriptionData(null);

setDueType("");
setDueDate("");

fetchPaymentDues();
    }
  };

const recordPayment = async (due) => {

  const amountPaid = prompt(
    `Enter payment amount (Remaining ₹${due.remaining_amount})`
  );

  if (!amountPaid) return;

  const paymentValue = Number(amountPaid);

  if (
    isNaN(paymentValue) ||
    paymentValue <= 0
  ) {
    alert("Invalid amount");
    return;
  }

  const newPaidAmount =
    Number(due.paid_amount || 0) +
    paymentValue;

  const newRemainingAmount =
    Number(due.total_amount) -
    newPaidAmount;

  let newStatus = "pending";

  if (newRemainingAmount <= 0) {

    newStatus = "paid";

  } else if (
    newPaidAmount > 0
  ) {

    newStatus = "partial";

  }

const { error } = await supabase
  .from("payment_dues")
  .update({
    paid_amount: newPaidAmount,
    due_status: newStatus
  })
  .eq("id", due.id);

  if (error) {

    console.log(error);
    alert(error.message);
console.log(error);

  } else {

    fetchPaymentDues();

  }
};


const markAsPaid = async (
  dueId
) => {

  const due =
    duesList.find(
      d => d.id === dueId
    );

  if (!due) return;

  const { error } =
    await supabase
      .from("payment_dues")
      .update({
        paid_amount:
          due.total_amount,

        due_status:
          "paid"
      })
      .eq(
        "id",
        dueId
      );

  if (error) {

    alert(error.message);

  } else {

    alert(
      "Payment marked as paid"
    );

    fetchPaymentDues();
  }
};

const startEdit = (due) => {

  setEditingDue(due);

  setEditDueDate(
    due.due_date
  );

  setEditDueType(
    due.due_type
  );

};

const saveEdit = async () => {

  const { error } =
    await supabase
      .from("payment_dues")
      .update({

        due_date:
          editDueDate,

        due_type:
          editDueType

      })
      .eq(
        "id",
        editingDue.id
      );

  if (error) {

    alert(error.message);

  } else {

    setEditingDue(null);

    fetchPaymentDues();

  }

};

const deleteDue = async (due) => {

  const confirmDelete =
    window.confirm(
      "Are you sure you want to delete this due?"
    );

if (!confirmDelete) return;

if (
  Number(due.paid_amount) > 0
) {
  alert(
    "Cannot delete a due that already has payments recorded."
  );
  return;
}

  const { error } =
    await supabase
      .from("payment_dues")
      .delete()
      .eq("id", due.id);

  if (error) {

    console.log(error);

    alert("Failed to delete due");

  } else {

    alert("Due deleted successfully");

    fetchPaymentDues();
  }
};

return (
  <Layout>
    <div style={{ padding: "20px" }}>
      <h1>Payment Dues</h1>
      {/* Academy */}

<select
  value={selectedAcademy}
  onChange={(e) =>
    setSelectedAcademy(e.target.value)
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

{/* Center */}

<select
  value={selectedCenter}
  onChange={(e) =>
    setSelectedCenter(e.target.value)
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
    setSelectedBatch(e.target.value)
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

{/* Player */}

<select
  value={selectedPlayer}
  onChange={(e) =>
    setSelectedPlayer(e.target.value)
  }
>
  <option value="">
    Select Player
  </option>

  {players.map((player) => (
    <option
      key={player.id}
      value={player.id}
    >
      {player.full_name}
    </option>
  ))}
</select>

<br />
<br />
      {/* Subscription Dropdown */}

      <select
        value={selectedSubscription}
        onChange={(e) => {

          const subscriptionId =
            e.target.value;

          setSelectedSubscription(
            subscriptionId
          );

          const selectedData =
            subscriptions.find(
              (subscription) =>
                subscription.id ===
                subscriptionId
            );

          setSelectedSubscriptionData(
            selectedData
          );
        }}
      >

        <option value="">
          Select Subscription
        </option>

        {
          subscriptions.map(
            (subscription) => (

              <option
                key={subscription.id}
                value={subscription.id}
              >

                {
                  subscription.players
                  ?.full_name
                }

                {" - "}

                {
                  subscription
                  .subscription_plans
                  ?.plan_name
                }

                {" - ₹"}

                {
                  subscription
                  .subscription_plans
                  ?.amount
                }

              </option>

            )
          )
        }

      </select>

      <br />
      <br />

      {/* Due Type */}

<select
  value={dueType}
  onChange={(e) =>
    setDueType(e.target.value)
  }
>
  <option value="">
    Select Due Type
  </option>

  <option value="monthly">
    Monthly
  </option>

  <option value="quarterly">
    Quarterly
  </option>

  <option value="registration">
    Registration
  </option>
</select>

      <br />
      <br />

      {/* Due Date */}

      <input
        type="date"
        value={dueDate}
        onChange={(e) =>
          setDueDate(
            e.target.value
          )
        }
      />

      <br />
      <br />

      <button
        onClick={createPaymentDue}
      >
        Generate Due
      </button>

      <hr />
      <br />
      
      
   <h2>Payment Dues List</h2>

<div style={{ marginBottom: "10px" }}>

  <select
    value={statusFilter}
    onChange={(e) =>
      setStatusFilter(e.target.value)
    }
  >

    <option value="">
      All Statuses
    </option>

    <option value="pending">
      Pending
    </option>

    <option value="partial">
      Partial
    </option>

    <option value="paid">
      Paid
    </option>

  </select>

</div>

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

<th>Academy</th>

<th>Center</th>

<th>Player</th>

<th>Plan</th>

<th>Due Type</th>

            <th>Due Date</th>

            <th>Total Amount</th>

            <th>Paid Amount</th>

            <th>Remaining Amount</th>

            <th>Status</th>

            <th>Actions</th>

          </tr>

        </thead>

        <tbody>

          {
            duesList.map((due) => (

  <tr key={due.id}>

<td>{due.players?.academies?.academy_name}</td>

<td>{due.players?.centers?.center_name}</td>

<td>{due.players?.batches?.batch_name}</td>

<td>{due.players?.full_name}</td>

<td>
  {
    due.player_subscriptions
      ?.subscription_plans
      ?.plan_name
  }
</td>

<td>{due.due_type}</td>


<td>{due.due_date}</td>

<td>₹ {due.total_amount}</td>

<td>₹ {due.paid_amount}</td>

<td>₹ {due.remaining_amount}</td>

<td>

  {due.due_status === "paid" && "✅ Paid"}

  {due.due_status === "partial" && "🟡 Partial"}

  {due.due_status === "pending" && "🔴 Pending"}

</td>

<td>

{due.due_status !== "paid" && (

  <button
    onClick={() =>
      recordPayment(due)
    }
  >
    Record Payment
  </button>

)}
  
  <button
    onClick={() =>
      startEdit(due)
    }
  >
    Edit
  </button>

  <button
  onClick={() =>
    deleteDue(due)
  }
>
  Delete
</button>

</td>

              </tr>

            ))
          }

        </tbody>

      </table>

    </div>
    {editingDue && (

  <div
    style={{
      position: "fixed",
      top: "30%",
      left: "40%",
      background: "white",
      padding: "20px",
      border: "1px solid black",
      zIndex: 9999
    }}
  >

    <h3>Edit Due</h3>

    <div>

      <label>Due Date</label>

      <br />

      <input
        type="date"
        value={editDueDate}
        onChange={(e) =>
          setEditDueDate(
            e.target.value
          )
        }
      />

    </div>

    <br />

    <div>

      <label>Due Type</label>

      <br />

      <select
        value={editDueType}
        onChange={(e) =>
          setEditDueType(
            e.target.value
          )
        }
      >
        <option value="monthly">
          Monthly
        </option>

        <option value="quarterly">
          Quarterly
        </option>

        <option value="registration">
          Registration
        </option>

      </select>

    </div>

    <br />

    <button
      onClick={saveEdit}
    >
      Save
    </button>

    <button
      onClick={() =>
        setEditingDue(null)
      }
    >
      Cancel
    </button>

  </div>

)}
  </Layout>
);
}

export default PaymentDues;