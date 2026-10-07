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

const [showCollectionModal, setShowCollectionModal] = useState(false);

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


  setShowCollectionModal(true);
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

const openCollectionModal = () => setShowCollectionModal(true);
const closeCollectionModal = () => {
  setShowCollectionModal(false);
  resetCollectionForm();
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

    setShowCollectionModal(false);
    setShowReceiptModal(true);

    const playerId = selectedDueData?.player_id;
    resetCollectionForm();
    await fetchPendingDues(playerId);
    await fetchPayments();
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
          <p>Collect pending dues and review payment history.</p>
        </div>
        <div className="payment-page-summary">
          <span className="payment-summary-label">History records</span>
          <strong>{filteredPayments.length}</strong>
        </div>
      </div>

      <section className="payment-card">
        <div className="payment-list-heading payment-history-heading">
          <div>
            <div className="payment-section-kicker">Payment Ledger</div>
            <h2>Payments History</h2>
            <p>Review immutable payment and adjustment ledger entries.</p>
            <div className="payment-history-summary"><span>{filteredPayments.length} record{filteredPayments.length === 1 ? "" : "s"}</span><span>Payments ₹{historyPaymentsTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><span>Adjustments ₹{historyAdjustmentsTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><span>Net Ledger ₹{historyNetTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
          </div>
          <div className="payment-history-top-controls"><button type="button" className="payment-primary-button payment-collect-trigger" onClick={openCollectionModal}>+ Collect Payment</button>
            
            <label className="payment-filter-field payment-history-search-field"><span>Search</span><input type="search" value={historySearch} placeholder="Player, TXN or receipt..." onChange={(e)=>setHistorySearch(e.target.value)} /></label>
            <button type="button" className="payment-clear-filters" onClick={resetHistoryFilters} disabled={!historyAcademy && !historyCenter && !historyBatch && !historyPlayer && !historySearch && !historyPaymentMode && !historyFromDate && !historyToDate}>Clear filters</button>
          </div>
        </div>
        <div className="payment-list-controls payment-history-controls">
          <label className="payment-filter-field"><span>Academy</span><select value={historyAcademy} onChange={(e)=>{setHistoryAcademy(e.target.value);setHistoryCenter("");setHistoryBatch("");setHistoryPlayer("");}}><option value="">All</option>{historyFilterOptions.academies.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
          <label className="payment-filter-field"><span>Center</span><select value={historyCenter} onChange={(e)=>{setHistoryCenter(e.target.value);setHistoryBatch("");setHistoryPlayer("");}}><option value="">All</option>{historyFilterOptions.centers.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
          <label className="payment-filter-field"><span>Batch</span><select value={historyBatch} onChange={(e)=>{setHistoryBatch(e.target.value);setHistoryPlayer("");}}><option value="">All</option>{historyFilterOptions.batches.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
          <label className="payment-filter-field"><span>Player</span><select value={historyPlayer} onChange={(e)=>setHistoryPlayer(e.target.value)}><option value="">All</option>{historyFilterOptions.players.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
          <label className="payment-filter-field"><span>Mode</span><select value={historyPaymentMode} onChange={(e)=>setHistoryPaymentMode(e.target.value)}><option value="">All</option><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank_transfer">Bank Transfer</option></select></label>
          <label className="payment-filter-field"><span>From</span><input type="date" value={historyFromDate} max={historyToDate || undefined} onChange={(e)=>setHistoryFromDate(e.target.value)} /></label>
          <label className="payment-filter-field"><span>To</span><input type="date" value={historyToDate} min={historyFromDate || undefined} onChange={(e)=>setHistoryToDate(e.target.value)} /></label>
        </div>
        {filteredPayments.length===0 ? (
          <div className="payment-empty-state"><div className="payment-empty-icon">₹</div><h3>No payment history found</h3><p>Adjust the player, payment mode or date filters to view ledger entries.</p></div>
        ) : (
          <div className="payment-table-wrapper">
            <table className="payment-data-table">
              <caption className="sr-only">Payment ledger history</caption>
              <thead><tr>
                {isSuperAdmin(loggedInUser) && <th scope="col">Academy</th>}
                <th scope="col">Center</th><th scope="col">Batch</th><th scope="col">Player</th><th scope="col">Amount</th><th scope="col">Mode</th><th scope="col">Reference</th><th scope="col">Receipt</th><th scope="col">Entry</th><th scope="col">Payment Date</th>
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

      {showCollectionModal && (
        <div className="payment-modal-overlay" onMouseDown={(e)=>{if(e.target===e.currentTarget) closeCollectionModal();}}>
          <div className="payment-modal payment-collection-modal" role="dialog" aria-modal="true" aria-labelledby="collect-payment-title">
            <div className="payment-modal-header">
              <div>
                <div className="payment-section-kicker">Payment Collection</div>
                <h2 id="collect-payment-title">Collect Payment</h2>
                <p className="payment-modal-description">Select a player and pending due, then record the payment.</p>
              </div>
              <button type="button" className="payment-modal-close" onClick={closeCollectionModal} aria-label="Close">×</button>
            </div>
            <div className="payment-modal-body payment-collection-modal-body">
              <div className="payment-form-grid payment-collection-modal-grid">
                <label className="payment-field"><span>Academy</span><select value={collectionAcademy} onChange={(e)=>{const academyId=e.target.value;setCollectionAcademy(academyId);setCollectionCenter("");setCollectionBatch("");setCollectionPlayer("");setCenters([]);setBatches([]);setPlayers([]);setDues([]);setSelectedDue("");setSelectedDueData(null);}}><option value="">Select Academy</option>{academies.map((academy)=><option key={academy.id} value={academy.id}>{academy.academy_name}</option>)}</select></label>
                <label className="payment-field"><span>Center</span><select value={collectionCenter} onChange={(e)=>{const centerId=e.target.value;setCollectionCenter(centerId);setCollectionBatch("");setCollectionPlayer("");setSelectedDue("");setSelectedDueData(null);setBatches([]);setPlayers([]);setDues([]);if(centerId)fetchBatches(centerId);}}><option value="">Select Center</option>{centers.map((center)=><option key={center.id} value={center.id}>{center.center_name}</option>)}</select></label>
                <label className="payment-field"><span>Batch</span><select value={collectionBatch} onChange={(e)=>{const batchId=e.target.value;setCollectionBatch(batchId);setCollectionPlayer("");setSelectedDue("");setSelectedDueData(null);setPlayers([]);setDues([]);if(batchId)fetchPlayers(batchId);}}><option value="">Select Batch</option>{batches.map((batch)=><option key={batch.id} value={batch.id}>{batch.batch_name}</option>)}</select></label>
                <label className="payment-field"><span>Player</span><select value={collectionPlayer} onChange={(e)=>setCollectionPlayer(e.target.value)}><option value="">Select Player</option>{players.map((player)=><option key={player.id} value={player.id}>{player.full_name}</option>)}</select></label>
                <label className="payment-field payment-field-wide"><span>Pending Due</span><select value={selectedDue} onChange={(e)=>{const dueId=e.target.value;setSelectedDue(dueId);const dueData=dues.find(due=>due.id===dueId);setSelectedDueData(dueData);setAmountPaid(dueData?dueData.remaining_amount:"");setPaymentMode("");}}><option value="">{dues.length===0?"No Pending Dues":"Select Pending Due"}</option>{dues.map(due=><option key={due.id} value={due.id}>{String(due.due_type||"Due").replace(/_/g," ")} · {due.due_date} · Remaining ₹{Number(due.remaining_amount||0).toLocaleString("en-IN")}</option>)}</select></label>
                <label className="payment-field"><span>Amount Paid</span><input type="number" min="0.01" step="0.01" max={selectedDueRemaining||undefined} placeholder={selectedDueRemaining?`Max ₹${selectedDueRemaining}`:"Amount Paid"} value={amountPaid} onChange={(e)=>setAmountPaid(e.target.value)} aria-invalid={amountPaid&&!isPaymentAmountValid}/></label>
                <label className="payment-field"><span>Payment Mode</span><select value={paymentMode} onChange={(e)=>setPaymentMode(e.target.value)}><option value="">Select Payment Mode</option><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank_transfer">Bank Transfer</option></select></label>
              </div>
              {selectedDueData && (
                <div className="payment-due-summary payment-collection-summary">
                  <div className="payment-due-summary-heading"><div><span>Selected Due</span><strong>{String(selectedDueData.due_type||"Due").replace(/_/g," ")} · {selectedDueData.due_date||"—"}</strong></div><span className={selectedDueData.due_status==="partial"?"payment-status-badge payment-status-partial":"payment-status-badge payment-status-pending"}>{selectedDueData.due_status==="partial"?"Partial":"Pending"}</span></div>
                  <div className="payment-due-summary-grid"><div><span>Total Due</span><strong>₹{Number(selectedDueData.total_amount||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div><div><span>Already Paid</span><strong>₹{Number(selectedDueData.paid_amount||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div><div><span>Remaining</span><strong>₹{selectedDueRemaining.toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div></div>
                </div>
              )}
            </div>
            <div className="payment-modal-footer payment-collection-modal-footer">
              <div className="payment-helper-text">{!selectedDueData&&"Select a pending due to continue."}{selectedDueData&&!amountPaid&&"Enter the amount to collect."}{selectedDueData&&amountPaid&&!isPaymentAmountValid&&"Amount must be greater than ₹0 and cannot exceed the remaining due."}{selectedDueData&&isPaymentAmountValid&&<span>Remaining after payment: <strong>₹{remainingAfterPayment.toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></span>}</div>
              <div className="payment-modal-actions"><button type="button" className="payment-secondary-button" onClick={closeCollectionModal}>Cancel</button><button type="button" className="payment-primary-button" onClick={collectPayment} disabled={!selectedDue||!isPaymentAmountValid||!paymentMode}>Collect Payment</button></div>
            </div>
          </div>
        </div>
      )}

    </div>

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