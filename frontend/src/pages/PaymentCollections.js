import React, {
  useState,
  useEffect,
  useRef
} from "react";
import { supabase } from "../services/supabase";
import { generateReceiptNumber } from "../utils/receiptGenerator";
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

  const [transactionReference, setTransactionReference] = useState("");

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

const receiptRef = useRef(null);

const location = useLocation();

//////////
useEffect(() => {

  const testReceipt = async () => {

    const receipt =
      await generateReceiptNumber();

    console.log(
      "Generated Receipt:",
      receipt
    );

  };

  testReceipt();

}, []);
//////////

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

  setSelectedAcademy("");

  setSelectedCenter("");

  setSelectedBatch("");

  setSelectedPlayer("");

  setSelectedDue("");

  setSelectedDueData(null);

  setAmountPaid("");

  setPaymentMode("");

  setTransactionReference("");

  setCenters([]);

  setBatches([]);

  setPlayers([]);

  setDues([]);

};

  const collectPayment = async () => {

    if (
      !selectedDue ||
      !amountPaid ||
      !paymentMode
    ) {

      alert("Please fill all fields");

      return;
    }
if (
  paymentMode !== "cash" &&
  !transactionReference.trim()
) {

  alert(
    "Transaction Reference is required."
  );

  return;

}
    const currentPaid =
      Number(
        selectedDueData.paid_amount
      );

    const totalAmount =
      Number(
        selectedDueData.total_amount
      );

const paymentAmount =
  Number(amountPaid);

const newPaidAmount =
  currentPaid + paymentAmount;

const remainingAmount =
  totalAmount - newPaidAmount;

console.log("Current Paid:", currentPaid);
console.log("Total Amount:", totalAmount);
console.log("Entered Payment:", paymentAmount);
console.log("New Paid Amount:", newPaidAmount);
console.log("Remaining Amount:", remainingAmount);

if (remainingAmount < 0) {

  const maximumAllowed =
    totalAmount - currentPaid;

  alert(
    `Maximum payable amount is ₹${maximumAllowed}`
  );

  return;

}


let dueStatus = "pending";

if (
    newPaidAmount === totalAmount
) {

    dueStatus = "paid";

}
else if (
    newPaidAmount > 0
) {

    dueStatus = "partial";

}
/////

const receiptNumber =
  await generateReceiptNumber();

        /* INSERT PAYMENT */
   
    const { error: paymentError } =
      await supabase
        .from("payments")
        .insert([
          {
            due_id:
              selectedDueData.id,

            player_id:
              selectedDueData.player_id,

            amount_paid:
              Number(amountPaid),

            payment_mode:
              paymentMode,

            transaction_reference:
              transactionReference,

            receipt_number: receiptNumber
          }
        ]);

    if (paymentError) {

      alert(paymentError.message);

      return;
    }

    /* UPDATE DUE */

    const { error: dueError } =
      await supabase
  .from("payment_dues")
  .update({

    paid_amount:
      newPaidAmount,

    due_status:
      dueStatus

  })
        .eq(
          "id",
          selectedDueData.id
        );

 if (dueError) {

  alert(dueError.message);

} else {

  const receiptNumber =
    await generateReceiptNumber();

  const selectedAcademyName =
    academies.find(
      academy =>
        academy.id === selectedAcademy
    )?.academy_name;

  const selectedCenterName =
    centers.find(
      center =>
        center.id === selectedCenter
    )?.center_name;

  const selectedBatchName =
    batches.find(
      batch =>
        batch.id === selectedBatch
    )?.batch_name;

  setReceiptData({

    receiptNumber,

    player:
      selectedDueData.players.full_name,

    academy:
      selectedAcademyName,

    center:
      selectedCenterName,

    batch:
      selectedBatchName,

    amountPaid:
      paymentAmount,

    paymentMode:
      paymentMode,

    transactionReference:
      transactionReference,

    remainingAmount:
      remainingAmount,

paymentDate:
new Date().toLocaleDateString(
  "en-IN",
  {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }
)

  });

  setShowReceiptModal(true);

  resetCollectionForm();

  fetchPendingDues(selectedPlayer);

  fetchPayments();

}
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

  setAmountPaid(
    dueData
      ? dueData.remaining_amount
      : ""
  );
  setTransactionReference("");
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

      {/* Transaction Reference */}

      <input
        type="text"
        placeholder="Transaction Reference"
        value={transactionReference}
        onChange={(e) =>
          setTransactionReference(
            e.target.value
          )
        }
      />

      <br />
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

<td>
  {payment.transaction_reference}
</td>

<td>
  {new Date(payment.payment_date).toLocaleDateString()}
</td>

</tr>
              )
            )
          }

        </tbody>

      </table>

    </div>

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