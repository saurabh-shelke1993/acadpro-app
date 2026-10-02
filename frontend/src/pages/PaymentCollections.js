import React, {
  useState,
  useEffect,
  useRef
} from "react";
import { supabase } from "../services/supabase";
import "./PaymentCollections.css";

import {
  getLoggedInUser,
  isSuperAdmin,
  getAcademyId
} from "../utils/auth";
import Layout from "../components/Layout";

import { useLocation } from "react-router-dom";

function PaymentCollections() {
  const [academies, setAcademies] =
  useState([]);

const [centers, setCenters] =
  useState([]);

const [batches, setBatches] =
  useState([]);

const [players, setPlayers] =
  useState([]);

const [collectionAcademy,
  setCollectionAcademy] =
  useState("");

const [collectionCenter,
  setCollectionCenter] =
  useState("");

const [collectionBatch,
  setCollectionBatch] =
  useState("");

const [collectionPlayer,
  setCollectionPlayer] =
  useState("");

  const [dues, setDues] = useState([]);

  const [selectedDue, setSelectedDue] = useState("");

  const [selectedDueData, setSelectedDueData] = useState(null);

  const [amountPaid, setAmountPaid] = useState("");

  const [paymentMode, setPaymentMode] = useState("");


  const [payments, setPayments] = useState([]);

  const [historyPaymentMode,
setHistoryPaymentMode] =
useState("");

const [historyFromDate,
setHistoryFromDate] =
useState("");

const [historyToDate,
setHistoryToDate] =
useState("");

const [historyAcademy, setHistoryAcademy] = useState("");
const [historyCenter, setHistoryCenter] = useState("");
const [historyBatch, setHistoryBatch] = useState("");
const [historyPlayer, setHistoryPlayer] = useState("");
const [historySearch, setHistorySearch] = useState("");
const [historyCurrentPage, setHistoryCurrentPage] = useState(1);
const HISTORY_PAGE_SIZE = 10;

const resetHistoryFilters = () => {
  setHistoryAcademy("");
  setHistoryCenter("");
  setHistoryBatch("");
  setHistoryPlayer("");
  setHistorySearch("");
  setHistoryPaymentMode("");
  setHistoryFromDate("");
  setHistoryToDate("");
  setHistoryCurrentPage(1);
};

  const [filteredPayments,
  setFilteredPayments] =
  useState([]);

const historyPaymentsTotal = filteredPayments
  .filter(payment => payment.payment_entry_type === "payment")
  .reduce((total, payment) => total + Number(payment.amount_paid || 0), 0);

const historyAdjustmentsTotal = filteredPayments
  .filter(payment => payment.payment_entry_type === "adjustment")
  .reduce((total, payment) => total + Number(payment.amount_paid || 0), 0);

const historyNetTotal = historyPaymentsTotal + historyAdjustmentsTotal;

const historyFilterOptions = {
  academies: [...new Map((payments || []).map(payment => [payment.players?.academy_id, payment.players?.academies?.academy_name]).filter(([id, name]) => id && name)).entries()]
    .map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
  centers: [...new Map((payments || []).filter(payment => !historyAcademy || payment.players?.academy_id === historyAcademy).map(payment => [payment.players?.center_id, payment.players?.centers?.center_name]).filter(([id, name]) => id && name)).entries()]
    .map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
  batches: [...new Map((payments || []).filter(payment => (!historyAcademy || payment.players?.academy_id === historyAcademy) && (!historyCenter || payment.players?.center_id === historyCenter)).map(payment => [payment.players?.batch_id, payment.players?.batches?.batch_name]).filter(([id, name]) => id && name)).entries()]
    .map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
  players: [...new Map((payments || []).filter(payment => (!historyAcademy || payment.players?.academy_id === historyAcademy) && (!historyCenter || payment.players?.center_id === historyCenter) && (!historyBatch || payment.players?.batch_id === historyBatch)).map(payment => [payment.players?.id, payment.players?.full_name]).filter(([id, name]) => id && name)).entries()]
    .map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
};

const historyTotalPages = Math.max(1, Math.ceil(filteredPayments.length / HISTORY_PAGE_SIZE));
const paginatedPayments = filteredPayments.slice(
  (historyCurrentPage - 1) * HISTORY_PAGE_SIZE,
  historyCurrentPage * HISTORY_PAGE_SIZE
);

const selectedDueRemaining = Number(selectedDueData?.remaining_amount || 0);
const paymentAmountNumber = Number(amountPaid || 0);
const remainingAfterPayment = Math.max(selectedDueRemaining - paymentAmountNumber, 0);
const isPaymentAmountValid = paymentAmountNumber > 0 && paymentAmountNumber <= selectedDueRemaining;

  const [loggedInUser,
setLoggedInUser] =
useState(null);

const [showReceiptModal, setShowReceiptModal] =
  useState(false);

const [receiptData, setReceiptData] =
  useState(null);

const [corrections, setCorrections] = useState([]);
const [correctionPayment, setCorrectionPayment] = useState(null);
const [correctionAmount, setCorrectionAmount] = useState("");
const [correctionReason, setCorrectionReason] = useState("");
const [showCorrectionModal, setShowCorrectionModal] = useState(false);
const [rejectionCorrection, setRejectionCorrection] = useState(null);
const [rejectionReason, setRejectionReason] = useState("");
const [correctionStatusFilter, setCorrectionStatusFilter] = useState("");
const [correctionSearch, setCorrectionSearch] = useState("");
const [correctionCurrentPage, setCorrectionCurrentPage] = useState(1);
const CORRECTION_PAGE_SIZE = 10;

const receiptRef = useRef(null);

const location = useLocation();



const dueId =
  location.state?.dueId;

const fetchLoggedInUser =
async () => {

  const user =
    await getLoggedInUser();

  setLoggedInUser(user);

};

useEffect(() => {

  fetchLoggedInUser();

}, []);

useEffect(() => {

  console.log(
    "Received Due Id:",
    dueId
  );

}, [dueId]);

useEffect(() => {

  loadDueFromNavigation();

}, [dueId]);

useEffect(() => {

  if (!loggedInUser) return;

  fetchAcademies();
  fetchPayments();
  fetchCorrections();

}, [loggedInUser]);

useEffect(() => {

  if (!collectionAcademy) {
    setCenters([]);
    setCollectionCenter("");
    setBatches([]);
    setCollectionBatch("");
    setPlayers([]);
    setCollectionPlayer("");
    setDues([]);
    setSelectedDue("");
    setSelectedDueData(null);
    return;
  }

  setCollectionCenter("");
  setCollectionBatch("");
  setCollectionPlayer("");
  setBatches([]);
  setPlayers([]);
  setDues([]);
  setSelectedDue("");
  setSelectedDueData(null);

  fetchCenters(collectionAcademy);

}, [collectionAcademy]);

useEffect(() => {
  let filtered = payments || [];

  if (historyAcademy) filtered = filtered.filter(payment => payment.players?.academy_id === historyAcademy);
  if (historyCenter) filtered = filtered.filter(payment => payment.players?.center_id === historyCenter);
  if (historyBatch) filtered = filtered.filter(payment => payment.players?.batch_id === historyBatch);
  if (historyPlayer) filtered = filtered.filter(payment => payment.players?.id === historyPlayer);
  if (historySearch.trim()) {
    const search = historySearch.trim().toLowerCase();
    filtered = filtered.filter(payment =>
      String(payment.players?.full_name || "").toLowerCase().includes(search) ||
      String(payment.transaction_reference || "").toLowerCase().includes(search) ||
      String(payment.receipt_number || "").toLowerCase().includes(search)
    );
  }
  if (historyPaymentMode) filtered = filtered.filter(payment => payment.payment_mode === historyPaymentMode);
  if (historyFromDate) filtered = filtered.filter(payment => payment.payment_date?.substring(0, 10) >= historyFromDate);
  if (historyToDate) filtered = filtered.filter(payment => payment.payment_date?.substring(0, 10) <= historyToDate);

  setFilteredPayments(filtered);
}, [
  payments,
  historyAcademy,
  historyCenter,
  historyBatch,
  historyPlayer,
  historySearch,
  historyPaymentMode,
  historyFromDate,
  historyToDate
]);

useEffect(() => {
  setHistoryCurrentPage(1);
}, [
  historyAcademy,
  historyCenter,
  historyBatch,
  historyPlayer,
  historySearch,
  historyPaymentMode,
  historyFromDate,
  historyToDate
]);

const fetchAcademies = async () => {

  if (!loggedInUser) return;

  if (isSuperAdmin(loggedInUser)) {

    const { data } =
      await supabase
        .from("academies")
        .select("id, academy_name")
        .order("academy_name");

    setAcademies(data || []);

  } else {

    const academyId =
      getAcademyId(loggedInUser);

    const { data } =
      await supabase
        .from("academies")
        .select("id, academy_name")
        .eq("id", academyId);

    setAcademies(data || []);

    if (data?.length > 0) {

      setCollectionAcademy(data[0].id);

    }

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

    return [];

} else {

    console.log(
        "Loaded Centers:",
        data
    );

    setCenters(data);

    return data;

}
};

const fetchBatches = async (centerId) => {

    const { data, error } = await supabase

        .from("batches")

        .select(`
            id,
            batch_name
        `)

        .eq("center_id", centerId)

        .order("batch_name");

if (error) {

    console.log(error);

    return [];

} else {

    console.log(
        "Loaded Batches:",
        data
    );

    setBatches(data);

    return data;

}

};

const fetchPlayers = async (batchId) => {

      console.log(
        "fetchPlayers called with:",
        batchId
    );
  const { data, error } = await supabase
    .from("players")
    .select(`
      id,
      full_name
    `)
    .eq("batch_id", batchId)
      .eq("is_active", true)
    .order("full_name");
  
    console.log(
    "Running player query..."
);
if (error) {

    console.log(error);

    return [];

} else {

    console.log(
        "Loaded Players:",
        data
    );

    setPlayers(data);

    return data;

}
};

const fetchPendingDues =
async (
  playerId = null
) => {

let query =
  supabase
    .from("payment_dues")
.select(`
  id,
  player_id,
  due_type,
  due_date,
  total_amount,
  paid_amount,
  remaining_amount,
  due_status,

  players (
    full_name
  )
`)

      .neq("due_status", "paid");
console.log(
  "SELECTED PLAYER:",
  playerId
);
      if (playerId) {

  query =
    query.eq(
      "player_id",
      playerId
    );

}

const { data, error } =
  await query;

  console.log(
  "QUERY RESULT:",
  data
);

if (error) {

    console.log(error);

    return [];

} else {

    console.log(
        "Pending Dues:",
        data
    );

    setDues(data);

    return data;

}
  };



const loadDueFromNavigation = async () => {

  if (!dueId) return;

  const { data, error } =
    await supabase
      .from("payment_dues")
      .select(`
        *,
        players(
          id,
          academy_id,
          center_id,
          batch_id,
          full_name
        )
      `)
      .eq("id", dueId)
      .single();

  if (error) {

    console.log(error);
    return;

  }

  console.log("Loaded Due:", data);

// Academy

setCollectionAcademy(
    data.players.academy_id
);

await fetchCenters(
    data.players.academy_id
);

// Center

setCollectionCenter(
    data.players.center_id
);

await fetchBatches(
    data.players.center_id
);

// Batch

setCollectionBatch(
    data.players.batch_id
);

await fetchPlayers(
    data.players.batch_id
);

// Player

setCollectionPlayer(
    data.player_id
);

await fetchPendingDues(
    data.player_id
);

setSelectedDue(
    data.id
);

setSelectedDueData(
    data
);

};


const fetchPayments = async () => {

  let query = supabase
    .from("payments")
    .select(`
      id,
      player_id,
      amount_paid,
      payment_mode,
      transaction_reference,
      receipt_number,
      payment_entry_type,
      related_payment_id,
      payment_date,

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
    `)
    .order("payment_date", {
      ascending: false
    });

  const { data, error } =
    await query;

  if (error) {

    console.log(error);

  } else {

    let filteredData =
      data || [];

    if (loggedInUser) {

      if (!isSuperAdmin(loggedInUser)) {

        filteredData =
          filteredData.filter(
            payment =>
              payment.players?.academy_id ===
              loggedInUser.academy_id
          );

      }

    }

    setPayments(filteredData);

    setFilteredPayments(
      filteredData
    );

  }

};

const fetchCorrections = async () => {
  const { data, error } = await supabase
    .from("payment_corrections")
    .select(`
      id,
      payment_id,
      due_id,
      player_id,
      original_amount,
      corrected_amount,
      adjustment_amount,
      reason,
      status,
      requested_by,
      requested_at,
      approved_by,
      approved_at,
      rejection_reason,
      players ( id, full_name ),
      payments ( transaction_reference, receipt_number, payment_date )
    `)
    .order("requested_at", { ascending: false });
  if (error) { console.log(error); return; }
  setCorrections(data || []);
};

const filteredCorrections = corrections.filter((correction) => {
  if (correctionStatusFilter && correction.status !== correctionStatusFilter) return false;
  if (correctionSearch.trim()) {
    const search = correctionSearch.trim().toLowerCase();
    const player = String(correction.players?.full_name || "").toLowerCase();
    const reference = String(correction.payments?.transaction_reference || "").toLowerCase();
    const receipt = String(correction.payments?.receipt_number || "").toLowerCase();
    if (!player.includes(search) && !reference.includes(search) && !receipt.includes(search)) return false;
  }
  return true;
});

const correctionTotalPages = Math.max(1, Math.ceil(filteredCorrections.length / CORRECTION_PAGE_SIZE));
const paginatedCorrections = filteredCorrections.slice(
  (correctionCurrentPage - 1) * CORRECTION_PAGE_SIZE,
  correctionCurrentPage * CORRECTION_PAGE_SIZE
);

const pendingCorrectionCount = corrections.filter((correction) => correction.status === "pending").length;
const approvedCorrectionCount = corrections.filter((correction) => correction.status === "approved").length;
const rejectedCorrectionCount = corrections.filter((correction) => correction.status === "rejected").length;

useEffect(() => {
  setCorrectionCurrentPage(1);
}, [correctionStatusFilter, correctionSearch]);

const resetCollectionForm = () => {

  setCollectionAcademy("");

  setCollectionCenter("");

  setCollectionBatch("");

  setCollectionPlayer("");

  setSelectedDue("");

  setSelectedDueData(null);

  setAmountPaid("");

  setPaymentMode("");


  setCenters([]);

  setBatches([]);

  setPlayers([]);

  setDues([]);

};

  const collectPayment = async () => {
    if (!selectedDue || !amountPaid || !paymentMode) {
      alert("Please fill all fields");
      return;
    }

    const paymentAmount = Number(amountPaid);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      alert("Payment amount must be greater than zero.");
      return;
    }

    const remainingDue = Number(selectedDueData?.remaining_amount || 0);
    if (!remainingDue) {
      alert("The selected due has no remaining balance.");
      return;
    }

    if (paymentAmount > remainingDue) {
      alert(`Payment amount cannot exceed the remaining due of ₹${remainingDue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
      return;
    }

    const { data, error } = await supabase.rpc("collect_payment", {
      p_due_id: selectedDue,
      p_amount: paymentAmount,
      p_payment_mode: paymentMode,
      p_remarks: null
    });

    if (error) {
      alert(error.message);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result) {
      alert("Payment collection did not return a payment result.");
      return;
    }

    const collectionAcademyName = academies.find(a => a.id === collectionAcademy)?.academy_name;
    const collectionCenterName = centers.find(c => c.id === collectionCenter)?.center_name;
    const collectionBatchName = batches.find(b => b.id === collectionBatch)?.batch_name;

    setReceiptData({
      receiptNumber: result.receipt_number,
      player: selectedDueData?.players?.full_name || "-", 
      academy: collectionAcademyName,
      center: collectionCenterName,
      batch: collectionBatchName,
      amountPaid: result.amount_paid,
      paymentMode: result.payment_mode,
      transactionReference: result.transaction_reference,
      dueType: selectedDueData?.due_type || "-",
      dueDate: selectedDueData?.due_date || "-",
      totalDue: selectedDueData?.total_amount,
      paidBefore: selectedDueData?.paid_amount,
      remainingAmount: result.remaining_amount,
      balanceStatus: Number(result.remaining_amount || 0) > 0 ? "Partially Paid" : "Fully Paid",
      paymentDate: new Date(result.payment_date).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric"
      })
    });

    setShowReceiptModal(true);

    const playerId = selectedDueData?.player_id;
    resetCollectionForm();
    await fetchPendingDues(playerId);
    await fetchPayments();
    await fetchCorrections();
  };

const openCorrectionModal = (payment) => {
  setCorrectionPayment(payment);
  setCorrectionAmount(String(payment.amount_paid ?? ""));
  setCorrectionReason("");
  setShowCorrectionModal(true);
};

const closeCorrectionModal = () => {
  setShowCorrectionModal(false);
  setCorrectionPayment(null);
  setCorrectionAmount("");
  setCorrectionReason("");
};

const requestCorrection = async () => {
  if (!correctionPayment) return;
  const correctedAmount = Number(correctionAmount);
  if (!Number.isFinite(correctedAmount) || correctedAmount <= 0) {
    alert("Corrected amount must be greater than zero.");
    return;
  }
  if (correctionReason.trim().length < 5) {
    alert("Please provide a correction reason of at least 5 characters.");
    return;
  }
  const { error } = await supabase.rpc("request_payment_correction", {
    p_payment_id: correctionPayment.id,
    p_corrected_amount: correctedAmount,
    p_reason: correctionReason.trim()
  });
  if (error) { alert(error.message); return; }
  alert("Payment correction request submitted.");
  closeCorrectionModal();
  await fetchCorrections();
};

const approveCorrection = async (correctionId) => {
  if (!window.confirm("Approve this payment correction? This will create an adjustment ledger entry and update the due.")) return;
  const { data, error } = await supabase.rpc("approve_payment_correction", { p_correction_id: correctionId });
  if (error) { alert(error.message); return; }
  const result = Array.isArray(data) ? data[0] : data;
  setCorrections(prev =>
    prev.map(correction =>
      correction.id === correctionId
        ? { ...correction, status: "approved", approved_at: new Date().toISOString() }
        : correction
    )
  );
  alert(result ? `Correction approved. Adjustment reference: ${result.transaction_reference}` : "Correction approved.");
  await fetchCorrections();
  await fetchPayments();
};

const openRejectionModal = (correction) => {
  setRejectionCorrection(correction);
  setRejectionReason("");
};

const closeRejectionModal = () => {
  setRejectionCorrection(null);
  setRejectionReason("");
};

const rejectCorrection = async () => {
  if (!rejectionCorrection) return;
  if (rejectionReason.trim().length < 5) {
    alert("Please provide a rejection reason of at least 5 characters.");
    return;
  }
  const { error } = await supabase.rpc("reject_payment_correction", {
    p_correction_id: rejectionCorrection.id,
    p_rejection_reason: rejectionReason.trim()
  });
  if (error) { alert(error.message); return; }
  setCorrections(prev =>
    prev.map(correction =>
      correction.id === rejectionCorrection.id
        ? {
            ...correction,
            status: "rejected",
            rejection_reason: rejectionReason.trim()
          }
        : correction
    )
  );
  alert("Payment correction rejected.");
  closeRejectionModal();
  await fetchCorrections();
};

const printReceipt = () => {
  console.log("Print button clicked");
  console.log(receiptRef.current);
const printContents = `

<div
style="padding:40px;
font-family:Arial;">

<h1
style="
text-align:center;
margin-bottom:5px;">
AcadPro
</h1>

<h2
style="
text-align:center;
margin-top:0;">
PAYMENT RECEIPT
</h2>

<hr>

<p>
<strong>
Receipt Number:
</strong>

${receiptData.receiptNumber}
</p>

<p>
<strong>
Date:
</strong>

${receiptData.paymentDate}
</p>

<br>

<p>
<strong>
Player:
</strong>

${receiptData.player}
</p>

<p>
<strong>
Academy:
</strong>

${receiptData.academy}
</p>

<p>
<strong>
Center:
</strong>

${receiptData.center}
</p>

<p>
<strong>
Batch:
</strong>

${receiptData.batch}
</p>

<br>

<p>
<strong>
Due Type:
</strong>

${receiptData.dueType || "-"}
</p>

<p>
<strong>
Due Date:
</strong>

${receiptData.dueDate || "-"}
</p>

<p>
<strong>
Payment Mode:
</strong>

${receiptData.paymentMode}
</p>

<p>
<strong>
Reference:
</strong>

${receiptData.transactionReference || "-"}
</p>

<hr>

<h3>

Amount Paid :
₹${receiptData.amountPaid}

</h3>

<h3>

Remaining :
₹${receiptData.remainingAmount}

</h3>

<p>
<strong>
Collection Status:
</strong>

${receiptData.balanceStatus || "-"}
</p>

<hr>

<div
style="
margin-top:80px;
display:flex;
justify-content:space-between;
">

<div>

____________________

<br>

Received By

</div>

<div>

____________________

<br>

Parent Signature

</div>

</div>

<br><br>

<center>

Thank you for your payment.

</center>

</div>

`;
 console.log(printContents);
  const printWindow =
    window.open(
      "",
      "",
      "width=700,height=800"
    );
  console.log(printWindow);
  printWindow.document.write(`

    <html>

      <head>

        <title>
          Payment Receipt
        </title>

        <style>

body{
    font-family: Arial, sans-serif;
    padding: 40px;
    max-width: 700px;
    margin: 0 auto;
}

          h2{

            text-align:center;

          }

          p{

            font-size:16px;

            margin:10px 0;

          }

          strong{

            display:inline-block;

            width:150px;

          }

        </style>

      </head>

      <body>

        ${printContents}

      </body>

    </html>

  `);

printWindow.document.close();

printWindow.onload = () => {

  printWindow.focus();

  printWindow.print();

  printWindow.onafterprint = () => {

    printWindow.close();

  };

};

};

return (
  <Layout>
    <div className="payment-collections-page">
      <div className="payment-page-header">
        <div>
          <div className="payment-page-eyebrow">Finance</div>
          <h1>Payment Collections</h1>
          <p>Collect pending dues, review payment history and manage correction requests.</p>
        </div>
        <div className="payment-page-summary">
          <span className="payment-summary-label">History records</span>
          <strong>{filteredPayments.length}</strong>
        </div>
      </div>

      <section className="payment-card">
        <div className="payment-card-header">
          <div>
            <h2>Collect Payment</h2>
            <p>Select the player and pending due, then record the payment.</p>
          </div>
        </div>

        <div className="payment-form-grid">
          <label className="payment-field"><span>Academy</span><select value={collectionAcademy} onChange={(e) => { const academyId=e.target.value; setCollectionAcademy(academyId); setCollectionCenter(""); setCollectionBatch(""); setCollectionPlayer(""); setCenters([]); setBatches([]); setPlayers([]); setDues([]); setSelectedDue(""); setSelectedDueData(null); }}><option value="">Select Academy</option>{academies.map((academy)=><option key={academy.id} value={academy.id}>{academy.academy_name}</option>)}</select></label>
          <label className="payment-field"><span>Center</span><select value={collectionCenter} onChange={(e) => { const centerId=e.target.value; setCollectionCenter(centerId); setCollectionBatch(""); setCollectionPlayer(""); setSelectedDue(""); setSelectedDueData(null); setBatches([]); setPlayers([]); setDues([]); if(centerId) fetchBatches(centerId); }}><option value="">Select Center</option>{centers.map((center)=><option key={center.id} value={center.id}>{center.center_name}</option>)}</select></label>
          <label className="payment-field"><span>Batch</span><select value={collectionBatch} onChange={(e) => { const batchId=e.target.value; setCollectionBatch(batchId); setCollectionPlayer(""); setSelectedDue(""); setSelectedDueData(null); setPlayers([]); setDues([]); if(batchId) fetchPlayers(batchId); }}><option value="">Select Batch</option>{batches.map((batch)=><option key={batch.id} value={batch.id}>{batch.batch_name}</option>)}</select></label>
          <label className="payment-field"><span>Player</span><select value={collectionPlayer} onChange={(e)=>setCollectionPlayer(e.target.value)}><option value="">Select Player</option>{players.map((player)=><option key={player.id} value={player.id}>{player.full_name}</option>)}</select></label>

          <label className="payment-field payment-field-wide"><span>Pending Due</span>
            <select value={selectedDue} onChange={(e)=>{const dueId=e.target.value; setSelectedDue(dueId); const dueData=dues.find((due)=>due.id===dueId); setSelectedDueData(dueData); setAmountPaid(dueData ? dueData.remaining_amount : ""); setPaymentMode("");}}>
              <option value="">{dues.length===0 ? "No Pending Dues" : "Select Pending Due"}</option>
              {dues.map((due)=><option key={due.id} value={due.id}>{String(due.due_type || "Due").replace(/_/g, " ")} · {due.due_date} · Remaining ₹{Number(due.remaining_amount || 0).toLocaleString("en-IN")}</option>)}
            </select>
          </label>

          {selectedDueData && (
            <div className="payment-due-summary" aria-live="polite">
              <div className="payment-due-summary-heading">
                <div>
                  <span>Selected Due</span>
                  <strong>{String(selectedDueData.due_type || "Due").replace(/_/g, " ")} · {selectedDueData.due_date || "—"}</strong>
                </div>
                <span className={selectedDueData.due_status === "partial" ? "payment-status-badge payment-status-partial" : "payment-status-badge payment-status-pending"}>
                  {selectedDueData.due_status === "partial" ? "Partial" : "Pending"}
                </span>
              </div>
              <div className="payment-due-summary-grid">
                <div><span>Total Due</span><strong>₹{Number(selectedDueData.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
                <div><span>Already Paid</span><strong>₹{Number(selectedDueData.paid_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
                <div><span>Remaining</span><strong>₹{selectedDueRemaining.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
              </div>
            </div>
          )}

          <label className="payment-field"><span>Amount Paid</span><input type="number" min="0.01" step="0.01" max={selectedDueRemaining || undefined} placeholder={selectedDueRemaining ? `Max ₹${selectedDueRemaining}` : "Amount Paid"} value={amountPaid} onChange={(e)=>setAmountPaid(e.target.value)} aria-invalid={amountPaid && !isPaymentAmountValid} /></label>
          <label className="payment-field"><span>Payment Mode</span><select value={paymentMode} onChange={(e)=>setPaymentMode(e.target.value)}><option value="">Select Payment Mode</option><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank_transfer">Bank Transfer</option></select></label>
        </div>

        <div className="payment-form-footer">
          <div className="payment-helper-text">
            {!selectedDueData && "Select a pending due to continue."}
            {selectedDueData && !amountPaid && "Enter the amount to collect."}
            {selectedDueData && amountPaid && !isPaymentAmountValid && "Amount must be greater than ₹0 and cannot exceed the remaining due."}
            {selectedDueData && isPaymentAmountValid && (
              <span>Remaining after this payment: <strong>₹{remainingAfterPayment.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
            )}
          </div>
          <button type="button" className="payment-primary-button" onClick={collectPayment} disabled={!selectedDue || !isPaymentAmountValid || !paymentMode}>Collect Payment</button>
        </div>
      </section>

      <section className="payment-card">
        <div className="payment-card-header payment-list-header">
          <div><h2>Payments History</h2><p>Review immutable payment and adjustment ledger entries.</p><div className="payment-history-summary"><span>{filteredPayments.length} record{filteredPayments.length === 1 ? "" : "s"}</span><span>Payments ₹{historyPaymentsTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><span>Adjustments ₹{historyAdjustmentsTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><span>Net Ledger ₹{historyNetTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div></div>
          <div className="payment-history-search-row">
            <label className="payment-filter-field payment-history-search-field"><span>Search Player / Reference / Receipt</span><input type="search" value={historySearch} placeholder="Search player, TXN or receipt number..." onChange={(e)=>setHistorySearch(e.target.value)} /></label>
            {historySearch && <button type="button" className="payment-secondary-button payment-search-clear-button" onClick={()=>setHistorySearch("")}>Clear Search</button>}
          </div>
          <div className="payment-history-filter-grid">
            <label className="payment-filter-field"><span>Academy</span><select value={historyAcademy} onChange={(e)=>{setHistoryAcademy(e.target.value);setHistoryCenter("");setHistoryBatch("");setHistoryPlayer("");}}><option value="">All Academies</option>{historyFilterOptions.academies.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
            <label className="payment-filter-field"><span>Center</span><select value={historyCenter} onChange={(e)=>{setHistoryCenter(e.target.value);setHistoryBatch("");setHistoryPlayer("");}}><option value="">All Centers</option>{historyFilterOptions.centers.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
            <label className="payment-filter-field"><span>Batch</span><select value={historyBatch} onChange={(e)=>{setHistoryBatch(e.target.value);setHistoryPlayer("");}}><option value="">All Batches</option>{historyFilterOptions.batches.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
            <label className="payment-filter-field"><span>Player</span><select value={historyPlayer} onChange={(e)=>setHistoryPlayer(e.target.value)}><option value="">All Players</option>{historyFilterOptions.players.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
            <label className="payment-filter-field"><span>Mode</span><select value={historyPaymentMode} onChange={(e)=>setHistoryPaymentMode(e.target.value)}><option value="">All Modes</option><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank_transfer">Bank Transfer</option></select></label>
            <label className="payment-filter-field"><span>From</span><input type="date" value={historyFromDate} max={historyToDate || undefined} onChange={(e)=>setHistoryFromDate(e.target.value)} /></label>
            <label className="payment-filter-field"><span>To</span><input type="date" value={historyToDate} min={historyFromDate || undefined} onChange={(e)=>setHistoryToDate(e.target.value)} /></label>
            <button type="button" className="payment-secondary-button payment-filter-reset-button" onClick={resetHistoryFilters} disabled={!historyAcademy && !historyCenter && !historyBatch && !historyPlayer && !historySearch && !historyPaymentMode && !historyFromDate && !historyToDate}>Reset Filters</button>
          </div>
        </div>

        {filteredPayments.length===0 ? (
          <div className="payment-empty-state"><div className="payment-empty-icon">₹</div><h3>No payment history found</h3><p>Adjust the player, payment mode or date filters to view ledger entries.</p></div>
        ) : (
          <div className="payment-table-wrapper">
            <table className="payment-data-table">
              <caption className="sr-only">Payment ledger history and available correction actions</caption>
              <thead><tr>
                {isSuperAdmin(loggedInUser) && <th scope="col">Academy</th>}
                <th scope="col">Center</th><th scope="col">Batch</th><th scope="col">Player</th><th scope="col">Amount</th><th scope="col">Mode</th><th scope="col">Reference</th><th scope="col">Receipt</th><th scope="col">Entry</th><th scope="col">Payment Date</th><th scope="col">Actions</th>
              </tr></thead>
              <tbody>{paginatedPayments.map((payment)=><tr key={payment.id}>
                {isSuperAdmin(loggedInUser) && <td>{payment.players?.academies?.academy_name || "-"}</td>}
                <td>{payment.players?.centers?.center_name || "-"}</td>
                <td>{payment.players?.batches?.batch_name || "-"}</td>
                <td className="payment-player-cell">{payment.players?.full_name || "-"}</td>
                <td className="payment-amount-cell">₹{Number(payment.amount_paid || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td><span className="payment-type-badge">{String(payment.payment_mode || "-").replace(/_/g, " ")}</span></td>
                <td><span className="payment-reference-cell">{payment.transaction_reference || "-"}</span></td>
                <td><span className="payment-reference-cell">{payment.receipt_number || "-"}</span></td>
                <td><span className={`payment-entry-badge payment-entry-${payment.payment_entry_type}`}>{payment.payment_entry_type === "adjustment" ? "Adjustment" : "Payment"}</span></td>
                <td>{new Date(payment.payment_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                <td>{payment.payment_entry_type==="payment" && <button type="button" className="payment-text-button" onClick={()=>openCorrectionModal(payment)}>Request Correction</button>}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}

        {filteredPayments.length > 0 && (
          <div className="payment-pagination">
            <span>Showing {Math.min((historyCurrentPage - 1) * HISTORY_PAGE_SIZE + 1, filteredPayments.length)}–{Math.min(historyCurrentPage * HISTORY_PAGE_SIZE, filteredPayments.length)} of {filteredPayments.length}</span>
            <div className="payment-pagination-controls">
              <button type="button" onClick={() => setHistoryCurrentPage(page => Math.max(1, page - 1))} disabled={historyCurrentPage === 1}>Previous</button>
              <strong>Page {historyCurrentPage} of {historyTotalPages}</strong>
              <button type="button" onClick={() => setHistoryCurrentPage(page => Math.min(historyTotalPages, page + 1))} disabled={historyCurrentPage === historyTotalPages}>Next</button>
            </div>
          </div>
        )}
      </section>

      <section className="payment-card payment-corrections-card">
        <div className="payment-card-header payment-list-header">
          <div>
            <h2>Payment Corrections</h2>
            <p>Correction requests preserve the original ledger entry and follow the approval workflow.</p>
            <div className="payment-history-summary">
              <span>{pendingCorrectionCount} pending</span>
              <span>{approvedCorrectionCount} approved</span>
              <span>{rejectedCorrectionCount} rejected</span>
            </div>
          </div>
          <span className="payment-count-badge">{corrections.length} requests</span>
        </div>

        <div className="payment-correction-toolbar">
          <label className="payment-filter-field payment-correction-search">
            <span>Search Player / Reference / Receipt</span>
            <input type="search" value={correctionSearch} placeholder="Search correction requests..." onChange={(e)=>setCorrectionSearch(e.target.value)} />
          </label>
          <label className="payment-filter-field payment-correction-status">
            <span>Status</span>
            <select value={correctionStatusFilter} onChange={(e)=>setCorrectionStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
          {(correctionSearch || correctionStatusFilter) && (
            <button type="button" className="payment-secondary-button" onClick={()=>{setCorrectionSearch("");setCorrectionStatusFilter("");}}>
              Reset
            </button>
          )}
        </div>

        {filteredCorrections.length===0 ? (
          <div className="payment-empty-state">
            <div className="payment-empty-icon">{corrections.length ? "⌕" : "✓"}</div>
            <h3>{corrections.length ? "No matching correction requests" : "No correction requests"}</h3>
            <p>{corrections.length ? "Try a different player, reference, receipt or status filter." : "Payment correction requests will appear here when submitted."}</p>
          </div>
        ) : (
          <div className="payment-table-wrapper">
            <table className="payment-data-table payment-corrections-table">
              <caption className="sr-only">Payment correction requests and approval actions</caption>
              <thead><tr><th scope="col">Player</th><th scope="col">Original</th><th scope="col">Corrected</th><th scope="col">Adjustment</th><th scope="col">Reason</th><th scope="col">Status</th><th scope="col">Requested</th>{(isSuperAdmin(loggedInUser)||loggedInUser?.role==="academy_owner")&&<th scope="col">Actions</th>}</tr></thead>
              <tbody>{paginatedCorrections.map((correction)=><tr key={correction.id}>
                <td className="payment-player-cell">{correction.players?.full_name || "-"}</td>
                <td>₹{correction.original_amount}</td><td>₹{correction.corrected_amount}</td><td>₹{correction.adjustment_amount}</td>
                <td className="payment-reason-cell">{correction.reason}</td>
                <td><span className={`payment-status-badge payment-status-${correction.status}`}>{correction.status}</span></td>
                <td>{new Date(correction.requested_at).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })}</td>
                {(isSuperAdmin(loggedInUser)||loggedInUser?.role==="academy_owner")&&<td><div className="payment-action-group">{correction.status==="pending"&&<><button type="button" className="payment-primary-button payment-small-button" onClick={()=>approveCorrection(correction.id)}>Approve</button><button type="button" className="payment-danger-button" onClick={()=>openRejectionModal(correction)}>Reject</button></>}{correction.status==="rejected"&&<span className="payment-rejection-text">{correction.rejection_reason}</span>}</div></td>}
              </tr>)}</tbody>
            </table>
          </div>
        )}

        {filteredCorrections.length > 0 && (
          <div className="payment-pagination">
            <span>Showing {Math.min((correctionCurrentPage - 1) * CORRECTION_PAGE_SIZE + 1, filteredCorrections.length)}–{Math.min(correctionCurrentPage * CORRECTION_PAGE_SIZE, filteredCorrections.length)} of {filteredCorrections.length}</span>
            <div className="payment-pagination-controls">
              <button type="button" onClick={() => setCorrectionCurrentPage(page => Math.max(1, page - 1))} disabled={correctionCurrentPage === 1}>Previous</button>
              <strong>Page {correctionCurrentPage} of {correctionTotalPages}</strong>
              <button type="button" onClick={() => setCorrectionCurrentPage(page => Math.min(correctionTotalPages, page + 1))} disabled={correctionCurrentPage === correctionTotalPages}>Next</button>
            </div>
          </div>
        )}
      </section>>
    </div>

    {showCorrectionModal && correctionPayment && (
      <div className="payment-modal-overlay">
        <div className="payment-modal" role="dialog" aria-modal="true" aria-labelledby="correction-title">
          <div className="payment-modal-header"><div><div className="payment-page-eyebrow">Ledger control</div><h2 id="correction-title">Request Payment Correction</h2></div><button type="button" className="payment-modal-close" onClick={closeCorrectionModal} aria-label="Close correction dialog">×</button></div>
          <div className="payment-modal-body">
            <div className="payment-detail-row"><span>Player</span><strong>{correctionPayment.players?.full_name || "-"}</strong></div>
            <div className="payment-detail-row"><span>Original Amount</span><strong>₹{correctionPayment.amount_paid}</strong></div>
            <label className="payment-field"><span>Corrected Amount</span><input type="number" min="0.01" step="0.01" placeholder="Corrected Amount" value={correctionAmount} onChange={(e)=>setCorrectionAmount(e.target.value)} /></label>
            <label className="payment-field"><span>Correction Reason</span><textarea placeholder="Reason for correction" value={correctionReason} onChange={(e)=>setCorrectionReason(e.target.value)} rows="4" /></label>
          </div>
          <div className="payment-modal-footer"><button type="button" className="payment-primary-button" onClick={requestCorrection}>Submit Correction</button><button type="button" className="payment-secondary-button" onClick={closeCorrectionModal}>Cancel</button></div>
        </div>
      </div>
    )}

    {rejectionCorrection && (
      <div className="payment-modal-overlay">
        <div className="payment-modal" role="dialog" aria-modal="true" aria-labelledby="rejection-title">
          <div className="payment-modal-header"><div><div className="payment-page-eyebrow">Ledger control</div><h2 id="rejection-title">Reject Payment Correction</h2></div><button type="button" className="payment-modal-close" onClick={closeRejectionModal} aria-label="Close rejection dialog">×</button></div>
          <div className="payment-modal-body"><label className="payment-field"><span>Rejection Reason</span><textarea placeholder="Rejection reason" value={rejectionReason} onChange={(e)=>setRejectionReason(e.target.value)} rows="4" /></label></div>
          <div className="payment-modal-footer"><button type="button" className="payment-danger-button" onClick={rejectCorrection}>Reject Correction</button><button type="button" className="payment-secondary-button" onClick={closeRejectionModal}>Cancel</button></div>
        </div>
      </div>
    )}

    {showReceiptModal && receiptData && (
      <div className="receipt-modal-overlay">
        <div className="receipt-modal" ref={receiptRef}>
          <div className="receipt-modal-header"><div><div className="payment-page-eyebrow">Payment completed</div><h2>Payment Receipt</h2><p>Official AcadPro payment acknowledgement</p></div><span className={`receipt-status-badge ${receiptData.balanceStatus === "Fully Paid" ? "receipt-status-paid" : "receipt-status-partial"}`}>{receiptData.balanceStatus}</span></div>
          <div className="receipt-detail-grid">
            <p><strong>Receipt Number</strong><span>{receiptData.receiptNumber}</span></p>
            <p><strong>Player</strong><span>{receiptData.player}</span></p>
            <p><strong>Academy</strong><span>{receiptData.academy || "-"}</span></p>
            <p><strong>Center</strong><span>{receiptData.center || "-"}</span></p>
            <p><strong>Batch</strong><span>{receiptData.batch || "-"}</span></p>
            <p className="receipt-amount-highlight"><strong>Amount Paid</strong><span>₹{Number(receiptData.amountPaid || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
            <p><strong>Due Type</strong><span>{String(receiptData.dueType || "-").replace(/_/g, " ")}</span></p>
            <p><strong>Due Date</strong><span>{receiptData.dueDate || "-"}</span></p>
            <p><strong>Payment Mode</strong><span>{receiptData.paymentMode}</span></p>
            <p><strong>Reference</strong><span>{receiptData.transactionReference || "N/A"}</span></p>
            <p className="receipt-amount-highlight"><strong>Remaining Balance</strong><span>₹{Number(receiptData.remainingAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
            <p className="receipt-balance-status"><strong>Collection Status</strong><span>{receiptData.balanceStatus}</span></p>
            <p><strong>Date</strong><span>{receiptData.paymentDate}</span></p>
          </div>
          <div className="receipt-modal-actions"><button type="button" className="payment-primary-button" onClick={printReceipt}>Print Receipt</button><button type="button" className="payment-secondary-button" onClick={()=>setShowReceiptModal(false)}>Close</button></div>
        </div>
      </div>
    )}
  </Layout>
);
}

export default PaymentCollections;