import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import Layout from "../components/Layout";
import {
  getLoggedInUser
} from "../utils/auth";

import {
  isSuperAdmin,
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
import {
  createOneTimeCampDueService,
  isOneTimeCampDueEnabled
} from "../services/oneTimeCampDueService";
import "./PaymentDues.css";
import {
  canAdjustFirstPeriodDue,
  prepareManualFirstPeriodDue
} from "../utils/manualFirstPeriodDue";

function PaymentDues() {
const navigate = useNavigate();
const oneTimeBillingEnabled = isOneTimeCampDueEnabled();
  const [academies, setAcademies] = useState([]);
const [centers, setCenters] = useState([]);
const [batches, setBatches] = useState([]);
const [players, setPlayers] = useState([]);

const [generationAcademy, setGenerationAcademy] = useState("");
const [generationCenter, setGenerationCenter] = useState("");
const [generationBatch, setGenerationBatch] = useState("");
const [generationPlayer, setGenerationPlayer] = useState("");
const [showGenerateDueModal, setShowGenerateDueModal] = useState(false);
  const [subscriptions, setSubscriptions] = useState([]);

  const [selectedSubscription, setSelectedSubscription] = useState("");

  const [selectedSubscriptionData, setSelectedSubscriptionData] = useState(null);
  const [existingDueForSelection, setExistingDueForSelection] = useState(null);
  const [checkingExistingDue, setCheckingExistingDue] = useState(false);

  const [dueType, setDueType] = useState("");

  const [dueDate, setDueDate] = useState("");
  const [manualFirstPeriod, setManualFirstPeriod] = useState(false);
  const [manualFirstPeriodAmount, setManualFirstPeriodAmount] = useState("");
  const [manualFirstPeriodReason, setManualFirstPeriodReason] = useState("");
  const [isCreatingDue, setIsCreatingDue] = useState(false);

  // Date-range filters for reviewing dues by month or custom period.
  const [dueFromDate, setDueFromDate] = useState("");
  const [dueToDate, setDueToDate] = useState("");

  const [duesList, setDuesList] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDueId, setSelectedDueId] = useState(null);

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

  if (generationBatch) {

    console.log(
      "Selected Batch:",
      generationBatch
    );

    fetchPlayers(generationBatch);

  } else {

    setPlayers([]);
    setGenerationPlayer("");

  }

}, [generationBatch]);


useEffect(() => {

  if (generationPlayer) {

    fetchSubscriptionsByPlayer(
      generationPlayer
    );

  } else {

    setSubscriptions([]);

    setSelectedSubscription("");

    setSelectedSubscriptionData(
      null
    );

  }

}, [generationPlayer]);

useEffect(() => {
  // A manual first-period quote must not carry across different players, dates or due types.
  setManualFirstPeriod(false);
  setManualFirstPeriodAmount("");
  setManualFirstPeriodReason("");
}, [selectedSubscription, dueType, dueDate]);

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
  const fetchLoggedInUser =
async () => {

  const user =
    await getLoggedInUser();

  setLoggedInUser(user);

};

const fetchAcademies = useCallback(async () => {

  if (!loggedInUser) return;

  try {

    const data =
      await getAccessibleAcademies(
        loggedInUser
      );

    setAcademies(data || []);

  } catch (err) {

    console.log(err.message);

  }

}, [loggedInUser]);


const fetchCenters = useCallback(async () => {

  try {

    const data =
      await getAccessibleCenters(
        loggedInUser
      );

    if (generationAcademy) {

      setCenters(

        data.filter(
          center =>
            center.academy_id ===
            generationAcademy
        )

      );

    } else {

      setCenters(data);

    }

  } catch (err) {

    console.log(err.message);

  }

}, [loggedInUser, generationAcademy]);


const fetchBatches = useCallback(async () => {

  try {

    const data =
      await getAccessibleBatches(
        loggedInUser,
        generationCenter
      );

    setBatches(data || []);

  } catch (err) {

    console.log(err.message);

  }

}, [loggedInUser, generationCenter]);


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
        start_date,
        status,
        players (
          full_name,
          academy_id
        ),
        subscription_plans (
          plan_name,
          amount,
          academy_id,
          billing_cycle
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

const fetchPaymentDues = useCallback(async (
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
    remarks,

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
   if (!isSuperAdmin(loggedInUser)) {
     filteredData = filteredData.filter(
       due => due.players?.academy_id === loggedInUser.academy_id
     );
   }
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

}, [loggedInUser, statusFilter]);

//////////////////////////////////////////////////////
  const resetGenerateDueForm = () => {
    setGenerationAcademy("");
    setGenerationCenter("");
    setGenerationBatch("");
    setGenerationPlayer("");
    setCenters([]);
    setBatches([]);
    setPlayers([]);
    setSubscriptions([]);
    setSelectedSubscription("");
    setSelectedSubscriptionData(null);
    setExistingDueForSelection(null);
    setCheckingExistingDue(false);
    setDueType("");
    setDueDate("");
    setManualFirstPeriod(false);
    setManualFirstPeriodAmount("");
    setManualFirstPeriodReason("");
    setIsCreatingDue(false);
  };

  const openGenerateDueModal = () => {
    resetGenerateDueForm();
    setShowGenerateDueModal(true);
  };

  const closeGenerateDueModal = () => {
    setShowGenerateDueModal(false);
    resetGenerateDueForm();
  };

  const createPaymentDue = async () => {
    if (isCreatingDue) return;
    if (!canGenerateDue(loggedInUser)) {
      alert("You are not authorized to generate payment dues.");
      return;
    }
    if (!selectedSubscription || !selectedSubscriptionData || !dueType || !dueDate) {
      alert("Please select a subscription, due type and due date.");
      return;
    }
    if (selectedSubscriptionData.subscription_plans?.billing_cycle === "one_time") {
      if (!oneTimeBillingEnabled) {
        alert("One-time camp billing is not enabled. The reviewed server protections must be deployed first.");
        return;
      }
      if (dueType !== "one_time" || dueDate !== selectedSubscriptionData.start_date) {
        alert("A One-time camp must use its saved start date and One-time due type.");
        return;
      }
      if (!window.confirm(
        `Generate ONE pending One-time camp due of ${formatCurrency(selectedSubscriptionData.subscription_plans?.amount)} for ${selectedSubscriptionData.players?.full_name || "the player"}? No payment will be collected.`
      )) return;
      setIsCreatingDue(true);
      try {
        const result = await createOneTimeCampDueService(selectedSubscription);
        alert(result.created
          ? "One-time camp due generated. Collect the payment separately; no payment has been recorded."
          : "The One-time camp due already exists. No duplicate charge was created.");
        closeGenerateDueModal();
        await fetchPaymentDues();
      } catch (error) {
        alert(error.message || "Could not generate the One-time camp due.");
      } finally {
        setIsCreatingDue(false);
      }
      return;
    }

    setIsCreatingDue(true);
    try {
      let adjustment = null;

      if (manualFirstPeriod) {
        // Re-read the authoritative agreement and price immediately before posting.
        // Do not rely on the old dropdown or advisory proration calculator values.
        const { data: currentSubscription, error: subscriptionError } = await supabase
          .from("player_subscriptions")
          .select(`id, player_id, status, start_date,
            players ( academy_id ),
            subscription_plans ( amount, academy_id, billing_cycle )`)
          .eq("id", selectedSubscription)
          .single();
        if (subscriptionError) throw subscriptionError;
        if (!currentSubscription || currentSubscription.player_id !== generationPlayer ||
            (generationAcademy && currentSubscription.players?.academy_id !== generationAcademy)) {
          throw new Error("The selected player or academy changed. Reload the subscription before creating a due.");
        }

        adjustment = prepareManualFirstPeriodDue({
          subscription: currentSubscription,
          dueType,
          dueDate,
          enteredAmount: manualFirstPeriodAmount,
          reason: manualFirstPeriodReason
        });

        // Do not post a second first-period amount on a subscription with existing tuition dues.
        // This is a client-side safeguard, NOT cross-session database uniqueness.
        const { data: earlierMonthlyDues, error: priorError } = await supabase
          .from("payment_dues")
          .select("id")
          .eq("subscription_id", selectedSubscription)
          .eq("due_type", "monthly")
          .limit(1);
        if (priorError) throw priorError;
        if (earlierMonthlyDues?.length) {
          throw new Error("A monthly due already exists for this subscription. Review its payment history; do not create a replacement due.");
        }
      }

      const { data: existingDue, error: duplicateError } = await supabase
        .from("payment_dues")
        .select("id, due_type, due_date, total_amount, due_status")
        .eq("subscription_id", selectedSubscription)
        .eq("due_date", dueDate)
        .limit(1);
      if (duplicateError) throw duplicateError;
      if (existingDue?.length) {
        setExistingDueForSelection(existingDue[0]);
        throw new Error("A due already exists for this subscription and due date.");
      }

      const originalAmount = selectedSubscriptionData.subscription_plans?.amount;
      if (originalAmount == null && !adjustment) {
        throw new Error("A valid subscription plan amount is required.");
      }
      if (adjustment && !window.confirm(
        `Generate one pending first-period due for INR ${adjustment.amount.toFixed(2)} instead of the standard ` +
        `INR ${(adjustment.fullPaise / 100).toFixed(2)}? This will not change the plan price or collect a payment.`
      )) return;

      await createPaymentDueService({
        player_id: selectedSubscriptionData.player_id,
        subscription_id: selectedSubscription,
        due_type: dueType,
        due_date: dueDate,
        total_amount: adjustment ? adjustment.amount : originalAmount,
        paid_amount: 0,
        due_status: "pending",
        ...(adjustment ? { remarks: adjustment.remarks } : {})
      });

      alert(adjustment
        ? "Manual first-period payment due created. No payment has been collected."
        : "Payment Due Generated Successfully");
      closeGenerateDueModal();
      fetchPaymentDues();
    } catch (error) {
      alert(error.message || "Unable to create payment due.");
    } finally {
      setIsCreatingDue(false);
    }
  };


const startEdit = (due) => {
  if (due?.due_type === "one_time") {
    alert("One-time camp charges cannot be edited; use the audited correction workflow.");
    return;
  }

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
  if (due?.due_type === "one_time") {
    alert("One-time camp charges cannot be deleted; use the audited correction workflow.");
    return;
  }

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
}, [statusFilter, dueFromDate, dueToDate, columnFilters]);

const hasInvalidDateRange = Boolean(dueFromDate && dueToDate && dueFromDate > dueToDate);

const filteredDues = useMemo(() => {
  if (hasInvalidDateRange) return [];
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
}, [duesList, statusFilter, dueFromDate, dueToDate, columnFilters, hasInvalidDateRange]);

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

const filteredRemaining = filteredDues.reduce((sum, due) => sum + Number(due.remaining_amount || 0), 0);

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(amount);
};

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



useEffect(() => {
  if (generationAcademy) {
    fetchCenters();
  } else {

    setCenters([]);
    setGenerationCenter("");

  }
}, [generationAcademy, fetchCenters]);

useEffect(() => {
  if (generationCenter) {
    fetchBatches();
  } else {

    setBatches([]);
    setGenerationBatch("");

  }
}, [generationCenter, fetchBatches]);

useEffect(() => {
  if (!loggedInUser) return;
  fetchAcademies();
  fetchPaymentDues();
}, [loggedInUser, statusFilter, fetchAcademies, fetchPaymentDues]);

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

      <section className="payment-card payment-dues-list-card">
        <div className="payment-list-heading">
          <div>
            <div className="payment-section-kicker">Collections workspace</div>
            <h2>Payment Dues List</h2>
            <p>{filteredDues.length === 0 ? "No dues match the current filters." : filteredDues.length + " shown · " + formatCurrency(filteredRemaining) + " outstanding"}</p>
          </div>
          <div className="payment-list-toolbar">
            {canGenerateDue(loggedInUser) && (
              <button type="button" className="payment-primary-button payment-generate-trigger" onClick={openGenerateDueModal}>
                + Generate Due
              </button>
            )}
            <div className="payment-list-controls">
            <label className="payment-filter-field payment-date-filter-field"><span>From</span><input type="date" value={dueFromDate} max={dueToDate || undefined} onChange={(e) => setDueFromDate(e.target.value)} aria-label="Filter dues from date" /></label>
            <label className="payment-filter-field payment-date-filter-field"><span>To</span><input type="date" value={dueToDate} min={dueFromDate || undefined} onChange={(e) => setDueToDate(e.target.value)} aria-label="Filter dues to date" /></label>
            <label className="payment-filter-field"><span>Status</span><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All Statuses</option><option value="pending">Pending</option><option value="partial">Partial</option><option value="paid">Paid</option></select></label>
            <button type="button" className="payment-clear-filters" onClick={clearFilters} disabled={!hasActiveFilters}>Clear filters</button>
            </div>
          </div>
        </div>

        {hasInvalidDateRange && (
          <div className="payment-filter-warning" role="alert">
            <strong>Invalid date range.</strong>
            <span>Choose a From date that is on or before the To date.</span>
          </div>
        )}

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
                {paginatedDues.map((due) => {
                  const isSelected = selectedDueId === due.id;
                  return (
                    <Fragment key={due.id}>
                      <tr
                        key={due.id}
                        className={`payment-due-row ${isSelected ? "payment-due-row-selected" : ""}`}
                        tabIndex={0}
                        onClick={() => setSelectedDueId(due.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedDueId(due.id);
                          }
                        }}
                      >
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
                          {due.due_status !== "paid" && <button type="button" className="payment-secondary-button" onClick={(event) => { event.stopPropagation(); navigate("/payment-collections", { state: { dueId: due.id } }); }}>Record Payment</button>}
                          {canGenerateDue(loggedInUser) && due.due_type !== "one_time" && <><button type="button" className="payment-text-button" onClick={(event) => { event.stopPropagation(); startEdit(due); }} aria-label={`Edit due for ${due.players?.full_name || "player"}`}>Edit</button><button type="button" className="payment-danger-button" onClick={(event) => { event.stopPropagation(); deleteDue(due); }} aria-label={`Delete due for ${due.players?.full_name || "player"}`}>Delete</button></>}
                        </div></td>
                      </tr>
                      {isSelected && due.remarks && (
                        <tr className="payment-due-note-row">
                          <td colSpan="13">
                            <div className="payment-due-note">
                              <strong>Due notes:</strong> {due.remarks}
                            </div>
                          </td>
                        </tr>
                      )}
                      {isSelected && (
                        <tr className="payment-due-mobile-actions-row">
                          <td colSpan="13" className="payment-due-mobile-actions-cell">
                            <div className="payment-due-mobile-actions">
                              {due.due_status !== "paid" && (
                                <button
                                  type="button"
                                  className="payment-secondary-button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    navigate("/payment-collections", { state: { dueId: due.id } });
                                  }}
                                >
                                  Record Payment
                                </button>
                              )}
                              {canGenerateDue(loggedInUser) && due.due_type !== "one_time" && (
                                <>
                                  <button
                                    type="button"
                                    className="payment-text-button payment-mobile-icon-button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      startEdit(due);
                                    }}
                                    aria-label={`Edit due for ${due.players?.full_name || "player"}`}
                                    title="Edit due"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    type="button"
                                    className="payment-danger-button payment-mobile-icon-button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      deleteDue(due);
                                    }}
                                    aria-label={`Delete due for ${due.players?.full_name || "player"}`}
                                    title="Delete due"
                                  >
                                    🗑️
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
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

    {showGenerateDueModal && (
      <div className="payment-modal-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) closeGenerateDueModal(); }}>
        <div className="payment-modal payment-generate-modal" role="dialog" aria-modal="true" aria-labelledby="generate-due-title">
          <div className="payment-modal-header">
            <div>
              <div className="payment-page-eyebrow">Payment Dues</div>
              <h2 id="generate-due-title">Generate Payment Due</h2>
              <p className="payment-modal-description">Select the player subscription and define the due.</p>
            </div>
            <button type="button" className="payment-modal-close" onClick={closeGenerateDueModal} aria-label="Close generate payment due dialog">×</button>
          </div>

          <div className="payment-modal-body payment-generate-modal-body">
            <div className="payment-form-grid">
              <label className="payment-field">
                <span>Academy</span>
                <select value={generationAcademy} onChange={(e) => setGenerationAcademy(e.target.value)}>
                  <option value="">Select Academy</option>
                  {academies.map((academy) => <option key={academy.id} value={academy.id}>{academy.academy_name}</option>)}
                </select>
              </label>
              <label className="payment-field">
                <span>Center</span>
                <select value={generationCenter} onChange={(e) => setGenerationCenter(e.target.value)}>
                  <option value="">Select Center</option>
                  {centers.map((center) => <option key={center.id} value={center.id}>{center.center_name}</option>)}
                </select>
              </label>
              <label className="payment-field">
                <span>Batch</span>
                <select value={generationBatch} onChange={(e) => setGenerationBatch(e.target.value)}>
                  <option value="">Select Batch</option>
                  {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batch_name}</option>)}
                </select>
              </label>
              <label className="payment-field">
                <span>Player</span>
                <select value={generationPlayer} onChange={(e) => setGenerationPlayer(e.target.value)}>
                  <option value="">Select Player</option>
                  {players.map((player) => <option key={player.id} value={player.id}>{player.full_name}</option>)}
                </select>
              </label>
              <label className="payment-field payment-field-wide">
                <span>Subscription</span>
                <select value={selectedSubscription} onChange={(e) => {
                  const subscriptionId = e.target.value;
                  setSelectedSubscription(subscriptionId);
                  const nextSubscription = subscriptions.find((subscription) => subscription.id === subscriptionId) || null;
                  setSelectedSubscriptionData(nextSubscription);
                  setDueType(nextSubscription?.subscription_plans?.billing_cycle === "one_time" ? "one_time" : "");
                  setDueDate(nextSubscription?.subscription_plans?.billing_cycle === "one_time" ? (nextSubscription.start_date || "") : "");
                }}>
                  <option value="">Select Subscription</option>
                  {subscriptions.map((subscription) => (
                    <option key={subscription.id} value={subscription.id}>
                      {subscription.players?.full_name} - {subscription.subscription_plans?.plan_name} - ₹{subscription.subscription_plans?.amount}
                    </option>
                  ))}
                </select>
              </label>
              <label className="payment-field">
                <span>Due Type</span>
                <select value={dueType} onChange={(e) => setDueType(e.target.value)}
                  disabled={selectedSubscriptionData?.subscription_plans?.billing_cycle === "one_time"}>
                  <option value="">Select Due Type</option>
                  {selectedSubscriptionData?.subscription_plans?.billing_cycle === "one_time" ? (
                    <option value="one_time">One-time</option>
                  ) : <>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="registration">Registration</option>
                  </>}
                </select>
              </label>
              <label className="payment-field">
                <span>Due Date</span>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                  readOnly={selectedSubscriptionData?.subscription_plans?.billing_cycle === "one_time"} />
              </label>
            </div>

            {selectedSubscriptionData?.subscription_plans?.billing_cycle === "one_time" && (
              <div className="payment-duplicate-warning" role={oneTimeBillingEnabled ? "status" : "alert"}>
                <strong>{oneTimeBillingEnabled
                  ? "One-time camp — one fee per player per camp plan"
                  : "One-time camp payment dues are not enabled yet."}</strong>
                <span>{oneTimeBillingEnabled
                  ? "The fee and due date come from the saved camp plan and start date. No automatic collection or registration fee is added. Plans with a separate registration fee are not eligible."
                  : "The approved database safeguards must be installed and tested before this charge can be created. Do not use Monthly or Registration as a workaround."}</span>
              </div>
            )}

            {selectedSubscriptionData?.subscription_plans?.billing_cycle === "monthly" && (
              <div className="payment-manual-first-period">
                <p className="payment-first-period-help">
                  For a reduced first-month tuition fee, select <strong>Monthly</strong> and use the
                  subscription start date (<strong>{formatDate(selectedSubscriptionData.start_date)}</strong>)
                  as the due date. This does not alter the recurring plan rate.
                </p>
                {canAdjustFirstPeriodDue(selectedSubscriptionData, dueType, dueDate) && canGenerateDue(loggedInUser) && (
                  <>
                    <label className="payment-first-period-toggle">
                      <input
                        type="checkbox"
                        checked={manualFirstPeriod}
                        onChange={(e) => setManualFirstPeriod(e.target.checked)}
                      />
                      <span>Use an Owner-approved first-period amount</span>
                    </label>
                    {manualFirstPeriod && (
                      <div className="payment-first-period-fields">
                        <label className="payment-field">
                          <span>Approved first-period fee (₹)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={manualFirstPeriodAmount}
                            placeholder="e.g. 1269.23"
                            onChange={(e) => setManualFirstPeriodAmount(e.target.value)}
                            aria-label="Approved first-period fee"
                          />
                        </label>
                        <label className="payment-field">
                          <span>Adjustment reason (8–180 characters)</span>
                          <textarea
                            value={manualFirstPeriodReason}
                            onChange={(e) => setManualFirstPeriodReason(e.target.value)}
                            maxLength={180}
                            rows={2}
                            placeholder="e.g. Joined after the first two scheduled sessions"
                            aria-label="First-period fee adjustment reason"
                          />
                        </label>
                        <p className="payment-first-period-warning">
                          Review the training-session or day calculation yourself. This is a manually
                          approved one-time due, not an automatic saved prorated subscription price.
                          Existing dues and payments will not be changed.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

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
                  <div><span>Amount</span><strong>{manualFirstPeriod
                    ? (manualFirstPeriodAmount ? "₹" + manualFirstPeriodAmount : "Enter approved amount")
                    : formatCurrency(selectedSubscriptionData.subscription_plans?.amount)}</strong></div>
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
          </div>

          <div className="payment-modal-footer">
            <div className="payment-generation-status">
              {checkingExistingDue && <span>Checking for an existing due…</span>}
            </div>
            <div className="payment-modal-actions">
              <button type="button" className="payment-secondary-button" onClick={closeGenerateDueModal}>Cancel</button>
              {canGenerateDue(loggedInUser) && (
                <button
                  type="button"
                  className="payment-primary-button"
                  onClick={createPaymentDue}
                  disabled={!selectedSubscriptionData || !dueType || !dueDate || checkingExistingDue || isCreatingDue || Boolean(existingDueForSelection) ||
                    (selectedSubscriptionData?.subscription_plans?.billing_cycle === "one_time" && !oneTimeBillingEnabled)}
                >
                  Generate Due
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )}

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