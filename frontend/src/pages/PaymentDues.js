import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import Layout from "../components/Layout";
import {
  getLoggedInUser
} from "../utils/auth";

import {
  isSuperAdmin,
  isAcademyOwner,
  canGenerateDue,
} from "../utils/permissions";

import {
  getAccessibleAcademies,
  getAccessibleCenters,
  getAccessibleBatches,
  getAccessiblePlayers
} from "../utils/dataScope";

import {
  fetchPaymentDuesService,
  createPaymentDueService,
  updatePaymentDueService,
  deletePaymentDueService
} from "../services/paymentService";

import { useNavigate } from "react-router-dom";
import "./PaymentDues.css";

function PaymentDues() {
const navigate = useNavigate();
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

    fetchCenters();

  } else {

    setCenters([]);
    setSelectedCenter("");

  }

}, [selectedAcademy]);

useEffect(() => {

  if (selectedCenter) {

    fetchBatches();

  } else {

    setBatches([]);
    setSelectedBatch("");

  }

}, [selectedCenter]);

useEffect(() => {

  if (selectedBatch) {

    console.log(
      "Selected Batch:",
      selectedBatch
    );

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

const fetchAcademies = async () => {

  if (!loggedInUser) return;

  try {

    const data =
      await getAccessibleAcademies(
        loggedInUser
      );

    setAcademies(data || []);

    if (
      !isSuperAdmin(loggedInUser) &&
      data.length > 0
    ) {

      setSelectedAcademy(
        data[0].id
      );

    }

  } catch (err) {

    console.log(err.message);

  }

};


const fetchCenters = async () => {

  try {

    const data =
      await getAccessibleCenters(
        loggedInUser
      );

    if (selectedAcademy) {

      setCenters(

        data.filter(
          center =>
            center.academy_id ===
            selectedAcademy
        )

      );

    } else {

      setCenters(data);

    }

  } catch (err) {

    console.log(err.message);

  }

};


const fetchBatches = async () => {

  try {

    const data =
      await getAccessibleBatches(
        loggedInUser,
        selectedCenter
      );

    setBatches(data || []);

  } catch (err) {

    console.log(err.message);

  }

};


const fetchPlayers = async (batchId) => {

  try {

    const data =
      await getAccessiblePlayers(batchId);

console.log(
    "Raw Data:",
    data
);

const playersList =
    data.map(item => item.players);

console.log(
    "Mapped Players:",
    playersList
);

    console.log(
      "Loaded Players:",
      playersList
    );

    setPlayers(playersList);

  } catch (err) {

    console.log(err.message);

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

////////////////////////////////////////////

const fetchPaymentDues = async (
  playerId = null
) => {

  try {

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

    const data =
      await fetchPaymentDuesService(

        query.order(
          "due_date",
          {
            ascending: false
          }
        )

      );

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

  catch (error) {

    console.log(error);

  }

};

//////////////////////////////////////////////////////
  const createPaymentDue = async () => {

    if (!canGenerateDue(loggedInUser)) {

  alert(
    "You are not authorized to generate payment dues."
  );

  return;

}

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

      const dueData = {

  player_id: playerId,

  subscription_id:
    selectedSubscription,

  due_type: dueType,

  due_date: dueDate,

  total_amount: amount,

  paid_amount: 0,

  due_status: "pending"

};

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

try {

    await createPaymentDueService(
        dueData
    );

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

} catch (error) {

    alert(error.message);

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

  if (!canGenerateDue(loggedInUser)) {

    alert(
      "You are not authorized to edit payment dues."
    );

    return;

  }

  try {

    await updatePaymentDueService(

      editingDue.id,

      {

        due_date: editDueDate,

        due_type: editDueType

      }

    );

    setEditingDue(null);

    fetchPaymentDues();

  } catch (error) {

    alert(error.message);

  }

};

const deleteDue = async (due) => {

  if (!canGenerateDue(loggedInUser)) {

  alert(
    "You are not authorized to delete payment dues."
  );

  return;

}

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

  try {

    await deletePaymentDueService(
      due.id
    );

    alert(
      "Due deleted successfully"
    );

    fetchPaymentDues();

  } catch (error) {

    console.log(error);

    alert(error.message);

  }

};

return (
  <Layout>
    <div className="payment-dues-page">
      <div className="payment-page-header">
        <div>
          <div className="payment-page-eyebrow">Finance</div>
          <h1>Payment Dues</h1>
          <p>Generate, review and manage outstanding player dues.</p>
        </div>
        <div className="payment-page-summary">
          <span className="payment-summary-label">Visible dues</span>
          <strong>{duesList.length}</strong>
        </div>
      </div>

      <section className="payment-card">
        <div className="payment-card-header">
          <div>
            <h2>Generate Payment Due</h2>
            <p>Select the player subscription and define the amount due.</p>
          </div>
        </div>

        <div className="payment-form-grid">
          <label className="payment-field"><span>Academy</span><select value={selectedAcademy} onChange={(e) => setSelectedAcademy(e.target.value)}><option value="">Select Academy</option>{academies.map((academy) => <option key={academy.id} value={academy.id}>{academy.academy_name}</option>)}</select></label>
          <label className="payment-field"><span>Center</span><select value={selectedCenter} onChange={(e) => setSelectedCenter(e.target.value)}><option value="">Select Center</option>{centers.map((center) => <option key={center.id} value={center.id}>{center.center_name}</option>)}</select></label>
          <label className="payment-field"><span>Batch</span><select value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}><option value="">Select Batch</option>{batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batch_name}</option>)}</select></label>
          <label className="payment-field"><span>Player</span><select value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value)}><option value="">Select Player</option>{players.map((player) => <option key={player.id} value={player.id}>{player.full_name}</option>)}</select></label>
          <label className="payment-field payment-field-wide">
            <span>Subscription</span>
            <select value={selectedSubscription} onChange={(e) => { const subscriptionId = e.target.value; setSelectedSubscription(subscriptionId); setSelectedSubscriptionData(subscriptions.find((subscription) => subscription.id === subscriptionId)); }}>
              <option value="">Select Subscription</option>
              {subscriptions.map((subscription) => <option key={subscription.id} value={subscription.id}>{subscription.players?.full_name} - {subscription.subscription_plans?.plan_name} - ₹{subscription.subscription_plans?.amount}</option>)}
            </select>
          </label>
          <label className="payment-field"><span>Due Type</span><select value={dueType} onChange={(e) => setDueType(e.target.value)}><option value="">Select Due Type</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="registration">Registration</option></select></label>
          <label className="payment-field"><span>Due Date</span><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
        </div>

        <div className="payment-form-footer">
          {selectedSubscriptionData && <div className="payment-amount-preview"><span>Plan amount</span><strong>₹{selectedSubscriptionData.subscription_plans?.amount}</strong></div>}
          {canGenerateDue(loggedInUser) && <button type="button" className="payment-primary-button" onClick={createPaymentDue}>Generate Due</button>}
        </div>
      </section>

      <section className="payment-card">
        <div className="payment-card-header payment-list-header">
          <div><h2>Payment Dues List</h2><p>{duesList.length === 0 ? "No dues match the current filters." : "Review balances and move unpaid dues to collection."}</p></div>
          <label className="payment-filter-field"><span>Status</span><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All Statuses</option><option value="pending">Pending</option><option value="partial">Partial</option><option value="paid">Paid</option></select></label>
        </div>

        {duesList.length === 0 ? (
          <div className="payment-empty-state"><div className="payment-empty-icon">₹</div><h3>No payment dues found</h3><p>Adjust the filters or generate a new due for an eligible player subscription.</p></div>
        ) : (
          <div className="payment-table-wrapper">
            <table className="payment-data-table">
              <thead><tr><th>Academy</th><th>Center</th><th>Batch</th><th>Player</th><th>Plan</th><th>Due Type</th><th>Due Date</th><th>Total</th><th>Paid</th><th>Remaining</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {duesList.map((due) => (
                  <tr key={due.id}>
                    <td>{due.players?.academies?.academy_name || "-"}</td>
                    <td>{due.players?.centers?.center_name || "-"}</td>
                    <td>{due.players?.batches?.batch_name || "-"}</td>
                    <td className="payment-player-cell">{due.players?.full_name || "-"}</td>
                    <td>{due.player_subscriptions?.subscription_plans?.plan_name || "-"}</td>
                    <td><span className="payment-type-badge">{due.due_type}</span></td>
                    <td>{due.due_date}</td>
                    <td>₹ {due.total_amount}</td>
                    <td>₹ {due.paid_amount}</td>
                    <td className="payment-remaining-cell">₹ {due.remaining_amount}</td>
                    <td><span className={`payment-status-badge payment-status-${due.due_status}`}>{due.due_status === "paid" ? "Paid" : due.due_status === "partial" ? "Partial" : "Pending"}</span></td>
                    <td><div className="payment-action-group">
                      {due.due_status !== "paid" && <button type="button" className="payment-secondary-button" onClick={() => navigate("/payment-collections", { state: { dueId: due.id } })}>Record Payment</button>}
                      {canGenerateDue(loggedInUser) && <><button type="button" className="payment-text-button" onClick={() => startEdit(due)}>Edit</button><button type="button" className="payment-danger-button" onClick={() => deleteDue(due)}>Delete</button></>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>

    {editingDue && (
      <div className="payment-modal-overlay" role="presentation">
        <div className="payment-modal" role="dialog" aria-modal="true" aria-labelledby="edit-due-title">
          <div className="payment-modal-header"><div><div className="payment-page-eyebrow">Payment Dues</div><h2 id="edit-due-title">Edit Due</h2></div><button type="button" className="payment-modal-close" onClick={() => setEditingDue(null)} aria-label="Close edit due dialog">×</button></div>
          <div className="payment-modal-body">
            <label className="payment-field"><span>Due Date</span><input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} /></label>
            <label className="payment-field"><span>Due Type</span><select value={editDueType} onChange={(e) => setEditDueType(e.target.value)}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="registration">Registration</option></select></label>
          </div>
          <div className="payment-modal-footer">{canGenerateDue(loggedInUser) && <button type="button" className="payment-primary-button" onClick={saveEdit}>Save Changes</button>}<button type="button" className="payment-secondary-button" onClick={() => setEditingDue(null)}>Cancel</button></div>
        </div>
      </div>
    )}
  </Layout>
);
export default PaymentDues;