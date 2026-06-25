import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

import {
  getLoggedInUser,
  isSuperAdmin,
  getAcademyId
} from "../utils/auth";
import Layout from "../components/Layout";
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

} else {
console.log(
  "PENDING DUES:",
  data
);
  setDues(data);

}
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

    const currentPaid =
      Number(
        selectedDueData.paid_amount
      );

    const totalAmount =
      Number(
        selectedDueData.total_amount
      );

    const newPaidAmount =
      currentPaid +
      Number(amountPaid);

    const remainingAmount =
      totalAmount -
      newPaidAmount;

const payment = Number(amountPaid);

if (payment > Number(selectedDueData.remaining_amount)) {

  alert(
    `Maximum payable amount is ₹${selectedDueData.remaining_amount}`
  );

  return;
}

    let dueStatus = "pending";

    if (
      remainingAmount <= 0
    ) {

      dueStatus = "paid";

    } else if (
      newPaidAmount > 0
    ) {

      dueStatus = "partial";
    }


    
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
              transactionReference
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

    remaining_amount:
      remainingAmount,

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

return (
  <Layout>
    <div style={{ padding: "20px" }}>
      <h1>Payment Collections</h1>

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
  onChange={(e) =>
    setSelectedCenter(
      e.target.value
    )
  }
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
  onChange={(e) =>
    setSelectedBatch(
      e.target.value
    )
  }
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

        {
          dues.map((due) => (

            <option
              key={due.id}
              value={due.id}
            >

              {
                due.players
                ?.full_name
              }

              {" - Remaining ₹"}

              {
                due.remaining_amount
              }

            </option>

          ))
        }

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
  </Layout>
);
}

export default PaymentCollections;