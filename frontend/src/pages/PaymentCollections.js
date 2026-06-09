import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function PaymentCollections() {

  const [dues, setDues] = useState([]);

  const [selectedDue, setSelectedDue] = useState("");

  const [selectedDueData, setSelectedDueData] = useState(null);

  const [amountPaid, setAmountPaid] = useState("");

  const [paymentMode, setPaymentMode] = useState("");

  const [transactionReference, setTransactionReference] = useState("");

  const [payments, setPayments] = useState([]);

  useEffect(() => {

    fetchPendingDues();

    fetchPayments();

  }, []);

  const fetchPendingDues = async () => {

    const { data, error } = await supabase
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

    if (error) {

      console.log(error);

    } else {

      setDues(data);

    }
  };

  const fetchPayments = async () => {

    const { data, error } = await supabase
      .from("payments")
      .select(`
        id,
        amount_paid,
        payment_mode,
        transaction_reference,
        payment_date,

        players (
          full_name
        )
      `)
      .order("payment_date", {
        ascending: false
      });

    if (error) {

      console.log(error);

    } else {

      setPayments(data);

    }
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

      alert(
        "Payment Collected Successfully"
      );

      setSelectedDue("");

      setSelectedDueData(null);

      setAmountPaid("");

      setPaymentMode("");

      setTransactionReference("");

      fetchPendingDues();

      fetchPayments();
    }
  };

  return (

    <div style={{ padding: "20px" }}>

      <h1>Payment Collections</h1>

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
        }}
      >

        <option value="">
          Select Pending Due
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

            <th>Player</th>

            <th>Amount Paid</th>

            <th>Payment Mode</th>

            <th>Reference</th>

            <th>Payment Date</th>

          </tr>

        </thead>

        <tbody>

          {
            payments.map(
              (payment) => (

                <tr
                  key={payment.id}
                >

                  <td>
                    {
                      payment.players
                      ?.full_name
                    }
                  </td>

                  <td>
                    ₹
                    {
                      payment.amount_paid
                    }
                  </td>

                  <td>
                    {
                      payment.payment_mode
                    }
                  </td>

                  <td>
                    {
                      payment.transaction_reference
                    }
                  </td>

                  <td>
                    {
                      payment.payment_date
                    }
                  </td>

                </tr>

              )
            )
          }

        </tbody>

      </table>

    </div>
  );
}

export default PaymentCollections;