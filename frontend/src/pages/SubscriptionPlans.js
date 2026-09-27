import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import Layout from "../components/Layout";
import "./SubscriptionPlans.css";

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
    <div className="subscription-plans-page">

      <div className="subscription-plans-header">
        <div>
          <span className="subscription-plans-eyebrow">Billing configuration</span>
          <h1>Subscription Plans</h1>
          <p>Define academy pricing, billing cycles, and registration fees.</p>
        </div>
        <div className="subscription-plans-count">
          <strong>{plans.length}</strong>
          <span>active plans</span>
        </div>
      </div>

      <section className="subscription-plans-form-card">
        <div className="subscription-plans-section-heading">
          <h2>Create Plan</h2>
          <p>Configure the recurring charge and one-time registration fee.</p>
        </div>
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

      <button className="subscription-plans-primary-button" onClick={createPlan}>
        Create Plan
      </button>
      </section>

      <div className="subscription-plans-list-header">
        <div>
          <h2>Plans List</h2>
          <p>{plans.length} {plans.length === 1 ? "plan" : "plans"} configured</p>
        </div>
      </div>

      <div className="subscription-plans-table-wrap">
      <table className="subscription-plans-table">

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
          {plans.length === 0 ? (
            <tr>
              <td className="subscription-plans-empty-state" colSpan={5}>
                <strong>No subscription plans</strong>
                <span>Create a plan above to make it available for player subscriptions.</span>
              </td>
            </tr>
          ) : (
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
          )}
        </tbody>
      </table>
      </div>

    </div>
  </Layout>
);
}

export default SubscriptionPlans;