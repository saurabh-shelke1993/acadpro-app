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

const [selectedAcademy,
  setSelectedAcademy] =
  useState("");

const [selectedCenter,
  setSelectedCenter] =
  useState("");

const [selectedBatch,
  setSelectedBatch] =
  useState("");

const [selectedPlayer,
  setSelectedPlayer] =
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

  const [filteredPayments,
  setFilteredPayments] =
  useState([]);

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

  let filtered =
    payments || [];

  if (selectedAcademy) {

    filtered =
      filtered.filter(
        payment =>
          payment.players?.academy_id ===
          selectedAcademy
      );

  }

  if (selectedCenter) {

    filtered =
      filtered.filter(
        payment =>
          payment.players?.center_id ===
          selectedCenter
      );

  }

  if (selectedBatch) {

    filtered =
      filtered.filter(
        payment =>
          payment.players?.batch_id ===
          selectedBatch
      );

  }

  if (selectedPlayer) {

    filtered =
      filtered.filter(
        payment =>
          payment.players?.id ===
          selectedPlayer
      );

  }

  if (historyPaymentMode) {

    filtered =
      filtered.filter(
        payment =>
          payment.payment_mode ===
          historyPaymentMode
      );

  }

  if (historyFromDate) {

    filtered =
      filtered.filter(
        payment =>
          payment.payment_date.substring(0,10)
          >= historyFromDate
      );

  }

  if (historyToDate) {

    filtered =
      filtered.filter(
        payment =>
          payment.payment_date.substring(0,10)
          <= historyToDate
      );

  }

  setFilteredPayments(
    filtered
  );

}, [

  payments,

  selectedAcademy,

  selectedCenter,

  selectedBatch,

  selectedPlayer,

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

      setSelectedAcademy(data[0].id);

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

setSelectedAcademy(
    data.players.academy_id
);

await fetchCenters(
    data.players.academy_id
);

// Center

setSelectedCenter(
    data.players.center_id
);

await fetchBatches(
    data.players.center_id
);

// Batch

setSelectedBatch(
    data.players.batch_id
);

await fetchPlayers(
    data.players.batch_id
);

// Player

setSelectedPlayer(
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

const resetCollectionForm = () => {

  setSelectedAcademy("");

  setSelectedCenter("");

  setSelectedBatch("");

  setSelectedPlayer("");

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

    const selectedAcademyName = academies.find(a => a.id === selectedAcademy)?.academy_name;
    const selectedCenterName = centers.find(c => c.id === selectedCenter)?.center_name;
    const selectedBatchName = batches.find(b => b.id === selectedBatch)?.batch_name;

    setReceiptData({
      receiptNumber: result.receipt_number,
      player: selectedDueData?.players?.full_name || "-", 
      academy: selectedAcademyName,
      center: selectedCenterName,
      batch: selectedBatchName,
      amountPaid: result.amount_paid,
      paymentMode: result.payment_mode,
      transactionReference: result.transaction_reference,
      remainingAmount: result.remaining_amount,
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

useEffect(() => {

  let filtered =
    payments || [];

  if (selectedPlayer) {

    filtered =
      filtered.filter(
        (payment) =>
          payment.player_id ===
          selectedPlayer
      );

  }

  setFilteredPayments(
    filtered
  );

}, [
  payments,
  selectedPlayer
]);

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
    <div style={{ padding: "20px" }}>
      <h1>Payment Collections</h1>

      <select
  value={selectedAcademy}
onChange={(e) => {

  const academyId = e.target.value;

  setSelectedAcademy(academyId);

  // Clear lower selections

  setSelectedCenter("");
  setSelectedBatch("");
  setSelectedPlayer("");

  setCenters([]);
  setBatches([]);
  setPlayers([]);
  setDues([]);

  setSelectedDue("");
  setSelectedDueData(null);

  // Load centers

  if (academyId) {

    fetchCenters(academyId);

  }

}}
>
  <option value="">
    Select Academy
  </option>

  {academies.map(
    (academy) => (
      <option
        key={academy.id}
        value={academy.id}
      >
        {academy.academy_name}
      </option>
    )
  )}
</select>

<br /><br />

<select
  value={selectedCenter}
onChange={(e) => {

    const centerId = e.target.value;

    setSelectedCenter(centerId);

    // Reset lower hierarchy

    setSelectedBatch("");

    setSelectedPlayer("");

    setSelectedDue("");

    setSelectedDueData(null);

    setBatches([]);

    setPlayers([]);

    setDues([]);

    if (centerId) {

        fetchBatches(centerId);

    }

}}
>
  <option value="">
    Select Center
  </option>

  {centers.map(
    (center) => (
      <option
        key={center.id}
        value={center.id}
      >
        {center.center_name}
      </option>
    )
  )}
</select>

<br /><br />

<select
  value={selectedBatch}
onChange={(e) => {

    const batchId = e.target.value;

    setSelectedBatch(batchId);

    // Clear lower hierarchyf

    setSelectedPlayer("");

    setSelectedDue("");

    setSelectedDueData(null);

    setPlayers([]);

    setDues([]);

    if (batchId) {

          console.log(
        "Selected Batch:",
        batchId
    );
        fetchPlayers(batchId);

    }

}}
>
  <option value="">
    Select Batch
  </option>

  {batches.map(
    (batch) => (
      <option
        key={batch.id}
        value={batch.id}
      >
        {batch.batch_name}
      </option>
    )
  )}
</select>

<br /><br />

<select
  value={selectedPlayer}
  onChange={(e) =>
    setSelectedPlayer(
      e.target.value
    )
  }
>
  <option value="">
    Select Player
  </option>

  {players.map(
    (player) => (
      <option
        key={player.id}
        value={player.id}
      >
        {player.full_name}
      </option>
    )
  )}
</select>

<br /><br />

      {/* Pending Dues Dropdown */}

      <select
        value={selectedDue}
onChange={(e) => {

  const dueId =
    e.target.value;

  setSelectedDue(dueId);

  const dueData =
    dues.find(
      (due) =>
        due.id === dueId
    );

  setSelectedDueData(
    dueData
  );

  setAmountPaid(dueData ? dueData.remaining_amount : "");
  setPaymentMode("");
}}
      >

 <option value="">
  {
    dues.length === 0
      ? "No Pending Dues"
      : "Select Pending Due"
  }
</option>

        {dues.map((due) => (

<option
    key={due.id}
    value={due.id}
>

{due.due_type}

{" | Due: "}

{due.due_date}

{" | Remaining ₹"}

{due.remaining_amount}

</option>

))}

      </select>

      <br />
      <br />

      {/* Payment Amount */}

      <input
        type="number"
        placeholder="Amount Paid"
        value={amountPaid}
        onChange={(e) =>
          setAmountPaid(
            e.target.value
          )
        }
      />

      <br />
      <br />

      {/* Payment Mode */}

      <select
        value={paymentMode}
        onChange={(e) =>
          setPaymentMode(
            e.target.value
          )
        }
      >

        <option value="">
          Select Payment Mode
        </option>

        <option value="cash">
          Cash
        </option>

        <option value="upi">
          UPI
        </option>

        <option value="bank_transfer">
          Bank Transfer
        </option>

      </select>

      <br />
      <br />

      <p style={{ marginTop: "10px" }}>
        Transaction reference and receipt number are generated automatically after payment collection.
      </p>

      <br />

<button
  onClick={collectPayment}
  disabled={!selectedDue}
>
  Collect Payment
</button>

      <hr />
      <br />

      <h2>Payments History</h2>

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

{isSuperAdmin(loggedInUser) &&
<th>Academy</th>}

<th>Center</th>

<th>Batch</th>

<th>Player</th>

<th>Amount Paid</th>

<th>Payment Mode</th>

<th>Reference</th>

<th>Payment Date</th>

</tr>

</thead>

        <tbody>

          {
            filteredPayments.map(
              (payment) => (

                <tr
                  key={payment.id}
                >
                  

{isSuperAdmin(loggedInUser) && (
  <td>
    {payment.players?.academies?.academy_name}
  </td>
)}

<td>
  {payment.players?.centers?.center_name}
</td>

<td>
  {payment.players?.batches?.batch_name}
</td>

<td>
  {payment.players?.full_name}
</td>

<td>
  ₹{payment.amount_paid}
</td>

<td>
  {payment.payment_mode}
</td>

<td>{payment.transaction_reference}</td>
<td>{payment.receipt_number || "-"}</td>
<td>{payment.payment_entry_type === "adjustment" ? "Adjustment" : "Payment"}</td>
<td>{new Date(payment.payment_date).toLocaleDateString()}</td>
<td>
  {payment.payment_entry_type === "payment" && (
    <button onClick={() => openCorrectionModal(payment)}>Request Correction</button>
  )}
</td>

</tr>
              )
            )
          }

        </tbody>

      </table>

      <hr />
      <br />
      <h2>Payment Corrections</h2>
      <table border="1" cellPadding="10" style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead><tr>
          <th>Player</th><th>Original</th><th>Corrected</th><th>Adjustment</th><th>Reason</th><th>Status</th><th>Requested</th>
          {(isSuperAdmin(loggedInUser) || loggedInUser?.role === "academy_owner") && <th>Actions</th>}
        </tr></thead>
        <tbody>
          {corrections.map(correction => (
            <tr key={correction.id}>
              <td>{correction.players?.full_name || "-"}</td>
              <td>₹{correction.original_amount}</td>
              <td>₹{correction.corrected_amount}</td>
              <td>₹{correction.adjustment_amount}</td>
              <td>{correction.reason}</td>
              <td>{correction.status}</td>
              <td>{new Date(correction.requested_at).toLocaleDateString()}</td>
              {(isSuperAdmin(loggedInUser) || loggedInUser?.role === "academy_owner") && <td>
                {correction.status === "pending" && <>
                  <button onClick={() => approveCorrection(correction.id)}>Approve</button>
                  <button onClick={() => openRejectionModal(correction)}>Reject</button>
                </>}
                {correction.status === "rejected" && correction.rejection_reason}
              </td>}
            </tr>
          ))}
        </tbody>
      </table>

    </div>

    {showCorrectionModal && correctionPayment && (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
        <div style={{ background: "white", padding: "24px", minWidth: "360px" }}>
          <h3>Request Payment Correction</h3>
          <p>Player: {correctionPayment.players?.full_name || "-"}</p>
          <p>Original Amount: ₹{correctionPayment.amount_paid}</p>
          <input type="number" min="0.01" step="0.01" placeholder="Corrected Amount" value={correctionAmount} onChange={e => setCorrectionAmount(e.target.value)} />
          <br /><br />
          <textarea placeholder="Reason for correction" value={correctionReason} onChange={e => setCorrectionReason(e.target.value)} rows="4" style={{ width: "100%" }} />
          <br /><br />
          <button onClick={requestCorrection}>Submit Correction</button>
          <button onClick={closeCorrectionModal}>Cancel</button>
        </div>
      </div>
    )}

    {rejectionCorrection && (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
        <div style={{ background: "white", padding: "24px", minWidth: "360px" }}>
          <h3>Reject Payment Correction</h3>
          <textarea placeholder="Rejection reason" value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} rows="4" style={{ width: "100%" }} />
          <br /><br />
          <button onClick={rejectCorrection}>Reject Correction</button>
          <button onClick={closeRejectionModal}>Cancel</button>
        </div>
      </div>
    )}

    {showReceiptModal &&
      receiptData && (

      <div className="receipt-modal-overlay">

<div
  className="receipt-modal"
  ref={receiptRef}
>

          <h2>
            Payment Receipt
          </h2>

          <p>
            <strong>
              Receipt Number:
            </strong>{" "}
            {receiptData.receiptNumber}
          </p>

          <p>
            <strong>
              Player:
            </strong>{" "}
            {receiptData.player}
          </p>

          <p>
            <strong>
              Academy:
            </strong>{" "}
            {receiptData.academy}
          </p>

          <p>
            <strong>
              Center:
            </strong>{" "}
            {receiptData.center}
          </p>

          <p>
            <strong>
              Batch:
            </strong>{" "}
            {receiptData.batch}
          </p>

          <p>
            <strong>
              Amount Paid:
            </strong>{" "}
            ₹{receiptData.amountPaid}
          </p>

          <p>
            <strong>
              Payment Mode:
            </strong>{" "}
            {receiptData.paymentMode}
          </p>

          <p>
            <strong>
              Reference:
            </strong>{" "}
            {
              receiptData.transactionReference ||
              "N/A"
            }
          </p>

          <p>
            <strong>
              Remaining:
            </strong>{" "}
            ₹{receiptData.remainingAmount}
          </p>

          <p>
            <strong>
              Date:
            </strong>{" "}
            {receiptData.paymentDate}
          </p>

<div
  style={{
    marginTop: "25px",
    display: "flex",
    gap: "10px"
  }}
>

<button
  onClick={printReceipt}
>

Print Receipt

</button>

<button
  onClick={() =>
    setShowReceiptModal(false)
  }
>

Close

</button>

</div>

        </div>

      </div>

    )}

  </Layout>
);
}

export default PaymentCollections;