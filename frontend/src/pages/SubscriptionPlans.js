import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import Layout from "../components/Layout";

function SubscriptionPlans() {

  const [academies, setAcademies] = useState([]);

  const [selectedAcademy, setSelectedAcademy] = useState("");

  const [planName, setPlanName] = useState("");

  const [billingCycle, setBillingCycle] = useState("");

  const [amount, setAmount] = useState("");

  const [registrationFee, setRegistrationFee] = useState("");

  const [plans, setPlans] = useState([]);

  useEffect(() => {

    fetchAcademies();

    fetchPlans();

  }, []);

  const fetchAcademies = async () => {

    const { data, error } = await supabase
      .from("academies")
      .select("*");

    if (error) {

      console.log(error);

    } else {

      setAcademies(data);

    }
  };

  const fetchPlans = async () => {

    const { data, error } = await supabase
      .from("subscription_plans")
      .select(`
        id,
        plan_name,
        billing_cycle,
        amount,
        registration_fee,

        academies (
          academy_name
        )
      `);

    if (error) {

      console.log(error);

    } else {

      setPlans(data);

    }
  };

  const createPlan = async () => {

    const { error } = await supabase
      .from("subscription_plans")
      .insert([
        {
          academy_id: selectedAcademy,

          plan_name: planName,

          billing_cycle: billingCycle,

          amount: amount,

          registration_fee: registrationFee
        }
      ]);

    if (error) {

      alert(error.message);

    } else {

      alert("Plan Created Successfully");

      setPlanName("");

      setBillingCycle("");

      setAmount("");

      setRegistrationFee("");

      fetchPlans();
    }
  };

return (
  <Layout>
    <div style={{ padding: "20px" }}>

      <h1>Subscription Plans</h1>

      {/* Academy Dropdown */}

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

        {
          academies.map((academy) => (

            <option
              key={academy.id}
              value={academy.id}
            >

              {academy.academy_name}

            </option>

          ))
        }

      </select>

      <br />
      <br />

      {/* Plan Name */}

      <input
        type="text"
        placeholder="Plan Name"
        value={planName}
        onChange={(e) =>
          setPlanName(
            e.target.value
          )
        }
      />

      <br />
      <br />

      {/* Billing Cycle */}

      <input
        type="text"
        placeholder="Billing Cycle"
        value={billingCycle}
        onChange={(e) =>
          setBillingCycle(
            e.target.value
          )
        }
      />

      <br />
      <br />

      {/* Amount */}

      <input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={(e) =>
          setAmount(
            e.target.value
          )
        }
      />

      <br />
      <br />

      {/* Registration Fee */}

      <input
        type="number"
        placeholder="Registration Fee"
        value={registrationFee}
        onChange={(e) =>
          setRegistrationFee(
            e.target.value
          )
        }
      />

      <br />
      <br />

      <button onClick={createPlan}>
        Create Plan
      </button>

      <hr />
      <br />

      <h2>Plans List</h2>

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

            <th>Academy</th>

            <th>Plan</th>

            <th>Billing Cycle</th>

            <th>Amount</th>

            <th>Registration Fee</th>

          </tr>

        </thead>

        <tbody>

          {
            plans.map((plan) => (

              <tr key={plan.id}>

                <td>
                  {
                    plan.academies
                    ?.academy_name
                  }
                </td>

                <td>
                  {plan.plan_name}
                </td>

                <td>
                  {plan.billing_cycle}
                </td>

                <td>
                  ₹ {plan.amount}
                </td>

                <td>
                  ₹ {plan.registration_fee}
                </td>

              </tr>

            ))
          }

        </tbody>

      </table>

    </div>
  </Layout>
);
}

export default SubscriptionPlans;