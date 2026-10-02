import { useEffect, useMemo, useState } from "react";
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
  const [existingDueForSelection, setExistingDueForSelection] = useState(null);
  const [checkingExistingDue, setCheckingExistingDue] = useState(false);

  const [dueType, setDueType] = useState("");

  const [dueDate, setDueDate] = useState("");

  const [duesList, setDuesList] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);

  const [columnFilters, setColumnFilters] = useState({
    academy: "",
    center: "",
    batch: "",
    player: "",
    plan: "",
    dueType: ""
  });

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
  let cancelled = false;

  const checkExistingDue = async () => {
    if (!selectedSubscription || !dueDate) {
      setExistingDueForSelection(null);
      setCheckingExistingDue(false);
      return;
    }

    setCheckingExistingDue(true);

    const { data, error } = await supabase
      .from("payment_dues")
      .select("id, due_type, due_date, total_amount, due_status")
      .eq("subscription_id", selectedSubscription)
      .eq("due_date", dueDate)
      .limit(1);

    if (cancelled) return;

    if (error) {
      console.log(error);
      setExistingDueForSelection(null);
    } else {
      setExistingDueForSelection(data?.[0] || null);
    }

    setCheckingExistingDue(false);
  };

  checkExistingDue();

  return () => {
    cancelled = true;
  };
}, [selectedSubscription, dueDate]);

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
      setExistingDueForSelection(existingDue[0]);
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
    setExistingDueForSelection(null);

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

useEffect(() => {
  setCurrentPage(1);
}, [statusFilter, dueFromDate, dueToDate, selectedAcademy, selectedCenter, selectedBatch, selectedPlayer, columnFilters]);

const filteredDues = useMemo(() => {
  return duesList.filter((due) => {
    if (statusFilter && due.due_status !== statusFilter.toLowerCase()) return false;
    if (dueFromDate && due.due_date < dueFromDate) return false;
    if (dueToDate && due.due_date > dueToDate) return false;
    if (columnFilters.academy && due.players?.academy_id !== columnFilters.academy) return false;
    if (columnFilters.center && due.players?.center_id !== columnFilters.center) return false;
    if (columnFilters.batch && due.players?.batch_id !== columnFilters.batch) return false;
    if (columnFilters.player && due.players?.id !== columnFilters.player) return false;
    if (columnFilters.plan && due.player_subscriptions?.subscription_plans?.plan_name !== columnFilters.plan) return false;
    if (columnFilters.dueType && due.due_type !== columnFilters.dueType) return false;
    return true;
  });
}, [duesList, statusFilter, dueFromDate, dueToDate, columnFilters]);

const filterOptions = useMemo(() => ({
  academies: [...new Map(duesList.map((due) => [due.players?.academy_id, due.players?.academies?.academy_name]).filter(([id, name]) => id && name)).entries()]
    .map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
  centers: [...new Map(duesList.map((due) => [due.players?.center_id, due.players?.centers?.center_name]).filter(([id, name]) => id && name)).entries()]
    .map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
  batches: [...new Map(duesList.map((due) => [due.players?.batch_id, due.players?.batches?.batch_name]).filter(([id, name]) => id && name)).entries()]
    .map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
  players: [...new Map(duesList.map((due) => [due.players?.id, due.players?.full_name]).filter(([id, name]) => id && name)).entries()]
    .map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
  plans: [...new Set(duesList.map((due) => due.player_subscriptions?.subscription_plans?.plan_name).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b)),
  dueTypes: [...new Set(duesList.map((due) => due.due_type).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
}), [duesList]);

const totalDue = duesList.reduce((sum, due) => sum + Number(due.total_amount || 0), 0);
const totalPaid = duesList.reduce((sum, due) => sum + Number(due.paid_amount || 0), 0);
const totalRemaining = duesList.reduce((sum, due) => sum + Number(due.remaining_amount || 0), 0);
const filteredRemaining = filteredDues.reduce((sum, due) => sum + Number(due.remaining_amount || 0), 0);

const pendingAmount = duesList.filter((due) => due.due_status === "pending")
  .reduce((sum, due) => sum + Number(due.remaining_amount || 0), 0);
const partialAmount = duesList.filter((due) => due.due_status === "partial")
  .reduce((sum, due) => sum + Number(due.remaining_amount || 0), 0);
const paidAmount = duesList.filter((due) => due.due_status === "paid")
  .reduce((sum, due) => sum + Number(due.paid_amount || 0), 0);

const formatCurrency = (value) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
}).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "—";
  const parts = String(value).split("-");
  if (parts.length !== 3) return value;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
};

const getDueAge = (dueDate, dueStatus) => {
  if (!dueDate) return { label: "—", className: "" };
  if (dueStatus === "paid") return { label: "Paid", className: "payment-due-age-paid" };

  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today - due) / 86400000);

  if (diffDays > 0) {
    return {
      label: `${diffDays}d overdue`,
      className: "payment-due-age-overdue"
    };
  }

  if (diffDays === 0) {
    return {
      label: "Due today",
      className: "payment-due-age-today"
    };
  }

  return {
    label: `Due in ${Math.abs(diffDays)}d`,
    className: "payment-due-age-upcoming"
  };
};

const clearFilters = () => {
  setStatusFilter("");
  setDueFromDate("");
  setDueToDate("");
  setColumnFilters({ academy: "", center: "", batch: "", player: "", plan: "", dueType: "" });
};

const hasActiveFilters =
  Boolean(statusFilter) ||
  Boolean(dueFromDate) ||
  Boolean(dueToDate) ||
  Object.values(columnFilters).some(Boolean);

const totalPages = Math.max(1, Math.ceil(filteredDues.length / 7));
const paginatedDues = filteredDues.slice((currentPage - 1) * 7, currentPage * 7);

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
          <strong>{filteredDues.length}</strong>
        </div>
      </div>

      <div className="payment-dues-top-grid">
        <section className="payment-card payment-generate-card">
          <div className="payment-card-header payment-generate-header">
            <div>
              <div className="payment-section-kicker">Due generation</div>
              <h2>Generate Payment Due</h2>
              <p>Select the player subscription and define the due.</p>
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

          {selectedSubscriptionData && (
            <div className="payment-due-preview" aria-live="polite">
              <div className="payment-due-preview-heading">
                <div>
                  <div className="payment-section-kicker">Due preview</div>
                  <strong>Review before generating</strong>
                </div>
                {existingDueForSelection && <span className="payment-duplicate-badge">Already exists</span>}
              </div>
              <div className="payment-due-preview-grid">
                <div><span>Player</span><strong>{selectedSubscriptionData.players?.full_name || "—"}</strong></div>
                <div><span>Plan</span><strong>{selectedSubscriptionData.subscription_plans?.plan_name || "—"}</strong></div>
                <div><span>Amount</span><strong>{formatCurrency(selectedSubscriptionData.subscription_plans?.amount)}</strong></div>
                <div><span>Due type</span><strong>{dueType || "—"}</strong></div>
                <div><span>Due date</span><strong>{formatDate(dueDate)}</strong></div>
              </div>
            </div>
          )}

          {existingDueForSelection && (
            <div className="payment-duplicate-warning" role="alert">
              <strong>A payment due already exists for this subscription and due date.</strong>
              <span>Existing due: {formatCurrency(existingDueForSelection.total_amount)} · {existingDueForSelection.due_status || "Pending"}</span>
            </div>
          )}

          <div className="payment-form-footer">
            <div className="payment-generation-status">
              {checkingExistingDue && <span>Checking for an existing due…</span>}
            </div>
            {canGenerateDue(loggedInUser) && (
              <button
                type="button"
                className="payment-primary-button"
                onClick={createPaymentDue}
                disabled={!selectedSubscriptionData || !dueType || !dueDate || checkingExistingDue || Boolean(existingDueForSelection)}
              >
                Generate Due
              </button>
            )}
          </div>
        </section>


        <section className="payment-kpi-panel" aria-label="Payment due summary">
            <div className="payment-kpi-grid" aria-label="Payment due summary">
          <div className="payment-kpi-card payment-kpi-total"><span>Total due</span><strong>{formatCurrency(totalDue)}</strong><small>{duesList.length} records in scope</small></div>
          <div className="payment-kpi-card payment-kpi-pending"><span>Pending</span><strong>{formatCurrency(pendingAmount)}</strong><small>{duesList.filter((due) => due.due_status === "pending").length} dues</small></div>
          <div className="payment-kpi-card payment-kpi-partial"><span>Partial</span><strong>{formatCurrency(partialAmount)}</strong><small>{duesList.filter((due) => due.due_status === "partial").length} dues</small></div>
          <div className="payment-kpi-card payment-kpi-paid"><span>Paid</span><strong>{formatCurrency(paidAmount)}</strong><small>{duesList.filter((due) => due.due_status === "paid").length} dues · {formatCurrency(totalPaid)} collected</small></div>
            </div>


        </section>
      </div>

      <section className="payment-card payment-dues-list-card">
        <div className="payment-list-heading">
          <div>
            <div className="payment-section-kicker">Collections workspace</div>
            <h2>Payment Dues List</h2>
            <p>{filteredDues.length === 0 ? "No dues match the current filters." : filteredDues.length + " shown · " + formatCurrency(filteredRemaining) + " outstanding"}</p>
          </div>
          <div className="payment-list-controls">
            <label className="payment-filter-field payment-date-filter-field"><span>From</span><input type="date" value={dueFromDate} max={dueToDate || undefined} onChange={(e) => setDueFromDate(e.target.value)} aria-label="Filter dues from date" /></label>
            <label className="payment-filter-field payment-date-filter-field"><span>To</span><input type="date" value={dueToDate} min={dueFromDate || undefined} onChange={(e) => setDueToDate(e.target.value)} aria-label="Filter dues to date" /></label>
            <label className="payment-filter-field"><span>Status</span><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All Statuses</option><option value="pending">Pending</option><option value="partial">Partial</option><option value="paid">Paid</option></select></label>
            <button type="button" className="payment-clear-filters" onClick={clearFilters} disabled={!hasActiveFilters}>Clear filters</button>
          </div>
        </div>

        {filteredDues.length === 0 ? (
          <div className="payment-empty-state"><div className="payment-empty-icon">₹</div><h3>No payment dues found</h3><p>Adjust the filters or generate a new due for an eligible player subscription.</p></div>
        ) : (
          <div className="payment-table-wrapper">
            <table className="payment-data-table">
              <caption className="sr-only">Payment dues, balances, status, and available actions</caption>
              <thead><tr>
                  <th scope="col"><div className="payment-column-filter"><span>Academy</span><select aria-label="Filter dues by academy" value={columnFilters.academy} onChange={(e) => setColumnFilters((filters) => ({ ...filters, academy: e.target.value }))}><option value="">All</option>{filterOptions.academies.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></div></th>
                  <th scope="col"><div className="payment-column-filter"><span>Center</span><select aria-label="Filter dues by center" value={columnFilters.center} onChange={(e) => setColumnFilters((filters) => ({ ...filters, center: e.target.value }))}><option value="">All</option>{filterOptions.centers.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></div></th>
                  <th scope="col"><div className="payment-column-filter"><span>Batch</span><select aria-label="Filter dues by batch" value={columnFilters.batch} onChange={(e) => setColumnFilters((filters) => ({ ...filters, batch: e.target.value }))}><option value="">All</option>{filterOptions.batches.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></div></th>
                  <th scope="col"><div className="payment-column-filter"><span>Player</span><select aria-label="Filter dues by player" value={columnFilters.player} onChange={(e) => setColumnFilters((filters) => ({ ...filters, player: e.target.value }))}><option value="">All</option>{filterOptions.players.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></div></th>
                  <th scope="col"><div className="payment-column-filter"><span>Plan</span><select aria-label="Filter dues by plan" value={columnFilters.plan} onChange={(e) => setColumnFilters((filters) => ({ ...filters, plan: e.target.value }))}><option value="">All</option>{filterOptions.plans.map((option) => <option key={option} value={option}>{option}</option>)}</select></div></th>
                  <th scope="col"><div className="payment-column-filter"><span>Due Type</span><select aria-label="Filter dues by due type" value={columnFilters.dueType} onChange={(e) => setColumnFilters((filters) => ({ ...filters, dueType: e.target.value }))}><option value="">All</option>{filterOptions.dueTypes.map((option) => <option key={option} value={option}>{option}</option>)}</select></div></th>
                  <th scope="col">Due Date</th><th scope="col">Due Age</th><th scope="col">Total</th><th scope="col">Paid</th><th scope="col">Remaining</th><th scope="col">Status</th><th scope="col">Actions</th>
                </tr></thead>
              <tbody>
                {paginatedDues.map((due) => (
                  <tr key={due.id} className="payment-due-row">
                    <td>{due.players?.academies?.academy_name || "-"}</td>
                    <td>{due.players?.centers?.center_name || "-"}</td>
                    <td>{due.players?.batches?.batch_name || "-"}</td>
                    <td className="payment-player-cell">{due.players?.full_name || "-"}</td>
                    <td>{due.player_subscriptions?.subscription_plans?.plan_name || "-"}</td>
                    <td><span className="payment-type-badge">{due.due_type}</span></td>
                    <td className="payment-date-cell">{formatDate(due.due_date)}</td>
                    <td><span className={`payment-due-age ${getDueAge(due.due_date, due.due_status).className}`}>{getDueAge(due.due_date, due.due_status).label}</span></td>
                    <td className="payment-money-cell">{formatCurrency(due.total_amount)}</td>
                    <td className="payment-money-cell">{formatCurrency(due.paid_amount)}</td>
                    <td className="payment-remaining-cell">{formatCurrency(due.remaining_amount)}</td>
                    <td><span className={`payment-status-badge payment-status-${due.due_status}`}>{due.due_status === "paid" ? "Paid" : due.due_status === "partial" ? "Partial" : "Pending"}</span></td>
                    <td className="payment-actions-cell"><div className="payment-action-group">
                      {due.due_status !== "paid" && <button type="button" className="payment-secondary-button" onClick={() => navigate("/payment-collections", { state: { dueId: due.id } })}>Record Payment</button>}
                      {canGenerateDue(loggedInUser) && <><button type="button" className="payment-text-button" onClick={() => startEdit(due)} aria-label={`Edit due for ${due.players?.full_name || "player"}`}>Edit</button><button type="button" className="payment-danger-button" onClick={() => deleteDue(due)} aria-label={`Delete due for ${due.players?.full_name || "player"}`}>Delete</button></>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filteredDues.length > 0 && (
          <div className="payment-pagination">
            <span>
              Showing {Math.min((currentPage - 1) * 7 + 1, filteredDues.length)}
              –{Math.min(currentPage * 7, filteredDues.length)}
              of {filteredDues.length}
            </span>
            <div className="payment-pagination-controls">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <strong>Page {currentPage} of {totalPages}</strong>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
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
}

export default PaymentDues;