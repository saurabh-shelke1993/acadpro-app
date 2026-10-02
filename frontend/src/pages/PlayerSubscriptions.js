import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import "./PlayerSubscriptions.css";
import { supabase } from "../services/supabase";
import { getLoggedInUser, isSuperAdmin, getAcademyId } from "../utils/auth";

const PAGE_SIZE = 7;

const BILLING_CYCLES = {
  monthly: "month",
  quarterly: "quarter",
  half_yearly: "6 months"
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "—";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(Number(year), Number(month) - 1, Number(day)));
};

const formatPlanLabel = (plan) => {
  if (!plan) return "Select Plan";
  const cycle = BILLING_CYCLES[plan.billing_cycle];
  return cycle
    ? plan.plan_name + " — " + formatCurrency(plan.amount) + " / " + cycle
    : plan.plan_name + " — " + formatCurrency(plan.amount);
};

function PlayerSubscriptions() {
  const [players, setPlayers] = useState([]);
  const [academies, setAcademies] = useState([]);
  const [centers, setCenters] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedAcademy, setSelectedAcademy] = useState("");
  const [selectedCenter, setSelectedCenter] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editingSubscriptionId, setEditingSubscriptionId] = useState(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [statusFilter, setStatusFilter] = useState("active");
  const [columnFilters, setColumnFilters] = useState({
    academy: "",
    center: "",
    batch: "",
    player: "",
    plan: ""
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast] = useState(null);
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
  }, [loggedInUser]);

  useEffect(() => {
    if (!loggedInUser) return;
    fetchPlayers();
    fetchPlans();
    fetchSubscriptions();
  }, [loggedInUser, selectedAcademy, selectedCenter, selectedBatch]);

  useEffect(() => {
    if (!selectedAcademy) {
      setCenters([]);
      setBatches([]);
      return;
    }

    fetchCenters(selectedAcademy);
    fetchPlans();
  }, [selectedAcademy]);

  useEffect(() => {
    if (!selectedCenter) {
      setBatches([]);
      return;
    }

    fetchBatches(selectedCenter);
  }, [selectedCenter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedAcademy, selectedCenter, selectedBatch, statusFilter, columnFilters]);

  useEffect(() => {
    setColumnFilters({
      academy: "",
      center: "",
      batch: "",
      player: "",
      plan: ""
    });
  }, [selectedAcademy, selectedCenter, selectedBatch]);

  const showToast = (type, message) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3500);
  };

  const fetchAcademies = async () => {
    if (!loggedInUser) return;

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
      showToast("error", "Unable to load academies.");
      return;
    }

    const nextAcademies = data || [];
    setAcademies(nextAcademies);

    if (!isSuperAdmin(loggedInUser) && nextAcademies.length === 1) {
      setSelectedAcademy(nextAcademies[0].id);
    }
  };

  const fetchCenters = async (academyId) => {
    const { data, error } = await supabase
      .from("centers")
      .select("id, center_name")
      .eq("academy_id", academyId)
      .eq("is_active", true)
      .order("center_name");

    if (error) {
      showToast("error", "Unable to load centers.");
      return;
    }

    setCenters(data || []);
  };

  const fetchBatches = async (centerId) => {
    const { data, error } = await supabase
      .from("batches")
      .select("id, batch_name")
      .eq("center_id", centerId)
      .eq("is_active", true)
      .order("batch_name");

    if (error) {
      showToast("error", "Unable to load batches.");
      return;
    }

    setBatches(data || []);
  };

  const fetchPlayers = async () => {
    let query = supabase
      .from("players")
      .select("id, full_name, academy_id, center_id, batch_id")
      .eq("is_active", true)
      .order("full_name");

    if (selectedAcademy) query = query.eq("academy_id", selectedAcademy);
    if (selectedCenter) query = query.eq("center_id", selectedCenter);
    if (selectedBatch) query = query.eq("batch_id", selectedBatch);

    const { data, error } = await query;

    if (error) {
      showToast("error", "Unable to load players.");
      return;
    }

    setPlayers(data || []);
  };

  const fetchPlans = async () => {
    let query = supabase
      .from("subscription_plans")
      .select("id, academy_id, plan_name, amount, billing_cycle")
      .eq("is_active", true)
      .order("plan_name");

    if (selectedAcademy) query = query.eq("academy_id", selectedAcademy);

    const { data, error } = await query;

    if (error) {
      showToast("error", "Unable to load subscription plans.");
      return;
    }

    setPlans(data || []);
  };

  const fetchSubscriptions = async () => {
    let query = supabase
      .from("player_subscriptions")
      .select(`
        id,
        player_id,
        subscription_plan_id,
        start_date,
        end_date,
        status,
        players (
          id,
          full_name,
          academy_id,
          center_id,
          batch_id,
          academies ( academy_name ),
          centers ( center_name ),
          batches ( batch_name )
        ),
        subscription_plans (
          plan_name,
          amount,
          billing_cycle
        )
      `)
      .order("start_date", { ascending: false });

    const { data, error } = await query;

    if (error) {
      showToast("error", "Unable to load subscriptions.");
      return;
    }

    let scopedData = data || [];

    if (loggedInUser && !isSuperAdmin(loggedInUser)) {
      scopedData = scopedData.filter(
        (subscription) =>
          subscription.players?.academy_id === getAcademyId(loggedInUser)
      );
    }

    if (selectedAcademy) {
      scopedData = scopedData.filter(
        (subscription) => subscription.players?.academy_id === selectedAcademy
      );
    }

    if (selectedCenter) {
      scopedData = scopedData.filter(
        (subscription) => subscription.players?.center_id === selectedCenter
      );
    }

    if (selectedBatch) {
      scopedData = scopedData.filter(
        (subscription) => subscription.players?.batch_id === selectedBatch
      );
    }

    setSubscriptions(scopedData);
  };

  const resetAssignmentForm = () => {
    setIsEditing(false);
    setEditingSubscriptionId(null);
    setSelectedPlayer("");
    setSelectedPlan("");
    setStartDate(new Date().toISOString().split("T")[0]);
    setIsSaving(false);
  };

  const handleAcademyChange = (academyId) => {
    setSelectedAcademy(academyId);
    setSelectedCenter("");
    setSelectedBatch("");
  };

  const handleCenterChange = (centerId) => {
    setSelectedCenter(centerId);
    setSelectedBatch("");
  };

  const handleEditSubscription = (subscription) => {
    setIsEditing(true);
    setEditingSubscriptionId(subscription.id);
    setSelectedPlayer(subscription.player_id);
    setSelectedPlan(subscription.subscription_plan_id);
    setStartDate(subscription.start_date || new Date().toISOString().split("T")[0]);

    window.requestAnimationFrame(() => {
      document.getElementById("player-subscription-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  };

  const createSubscription = async () => {
    if (!selectedPlayer || !selectedPlan || !startDate) {
      showToast("error", "Select a player, plan, and start date.");
      return;
    }

    setIsSaving(true);

    const { data: existingSubscription, error: existingError } = await supabase
      .from("player_subscriptions")
      .select("id")
      .eq("player_id", selectedPlayer)
      .eq("subscription_plan_id", selectedPlan)
      .eq("status", "active");

    if (existingError) {
      showToast("error", existingError.message);
      setIsSaving(false);
      return;
    }

    if (existingSubscription?.length > 0) {
      showToast("error", "Player already has this active subscription.");
      setIsSaving(false);
      return;
    }

    const { error } = await supabase
      .from("player_subscriptions")
      .insert([{
        player_id: selectedPlayer,
        subscription_plan_id: selectedPlan,
        start_date: startDate,
        status: "active"
      }]);

    if (error) {
      showToast("error", error.message);
      setIsSaving(false);
      return;
    }

    await fetchSubscriptions();
    resetAssignmentForm();
    showToast("success", "Subscription created successfully.");
  };

  const handleUpdateSubscription = async () => {
    if (!selectedPlayer || !selectedPlan || !startDate) {
      showToast("error", "Select a player, plan, and start date.");
      return;
    }

    setIsSaving(true);

    const { error } = await supabase
      .from("player_subscriptions")
      .update({
        player_id: selectedPlayer,
        subscription_plan_id: selectedPlan,
        start_date: startDate
      })
      .eq("id", editingSubscriptionId);

    if (error) {
      showToast("error", error.message);
      setIsSaving(false);
      return;
    }

    await fetchSubscriptions();
    resetAssignmentForm();
    showToast("success", "Subscription updated successfully.");
  };

  const handleDeactivateSubscription = async (id) => {
    const confirmed = window.confirm(
      "Deactivate this subscription? The subscription history will be retained."
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("player_subscriptions")
      .update({ status: "inactive" })
      .eq("id", id);

    if (error) {
      showToast("error", error.message);
      return;
    }

    await fetchSubscriptions();
    showToast("success", "Subscription deactivated.");
  };

  const columnFilterOptions = useMemo(() => ({
    academies: [...new Map(
      subscriptions
        .map((subscription) => [
          subscription.players?.academy_id,
          subscription.players?.academies?.academy_name
        ])
        .filter(([id, name]) => id && name)
    ).entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    centers: [...new Map(
      subscriptions
        .map((subscription) => [
          subscription.players?.center_id,
          subscription.players?.centers?.center_name
        ])
        .filter(([id, name]) => id && name)
    ).entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    batches: [...new Map(
      subscriptions
        .map((subscription) => [
          subscription.players?.batch_id,
          subscription.players?.batches?.batch_name
        ])
        .filter(([id, name]) => id && name)
    ).entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    players: [...new Map(
      subscriptions
        .map((subscription) => [
          subscription.players?.id,
          subscription.players?.full_name
        ])
        .filter(([id, name]) => id && name)
    ).entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    plans: [...new Map(
      subscriptions
        .map((subscription) => [
          subscription.subscription_plan_id,
          subscription.subscription_plans?.plan_name
        ])
        .filter(([id, name]) => id && name)
    ).entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }), [subscriptions]);

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((subscription) => {
      if (columnFilters.academy && subscription.players?.academy_id !== columnFilters.academy) return false;
      if (columnFilters.center && subscription.players?.center_id !== columnFilters.center) return false;
      if (columnFilters.batch && subscription.players?.batch_id !== columnFilters.batch) return false;
      if (columnFilters.player && subscription.players?.id !== columnFilters.player) return false;
      if (columnFilters.plan && subscription.subscription_plan_id !== columnFilters.plan) return false;
      if (statusFilter !== "all" && subscription.status !== statusFilter) return false;
      return true;
    });
  }, [subscriptions, statusFilter, columnFilters]);

  const visibleSubscriptions = filteredSubscriptions;

  const totalPages = Math.max(1, Math.ceil(visibleSubscriptions.length / PAGE_SIZE));
  const paginatedSubscriptions = visibleSubscriptions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const activeCount = subscriptions.filter((subscription) => subscription.status === "active").length;
  const inactiveCount = subscriptions.filter((subscription) => subscription.status === "inactive").length;

  const selectedPlayerRecord = players.find((player) => player.id === selectedPlayer);
  const selectedPlanRecord = plans.find((plan) => plan.id === selectedPlan);

  return (
    <Layout>
      <div className="player-subscriptions-page">
        {toast && (
          <div className={"player-subscriptions-toast player-subscriptions-toast-" + toast.type} role="status">
            <span>{toast.type === "success" ? "✓" : "!"}</span>
            {toast.message}
          </div>
        )}

        <section className="player-subscriptions-filter-bar" aria-label="Subscription scope">
          {isSuperAdmin(loggedInUser) && (
            <div className="player-subscriptions-filter-field">
              <label htmlFor="player-subscription-academy">Academy</label>
              <select
                id="player-subscription-academy"
                value={selectedAcademy}
                onChange={(e) => handleAcademyChange(e.target.value)}
              >
                <option value="">All academies</option>
                {academies.map((academy) => (
                  <option key={academy.id} value={academy.id}>
                    {academy.academy_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="player-subscriptions-filter-field">
            <label htmlFor="player-subscription-center">Center</label>
            <select
              id="player-subscription-center"
              value={selectedCenter}
              onChange={(e) => handleCenterChange(e.target.value)}
              disabled={!selectedAcademy && isSuperAdmin(loggedInUser)}
            >
              <option value="">
                {selectedAcademy ? "All centers" : "Select academy first"}
              </option>
              {centers.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.center_name}
                </option>
              ))}
            </select>
          </div>

          <div className="player-subscriptions-filter-field">
            <label htmlFor="player-subscription-batch">Batch</label>
            <select
              id="player-subscription-batch"
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              disabled={!selectedCenter}
            >
              <option value="">
                {selectedCenter ? "All batches" : "Select center first"}
              </option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.batch_name}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section id="player-subscription-form" className="player-subscriptions-form-card">
          <div className="player-subscriptions-form-heading">
            <div>
              <span className="player-subscriptions-section-label">
                {isEditing ? "Edit subscription" : "Assign subscription"}
              </span>
              <h2>{isEditing ? "Update player subscription" : "Assign a plan to a player"}</h2>
            </div>
            {isEditing && (
              <button type="button" className="player-subscriptions-secondary-button" onClick={resetAssignmentForm}>
                Cancel edit
              </button>
            )}
          </div>

          <div className="player-subscriptions-assignment-grid">
            <div className="player-subscriptions-field">
              <label htmlFor="player-subscription-player">Player</label>
              <select
                id="player-subscription-player"
                value={selectedPlayer}
                onChange={(e) => setSelectedPlayer(e.target.value)}
              >
                <option value="">Select player</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="player-subscriptions-field">
              <label htmlFor="player-subscription-plan">Plan</label>
              <select
                id="player-subscription-plan"
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
              >
                <option value="">Select plan</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {formatPlanLabel(plan)}
                  </option>
                ))}
              </select>
            </div>

            <div className="player-subscriptions-field">
              <label htmlFor="player-subscription-start-date">Start date</label>
              <input
                id="player-subscription-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="player-subscriptions-form-action">
              <button
                type="button"
                className="player-subscriptions-primary-button"
                onClick={isEditing ? handleUpdateSubscription : createSubscription}
                disabled={isSaving}
              >
                {isSaving
                  ? "Saving..."
                  : isEditing
                    ? "Update subscription"
                    : "Create subscription"}
              </button>
            </div>
          </div>

          {selectedPlayerRecord && selectedPlanRecord && (
            <div className="player-subscriptions-assignment-summary">
              <div>
                <span>Selected player</span>
                <strong>{selectedPlayerRecord.full_name}</strong>
                <small>
                  {selectedAcademy
                    ? academies.find((academy) => academy.id === selectedAcademy)?.academy_name
                    : "All academies"}
                  {selectedCenter
                    ? " · " + (centers.find((center) => center.id === selectedCenter)?.center_name || "")
                    : ""}
                  {selectedBatch
                    ? " · " + (batches.find((batch) => batch.id === selectedBatch)?.batch_name || "")
                    : ""}
                </small>
              </div>
              <div>
                <span>Selected plan</span>
                <strong>{selectedPlanRecord.plan_name}</strong>
                <small>
                  {formatCurrency(selectedPlanRecord.amount)}
                  {BILLING_CYCLES[selectedPlanRecord.billing_cycle]
                    ? " / " + BILLING_CYCLES[selectedPlanRecord.billing_cycle]
                    : ""}
                  {" · Start " + formatDate(startDate)}
                </small>
              </div>
            </div>
          )}
        </section>

        <section className="player-subscriptions-list-section">
          <div className="player-subscriptions-list-toolbar">
            <div className="player-subscriptions-list-title">
              <h2>Subscriptions</h2>
              <span>
                {visibleSubscriptions.length} shown · {activeCount} active · {inactiveCount} inactive
              </span>
            </div>

            <div className="player-subscriptions-list-controls">
              <div className="player-subscriptions-filter-field">
                <label htmlFor="player-subscription-status-filter">Status</label>
                <select
                  id="player-subscription-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="all">All statuses</option>
                </select>
              </div>
              <button
                type="button"
                className="player-subscriptions-clear-filters"
                onClick={() => {
                  setStatusFilter("active");
                  setColumnFilters({
                    academy: "",
                    center: "",
                    batch: "",
                    player: "",
                    plan: ""
                  });
                }}
                disabled={
                  statusFilter === "active" &&
                  !Object.values(columnFilters).some(Boolean)
                }
              >
                Clear filters
              </button>
            </div>
          </div>

          <div className="player-subscriptions-table-wrap">
            <table className="player-subscriptions-table">
              <caption className="sr-only">Player subscriptions</caption>
              <thead>
                <tr>
                  {isSuperAdmin(loggedInUser) && (
                    <th scope="col">
                      <div className="player-subscriptions-table-filter">
                        <span>Academy</span>
                        <select
                          aria-label="Filter subscriptions by academy"
                          value={columnFilters.academy}
                          onChange={(e) => setColumnFilters((filters) => ({ ...filters, academy: e.target.value }))}
                        >
                          <option value="">All</option>
                          {columnFilterOptions.academies.map((option) => (
                            <option key={option.id} value={option.id}>{option.name}</option>
                          ))}
                        </select>
                      </div>
                    </th>
                  )}
                  <th scope="col">
                    <div className="player-subscriptions-table-filter">
                      <span>Center</span>
                      <select
                        aria-label="Filter subscriptions by center"
                        value={columnFilters.center}
                        onChange={(e) => setColumnFilters((filters) => ({ ...filters, center: e.target.value }))}
                      >
                        <option value="">All</option>
                        {columnFilterOptions.centers.map((option) => (
                          <option key={option.id} value={option.id}>{option.name}</option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th scope="col">
                    <div className="player-subscriptions-table-filter">
                      <span>Batch</span>
                      <select
                        aria-label="Filter subscriptions by batch"
                        value={columnFilters.batch}
                        onChange={(e) => setColumnFilters((filters) => ({ ...filters, batch: e.target.value }))}
                      >
                        <option value="">All</option>
                        {columnFilterOptions.batches.map((option) => (
                          <option key={option.id} value={option.id}>{option.name}</option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th scope="col">
                    <div className="player-subscriptions-table-filter">
                      <span>Player</span>
                      <select
                        aria-label="Filter subscriptions by player"
                        value={columnFilters.player}
                        onChange={(e) => setColumnFilters((filters) => ({ ...filters, player: e.target.value }))}
                      >
                        <option value="">All</option>
                        {columnFilterOptions.players.map((option) => (
                          <option key={option.id} value={option.id}>{option.name}</option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th scope="col">
                    <div className="player-subscriptions-table-filter">
                      <span>Plan</span>
                      <select
                        aria-label="Filter subscriptions by plan"
                        value={columnFilters.plan}
                        onChange={(e) => setColumnFilters((filters) => ({ ...filters, plan: e.target.value }))}
                      >
                        <option value="">All</option>
                        {columnFilterOptions.plans.map((option) => (
                          <option key={option.id} value={option.id}>{option.name}</option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th scope="col">Amount</th>
                  <th scope="col">Start date</th>
                  <th scope="col">End date</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>

              <tbody>
                {paginatedSubscriptions.length === 0 ? (
                  <tr>
                    <td
                      className="player-subscriptions-empty-state"
                      colSpan={isSuperAdmin(loggedInUser) ? 10 : 9}
                    >
                      <strong>No subscriptions found</strong>
                      <span>
                        {statusFilter === "active"
                          ? "No active subscriptions match the selected scope."
                          : "Try a different status or scope filter."}
                      </span>
                    </td>
                  </tr>
                ) : (
                  paginatedSubscriptions.map((subscription) => (
                    <tr key={subscription.id}>
                      {isSuperAdmin(loggedInUser) && (
                        <td>
                          <strong>{subscription.players?.academies?.academy_name || "—"}</strong>
                        </td>
                      )}
                      <td>{subscription.players?.centers?.center_name || "—"}</td>
                      <td>{subscription.players?.batches?.batch_name || "—"}</td>
                      <td>
                        <div className="player-subscriptions-player-cell">
                          <strong>{subscription.players?.full_name || "—"}</strong>
                        </div>
                      </td>
                      <td>
                        <div className="player-subscriptions-plan-cell">
                          <strong>{subscription.subscription_plans?.plan_name || "—"}</strong>
                          <span>
                            {subscription.subscription_plans?.billing_cycle
                              ? BILLING_CYCLES[subscription.subscription_plans.billing_cycle]
                                ? "Per " + BILLING_CYCLES[subscription.subscription_plans.billing_cycle]
                                : subscription.subscription_plans.billing_cycle
                              : ""}
                          </span>
                        </div>
                      </td>
                      <td className="player-subscriptions-money-cell">
                        {formatCurrency(subscription.subscription_plans?.amount)}
                      </td>
                      <td className="player-subscriptions-date-cell">
                        {formatDate(subscription.start_date)}
                      </td>
                      <td className="player-subscriptions-date-cell">
                        {formatDate(subscription.end_date)}
                      </td>
                      <td>
                        <span
                          className={
                            subscription.status === "active"
                              ? "player-subscriptions-status player-subscriptions-status-active"
                              : "player-subscriptions-status player-subscriptions-status-inactive"
                          }
                        >
                          <span aria-hidden="true">●</span>
                          {subscription.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="player-subscriptions-actions-cell">
                        <div className="player-subscriptions-row-actions">
                          <button
                            type="button"
                            className="player-subscriptions-action-button"
                            onClick={() => handleEditSubscription(subscription)}
                            aria-label={"Edit " + (subscription.players?.full_name || "player") + " subscription"}
                          >
                            Edit
                          </button>
                          {subscription.status === "active" && (
                            <button
                              type="button"
                              className="player-subscriptions-action-button player-subscriptions-action-danger"
                              onClick={() => handleDeactivateSubscription(subscription.id)}
                              aria-label={"Deactivate " + (subscription.players?.full_name || "player") + " subscription"}
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {visibleSubscriptions.length > 0 && (
            <div className="player-subscriptions-pagination">
              <span>
                Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, visibleSubscriptions.length)}
                –{Math.min(currentPage * PAGE_SIZE, visibleSubscriptions.length)}
                {" "}of {visibleSubscriptions.length}
              </span>
              <div>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <strong>Page {currentPage} of {totalPages}</strong>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}

export default PlayerSubscriptions;
