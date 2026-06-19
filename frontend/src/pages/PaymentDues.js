import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import Layout from "../components/Layout";

function PaymentDues() {


  const [subscriptions, setSubscriptions] = useState([]);

  const [selectedSubscription, setSelectedSubscription] = useState("");

  const [selectedSubscriptionData, setSelectedSubscriptionData] = useState(null);

  const [dueType, setDueType] = useState("");

  const [dueDate, setDueDate] = useState("");

  const [duesList, setDuesList] = useState([]);

useEffect(() => {
  fetchSubscriptions();
  fetchPaymentDues();
}, []);



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

  const fetchPaymentDues = async () => {

    const { data, error } = await supabase
      .from("payment_dues")
      .select(`
        id,
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
      .order("due_date", {
        ascending: false
      });

    if (error) {

      console.log(error);

    } else {

      setDuesList(data);

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

      setSelectedSubscription("");

      setSelectedSubscriptionData(null);

      setDueType("");

      setDueDate("");

      fetchPaymentDues();
    }
  };

return (
  <Layout>
    <div style={{ padding: "20px" }}>
      <h1>Payment Dues</h1>

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

            <th>Due Type</th>

            <th>Due Date</th>

            <th>Total Amount</th>

            <th>Paid Amount</th>

            <th>Remaining Amount</th>

            <th>Status</th>

          </tr>

        </thead>

        <tbody>

          {
            duesList.map((due) => (

              <tr key={due.id}>

                <td>{due.players?.full_name}</td>

<td>{due.due_type}</td>

<td>{due.due_date}</td>

<td>₹ {due.total_amount}</td>

<td>₹ {due.paid_amount}</td>

<td>₹ {due.remaining_amount}</td>

<td>{due.due_status}</td>

              </tr>

            ))
          }

        </tbody>

      </table>

    </div>
  </Layout>
);
}

export default PaymentDues;