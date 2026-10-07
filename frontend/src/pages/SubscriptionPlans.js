import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import "./SubscriptionPlans.css";
import { supabase } from "../services/supabase";
import { getLoggedInUser, isSuperAdmin, getAcademyId } from "../utils/auth";

const BILLING_CYCLES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half_yearly", label: "Half Yearly" }
];
const PAGE_SIZE = 5;

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(value || 0));

const formatBillingCycle = (value) => {
  const match = BILLING_CYCLES.find((cycle) => cycle.value === value);
  return match?.label || value || "—";
};

function SubscriptionPlans() {
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [academies, setAcademies] = useState([]);
  const [selectedAcademy, setSelectedAcademy] = useState("");
  const [planName, setPlanName] = useState("");
  const [billingCycle, setBillingCycle] = useState("");
  const [amount, setAmount] = useState("");
  const [registrationFee, setRegistrationFee] = useState("");
  const [plans, setPlans] = useState([]);
  const [statusFilter, setStatusFilter] = useState("active");
  const [academyFilter, setAcademyFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const user = await getLoggedInUser();
      setLoggedInUser(user);
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (!loggedInUser) return;
    fetchAcademies();
    fetchPlans();
  }, [loggedInUser]);

  const fetchAcademies = async () => {
    let query = supabase
      .from("academies")
      .select("id, academy_name")
      .eq("is_active", true)
      .order("academy_name");

    if (!isSuperAdmin(loggedInUser)) {
      const academyId = getAcademyId(loggedInUser);
      if (academyId) query = query.eq("id", academyId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Failed to load academies:", error);
      return;
    }

    const nextAcademies = data || [];
    setAcademies(nextAcademies);
    if (!isSuperAdmin(loggedInUser) && nextAcademies.length === 1 && !selectedAcademy) {
      setSelectedAcademy(nextAcademies[0].id);
    }
  };

  const fetchPlans = async () => {
    let query = supabase
      .from("subscription_plans")
      .select(`
        id,
        academy_id,
        plan_name,
        billing_cycle,
        amount,
        registration_fee,
        description,
        is_active,
        created_at,
        updated_at,
        academies ( academy_name )
      `)
      .order("created_at", { ascending: false });

    if (!isSuperAdmin(loggedInUser)) {
      const academyId = getAcademyId(loggedInUser);
      if (academyId) query = query.eq("academy_id", academyId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Failed to load subscription plans:", error);
      setPlans([]);
      return;
    }
    setPlans(data || []);
  };

  const resetForm = () => {
    setSelectedAcademy(isSuperAdmin(loggedInUser) ? "" : (academies.length === 1 ? academies[0].id : selectedAcademy));
    setPlanName("");
    setBillingCycle("");
    setAmount("");
    setRegistrationFee("");
    setEditingPlanId(null);
    setSelectedPlanId(null);
    setFormError("");
  };

  const handleEditPlan = (plan) => {
    setEditingPlanId(plan.id);
    setSelectedAcademy(plan.academy_id || "");
    setPlanName(plan.plan_name || "");
    setBillingCycle(plan.billing_cycle || "");
    setAmount(String(plan.amount ?? ""));
    setRegistrationFee(String(plan.registration_fee ?? ""));
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const validateForm = () => {
    if (!selectedAcademy) return "Select an academy.";
    if (!planName.trim()) return "Enter a plan name.";
    if (!billingCycle) return "Select a billing cycle.";
    if (amount === "" || Number(amount) < 0) return "Enter a valid recurring amount.";
    if (registrationFee === "" || Number(registrationFee) < 0) return "Enter a valid registration fee.";
    return "";
  };

  const handleSavePlan = async () => {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSaving(true);
    setFormError("");

    const payload = {
      academy_id: selectedAcademy,
      plan_name: planName.trim(),
      billing_cycle: billingCycle,
      amount: Number(amount),
      registration_fee: Number(registrationFee)
    };

    const request = editingPlanId
      ? supabase.from("subscription_plans").update(payload).eq("id", editingPlanId)
      : supabase.from("subscription_plans").insert([payload]);

    const { error } = await request;
    if (error) {
      setFormError(error.message);
      setIsSaving(false);
      return;
    }

    await fetchPlans();
    resetForm();
    setIsSaving(false);
  };

  const handleTogglePlanStatus = async (plan) => {
    const nextStatus = !plan.is_active;
    const confirmed = window.confirm(
      nextStatus
        ? "Reactivate \"" + plan.plan_name + "\"?"
        : "Deactivate \"" + plan.plan_name + "\"? Existing player subscriptions will remain intact."
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from("subscription_plans")
      .update({ is_active: nextStatus })
      .eq("id", plan.id);

    if (error) {
      setFormError(error.message);
      return;
    }

    await fetchPlans();
    if (editingPlanId === plan.id) resetForm();
    setFormError("");
  };

  const filteredPlans = useMemo(() => plans.filter((plan) => {
    const statusMatches =
      statusFilter === "all" ||
      (statusFilter === "active" && plan.is_active) ||
      (statusFilter === "inactive" && !plan.is_active);
    const academyMatches = !academyFilter || plan.academy_id === academyFilter;
    return statusMatches && academyMatches;
  }), [plans, statusFilter, academyFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPlans.length / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const paginatedPlans = filteredPlans.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const activePlanCount = plans.filter((plan) => plan.is_active).length;
  const inactivePlanCount = plans.length - activePlanCount;
  const selectedAcademyName = academies.find((academy) => academy.id === selectedAcademy)?.academy_name || "Select academy";

  return (
    <Layout>
      <div className={"subscription-plans-page" + (isSuperAdmin(loggedInUser) ? " subscription-plans-page-super-admin" : "")}>
        <section className="subscription-plans-form-card">
          <div className="subscription-plans-form-heading">
            <div>
              <span className="subscription-plans-section-label">{editingPlanId ? "Edit plan" : "New plan"}</span>
              <h2>{editingPlanId ? "Update subscription plan" : "Create subscription plan"}</h2>
            </div>
            {editingPlanId && <button type="button" className="subscription-plans-secondary-button" onClick={resetForm}>Cancel edit</button>}
          </div>

          <div className="subscription-plans-form-grid">
            <div className="subscription-plans-field">
              <label htmlFor="subscription-plan-academy">Academy</label>
              <select id="subscription-plan-academy" value={selectedAcademy} onChange={(e) => setSelectedAcademy(e.target.value)} disabled={!isSuperAdmin(loggedInUser) || Boolean(editingPlanId)}>
                <option value="">{isSuperAdmin(loggedInUser) ? "Select academy" : selectedAcademyName}</option>
                {academies.map((academy) => <option key={academy.id} value={academy.id}>{academy.academy_name}</option>)}
              </select>
            </div>

            <div className="subscription-plans-field">
              <label htmlFor="subscription-plan-name">Plan name</label>
              <input id="subscription-plan-name" type="text" placeholder="e.g. Monthly" value={planName} maxLength={80} onChange={(e) => setPlanName(e.target.value)} />
            </div>

            <div className="subscription-plans-field">
              <label htmlFor="subscription-plan-billing-cycle">Billing cycle</label>
              <select id="subscription-plan-billing-cycle" value={billingCycle} onChange={(e) => setBillingCycle(e.target.value)}>
                <option value="">Select billing cycle</option>
                {BILLING_CYCLES.map((cycle) => <option key={cycle.value} value={cycle.value}>{cycle.label}</option>)}
              </select>
            </div>

            <div className="subscription-plans-field">
              <label htmlFor="subscription-plan-amount">Recurring amount</label>
              <div className="subscription-plans-money-input"><span>₹</span><input id="subscription-plan-amount" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            </div>

            <div className="subscription-plans-field">
              <label htmlFor="subscription-plan-registration-fee">Registration fee</label>
              <div className="subscription-plans-money-input"><span>₹</span><input id="subscription-plan-registration-fee" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" value={registrationFee} onChange={(e) => setRegistrationFee(e.target.value)} /></div>
            </div>

            <div className="subscription-plans-form-action">
              <button type="button" className="subscription-plans-primary-button" onClick={handleSavePlan} disabled={isSaving}>
                {isSaving ? "Saving..." : editingPlanId ? "Update plan" : "Create plan"}
              </button>
            </div>
          </div>

          {formError && <div className="subscription-plans-form-error" role="alert">{formError}</div>}
        </section>

        <section className="subscription-plans-list-section">
          <div className="subscription-plans-list-toolbar">
            <div className="subscription-plans-list-title">
              <h2>Plans</h2>
              <span>{filteredPlans.length} {filteredPlans.length === 1 ? "plan" : "plans"} · {activePlanCount} active · {inactivePlanCount} inactive</span>
            </div>
            <div className="subscription-plans-filters">
              {isSuperAdmin(loggedInUser) && <div className="subscription-plans-filter-field">
                <label htmlFor="subscription-plan-academy-filter">Academy</label>
                <select id="subscription-plan-academy-filter" value={academyFilter} onChange={(e) => { setAcademyFilter(e.target.value); setCurrentPage(1); }}>
                  <option value="">All academies</option>
                  {academies.map((academy) => <option key={academy.id} value={academy.id}>{academy.academy_name}</option>)}
                </select>
              </div>}
              <div className="subscription-plans-filter-field">
                <label htmlFor="subscription-plan-status-filter">Status</label>
                <select id="subscription-plan-status-filter" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
                  <option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All statuses</option>
                </select>
              </div>
            </div>
          </div>

          <div className="subscription-plans-table-wrap">
            <table className="subscription-plans-table">
              <caption className="sr-only">Subscription plans</caption>
              <thead><tr>
                {isSuperAdmin(loggedInUser) && <th scope="col">Academy</th>}
                <th scope="col">Plan</th><th scope="col">Billing cycle</th><th scope="col">Recurring amount</th><th scope="col">Registration</th><th scope="col">Status</th><th scope="col">Actions</th>
              </tr></thead>
              <tbody>
                {paginatedPlans.length === 0 ? <tr><td className="subscription-plans-empty-state" colSpan={isSuperAdmin(loggedInUser) ? 7 : 6}><strong>No plans found</strong><span>{statusFilter === "active" ? "Create a plan or switch the status filter to view inactive plans." : "Try a different filter or create a new plan."}</span></td></tr> :
                  paginatedPlans.map((plan) => {
                    const isSelected = selectedPlanId === plan.id;
                    return (
                      <React.Fragment key={plan.id}>
                        <tr
                          className={isSelected ? "subscription-plans-row-selected" : ""}
                          tabIndex={0}
                          onClick={() => setSelectedPlanId(plan.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedPlanId(plan.id);
                            }
                          }}
                        >
                          {isSuperAdmin(loggedInUser) && <td><strong>{plan.academies?.academy_name || "—"}</strong></td>}
                          <td>
                            <div className="subscription-plans-plan-cell">
                              <strong>{plan.plan_name}</strong>
                              <span>{plan.description || "Standard academy plan"}</span>
                            </div>
                          </td>
                          <td>{formatBillingCycle(plan.billing_cycle)}</td>
                          <td className="subscription-plans-money-cell">{formatCurrency(plan.amount)}</td>
                          <td className="subscription-plans-money-cell">{formatCurrency(plan.registration_fee)}</td>
                          <td><span className={plan.is_active ? "subscription-plans-status subscription-plans-status-active" : "subscription-plans-status subscription-plans-status-inactive"}>{plan.is_active ? "Active" : "Inactive"}</span></td>
                          <td className="subscription-plans-actions-cell">
                            <div className="subscription-plans-row-actions">
                              <button
                                type="button"
                                className="subscription-plans-action-button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleEditPlan(plan);
                                }}
                                aria-label={"Edit " + plan.plan_name + " plan"}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className={plan.is_active ? "subscription-plans-action-button subscription-plans-action-danger" : "subscription-plans-action-button subscription-plans-action-success"}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleTogglePlanStatus(plan);
                                }}
                                aria-label={(plan.is_active ? "Deactivate " : "Reactivate ") + plan.plan_name + " plan"}
                              >
                                {plan.is_active ? "Deactivate" : "Reactivate"}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isSelected && (
                          <tr className="subscription-plans-mobile-actions-row">
                            <td
                              colSpan={isSuperAdmin(loggedInUser) ? 7 : 6}
                              className="subscription-plans-mobile-actions-cell"
                            >
                              <div className="subscription-plans-mobile-row-actions" aria-label={"Actions for " + plan.plan_name + " plan"}>
                                <button
                                  type="button"
                                  className="subscription-plans-action-button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleEditPlan(plan);
                                  }}
                                  aria-label={"Edit " + plan.plan_name + " plan"}
                                  title="Edit plan"
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  className={plan.is_active ? "subscription-plans-action-button subscription-plans-action-danger" : "subscription-plans-action-button subscription-plans-action-success"}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleTogglePlanStatus(plan);
                                  }}
                                  aria-label={(plan.is_active ? "Deactivate " : "Reactivate ") + plan.plan_name + " plan"}
                                  title={plan.is_active ? "Deactivate plan" : "Reactivate plan"}
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                }
              </tbody>
            </table>
          </div>

          {filteredPlans.length > 0 && <div className="subscription-plans-pagination">
            <span>Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, filteredPlans.length)}–{Math.min(currentPage * PAGE_SIZE, filteredPlans.length)} of {filteredPlans.length}</span>
            <div><button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>Previous</button><strong>Page {currentPage} of {totalPages}</strong><button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>Next</button></div>
          </div>}
        </section>
      </div>
    </Layout>
  );
}

export default SubscriptionPlans;