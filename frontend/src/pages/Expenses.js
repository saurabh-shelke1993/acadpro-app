import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { getLoggedInUser } from "../utils/auth";
import { isAcademyOwner, isSuperAdmin } from "../utils/roles";
import {
  deleteExpense,
  deleteExpenseReminder,
  fetchExpenseAcademies,
  fetchExpenses,
  fetchExpectedIncome,
  fetchPaymentIncome,
  fetchExpenseReminders,
  saveExpense,
  saveExpenseReminder
} from "../services/expensesService";
import { calculateExpenseOverview, getExpenseOverviewPeriod } from "../utils/expenseFinancialOverview";
import "./Expenses.css";

const today = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const EMPTY_EXPENSE = {
  expense_date: today(),
  category: "",
  description: "",
  vendor: "",
  amount_paid: "",
  payment_method: "",
  reference_number: "",
  reminder_id: "",
  notes: ""
};
const EMPTY_REMINDER = {
  title: "",
  category: "",
  description: "",
  frequency: "monthly",
  expected_amount: "",
  next_due_date: today(),
  is_active: true,
  notes: ""
};
const CATEGORIES = [
  "Rent", "Ground / Facility", "Equipment", "Coach Salary",
  "Utilities", "Travel", "Marketing", "Maintenance", "Other"
];
const PAYMENT_METHODS = ["Cash", "UPI", "Bank Transfer", "Card", "Cheque", "Other"];
const formatCurrency = (value) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2
}).format(Number(value || 0));
const formatDate = (value) => value
  ? new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
  : "—";

function Expenses() {
  const [user, setUser] = useState(null);
  const [academies, setAcademies] = useState([]);
  const [academyFilter, setAcademyFilter] = useState("");
  const [expenses, setExpenses] = useState([]);
  const [overviewExpenses, setOverviewExpenses] = useState([]);
  const [overviewPayments, setOverviewPayments] = useState([]);
  const [overviewDues, setOverviewDues] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [activeTab, setActiveTab] = useState("expenses");
  const [overviewPeriod, setOverviewPeriod] = useState("monthly");
  const [expenseForm, setExpenseForm] = useState(EMPTY_EXPENSE);
  const [reminderForm, setReminderForm] = useState(EMPTY_REMINDER);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [editingReminderId, setEditingReminderId] = useState(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const canManage = isAcademyOwner(user);
  const isAdmin = isSuperAdmin(user);

  const loadData = useCallback(async (currentUser = user) => {
    if (!currentUser) return;
    setLoading(true);
    setError("");
    try {
      const overviewRange = getExpenseOverviewPeriod(overviewPeriod);
      const [nextExpenses, nextReminders, nextOverviewExpenses, nextOverviewPayments, nextOverviewDues] = await Promise.all([
        fetchExpenses(currentUser, { academyId: academyFilter, fromDate, toDate, category: categoryFilter }),
        fetchExpenseReminders(currentUser, { academyId: academyFilter }),
        fetchExpenses(currentUser, {
          academyId: academyFilter,
          fromDate: overviewRange.startDate,
          toDate: overviewRange.endDate,
        }),
        fetchPaymentIncome(currentUser, {
          academyId: academyFilter,
          fromDateTime: overviewRange.startDateTime,
          toDateTimeExclusive: overviewRange.endDateTimeExclusive,
        }),
        fetchExpectedIncome(currentUser, {
          academyId: academyFilter,
          fromDate: overviewRange.startDate,
          toDate: overviewRange.endDate,
        }),
      ]);
      setExpenses(nextExpenses);
      setReminders(nextReminders);
      setOverviewExpenses(nextOverviewExpenses);
      setOverviewPayments(nextOverviewPayments);
      setOverviewDues(nextOverviewDues);
    } catch (err) {
      setError(err.message || "Unable to load Expenses.");
    } finally {
      setLoading(false);
    }
  }, [user, academyFilter, fromDate, toDate, categoryFilter, overviewPeriod]);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        const currentUser = await getLoggedInUser();
        if (!active) return;
        if (!currentUser || (!isAcademyOwner(currentUser) && !isSuperAdmin(currentUser))) {
          setError("You do not have permission to access Expenses.");
          setLoading(false);
          return;
        }
        setUser(currentUser);
        const nextAcademies = await fetchExpenseAcademies(currentUser);
        if (!active) return;
        setAcademies(nextAcademies);
        if (isAcademyOwner(currentUser)) setAcademyFilter(currentUser.academy_id || "");
        else setAcademyFilter("");
      } catch (err) {
        if (active) {
          setError(err.message || "Unable to initialize Expenses.");
          setLoading(false);
        }
      }
    };
    initialize();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (user) loadData(user);
  }, [user, loadData]);

  const visibleExpenses = useMemo(() => expenses.filter((expense) => (
    !academyFilter || expense.academy_id === academyFilter
  )), [expenses, academyFilter]);

  const overview = useMemo(() => calculateExpenseOverview({
    expenses: overviewExpenses,
    reminders,
    payments: overviewPayments,
    dues: overviewDues,
    periodType: overviewPeriod,
  }), [overviewExpenses, reminders, overviewPayments, overviewDues, overviewPeriod]);

  const resetExpenseForm = () => {
    setExpenseForm({ ...EMPTY_EXPENSE, expense_date: today() });
    setEditingExpenseId(null);
    setShowExpenseForm(false);
  };
  const resetReminderForm = () => {
    setReminderForm({ ...EMPTY_REMINDER, next_due_date: today() });
    setEditingReminderId(null);
    setShowReminderForm(false);
  };

  const handleSaveExpense = async (event) => {
    event.preventDefault();
    if (!canManage) return;
    if (!expenseForm.category.trim() || !expenseForm.description.trim()
      || !expenseForm.expense_date || !expenseForm.amount_paid
      || !Number.isFinite(Number(expenseForm.amount_paid)) || Number(expenseForm.amount_paid) <= 0) {
      setError("Enter a date, category, description, and a positive amount.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const isRecurringOccurrence = Boolean(expenseForm.reminder_id) && !editingExpenseId;
      await saveExpense(user, expenseForm, editingExpenseId);
      resetExpenseForm();
      setNotice(editingExpenseId
        ? "Expense updated."
        : isRecurringOccurrence
          ? "Recurring expense occurrence recorded. The next due date has advanced."
          : "Expense recorded.");
      await loadData(user);
    } catch (err) {
      setError(err.message || "Unable to save expense.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveReminder = async (event) => {
    event.preventDefault();
    if (!canManage) return;
    if (!reminderForm.title.trim() || !reminderForm.category.trim()
      || !reminderForm.next_due_date || !reminderForm.expected_amount
      || !Number.isFinite(Number(reminderForm.expected_amount)) || Number(reminderForm.expected_amount) <= 0) {
      setError("Enter a title, category, next due date, and a positive expected amount.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await saveExpenseReminder(user, reminderForm, editingReminderId);
      resetReminderForm();
      setNotice(editingReminderId ? "Reminder updated." : "Reminder created.");
      await loadData(user);
    } catch (err) {
      setError(err.message || "Unable to save reminder.");
    } finally {
      setSaving(false);
    }
  };

  const handleEditExpense = (expense) => {
    setExpenseForm({
      expense_date: expense.expense_date || today(),
      category: expense.category || "",
      description: expense.description || "",
      vendor: expense.vendor || "",
      amount_paid: String(expense.amount_paid ?? ""),
      payment_method: expense.payment_method || "",
      reference_number: expense.reference_number || "",
      reminder_id: expense.reminder_id || "",
      notes: expense.notes || ""
    });
    setEditingExpenseId(expense.id);
    setShowExpenseForm(true);
    setActiveTab("expenses");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRecordOccurrence = (reminder) => {
    setExpenseForm({
      expense_date: today(),
      category: reminder.category || "",
      description: reminder.title || "",
      vendor: "",
      amount_paid: String(reminder.expected_amount ?? ""),
      payment_method: "",
      reference_number: "",
      reminder_id: reminder.id,
      notes: ""
    });
    setEditingExpenseId(null);
    setShowExpenseForm(true);
    setActiveTab("expenses");
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleEditReminder = (reminder) => {
    setReminderForm({
      title: reminder.title || "",
      category: reminder.category || "",
      description: reminder.description || "",
      frequency: reminder.frequency || "monthly",
      expected_amount: String(reminder.expected_amount ?? ""),
      next_due_date: reminder.next_due_date || today(),
      is_active: Boolean(reminder.is_active),
      notes: reminder.notes || ""
    });
    setEditingReminderId(reminder.id);
    setShowReminderForm(true);
    setActiveTab("reminders");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteExpense = async (expense) => {
    if (!window.confirm(`Delete expense "${expense.description}"? This cannot be undone.`)) return;
    setError("");
    setNotice("");
    try {
      await deleteExpense(user, expense.id);
      setNotice("Expense deleted.");
      await loadData(user);
    } catch (err) {
      setError(err.message || "Unable to delete expense.");
    }
  };

  const handleDeleteReminder = async (reminder) => {
    if (!window.confirm(`Delete reminder "${reminder.title}"? Existing expense records will be kept.`)) return;
    setError("");
    setNotice("");
    try {
      await deleteExpenseReminder(user, reminder.id);
      setNotice("Reminder deleted. Existing expense records were kept.");
      await loadData(user);
    } catch (err) {
      setError(err.message || "Unable to delete reminder.");
    }
  };

  const linkedReminderOptions = reminders.filter((reminder) => (
    reminder.is_active || reminder.id === expenseForm.reminder_id
  ));

  return (
    <Layout>
      <div className="expenses-page">
        <header className="expenses-page-header">
          <div>
            <span className="expenses-eyebrow">FINANCE / OPERATIONS</span>
            <h1>Expenses</h1>
            <p>Record actual academy spending and keep track of recurring cost reminders.</p>
          </div>
          {canManage && <div className="expenses-header-actions">
            <button type="button" className="expenses-button expenses-button-primary" onClick={() => { setActiveTab("expenses"); setShowExpenseForm(true); setError(""); }}>+ Record expense</button>
            <button type="button" className="expenses-button expenses-button-secondary" onClick={() => { setActiveTab("reminders"); setShowReminderForm(true); setError(""); }}>+ Add reminder</button>
          </div>}
        </header>

        {error && <div className="expenses-alert expenses-alert-error" role="alert">{error}</div>}
        {notice && <div className="expenses-alert expenses-alert-success" role="status">{notice}</div>}

        <section className="expenses-overview" aria-labelledby="expenses-overview-title">
          <div className="expenses-overview-heading">
            <div>
              <h2 id="expenses-overview-title">Financial overview</h2>
              <p>{overview.label} · Expected recurring costs compared with actual expenses recorded</p>
            </div>
            <div className="expenses-period-switch" role="group" aria-label="Financial overview period">
              <button type="button" aria-pressed={overviewPeriod === "monthly"} className={overviewPeriod === "monthly" ? "is-active" : ""} onClick={() => setOverviewPeriod("monthly")}>Monthly</button>
              <button type="button" aria-pressed={overviewPeriod === "quarterly"} className={overviewPeriod === "quarterly" ? "is-active" : ""} onClick={() => setOverviewPeriod("quarterly")}>Quarterly</button>
            </div>
          </div>
          <div className="expenses-summary-grid" aria-label="Expense summary">
            <article className="expenses-summary-card"><span>Expected income</span><strong>{formatCurrency(overview.expectedIncome)}</strong><small>Fee dues scheduled in this period</small></article>
            <article className="expenses-summary-card"><span>Income collected</span><strong>{formatCurrency(overview.incomeCollected)}</strong><small>Payment ledger entries in this period</small></article>
            <article className="expenses-summary-card"><span>Expected expenses</span><strong>{formatCurrency(overview.expectedAmount)}</strong><small>Recurring cost estimates for this period</small></article>
            <article className="expenses-summary-card"><span>Expenses paid</span><strong>{formatCurrency(overview.paidAmount)}</strong><small>{overview.expenseCount} recorded {overview.expenseCount === 1 ? "expense" : "expenses"} in this {overviewPeriod === "monthly" ? "month" : "quarter"}</small></article>
            <article className="expenses-summary-card"><span>Net cash movement</span><strong>{formatCurrency(overview.netCashMovement)}</strong><small>Income collected minus expenses paid</small></article>
          </div>
          <p className="expenses-overview-note">Expected income is measured by fee due date; income collected is measured by payment date. Expected expenses are estimates, while expenses paid include all recorded costs, including one-off expenses. Net cash movement is not a cash-in-hand balance. {overview.activeReminderCount} active recurring reminders · {overview.overdueReminderCount} overdue. Record each recurring occurrence manually when the cost has actually been paid.</p>
        </section>

        <section className="expenses-panel">
          <div className="expenses-panel-heading">
            <div><h2>Expense register</h2><p>Filter recorded expenses by date; reminders are managed separately.</p></div>
          </div>
          <div className="expenses-filter-bar">
            {isAdmin && <label className="expenses-field"><span>Academy</span><select value={academyFilter} onChange={(e) => setAcademyFilter(e.target.value)}><option value="">All academies</option>{academies.map((academy) => <option key={academy.id} value={academy.id}>{academy.academy_name}</option>)}</select></label>}
            <label className="expenses-field"><span>From date</span><input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} /></label>
            <label className="expenses-field"><span>To date</span><input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} /></label>
            <label className="expenses-field"><span>Category</span><select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="">All categories</option>{CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
            <button type="button" className="expenses-button expenses-button-quiet" onClick={() => { setFromDate(""); setToDate(""); setCategoryFilter(""); if (isAdmin) setAcademyFilter(""); }}>Reset filters</button>
          </div>

          <div className="expenses-tabs" role="tablist" aria-label="Expense sections">
            <button type="button" role="tab" aria-selected={activeTab === "expenses"} className={activeTab === "expenses" ? "expenses-tab expenses-tab-active" : "expenses-tab"} onClick={() => setActiveTab("expenses")}>Actual expenses <span>{visibleExpenses.length}</span></button>
            <button type="button" role="tab" aria-selected={activeTab === "reminders"} className={activeTab === "reminders" ? "expenses-tab expenses-tab-active" : "expenses-tab"} onClick={() => setActiveTab("reminders")}>Recurring reminders <span>{reminders.length}</span></button>
          </div>

          {activeTab === "expenses" ? <>
            {canManage && showExpenseForm && <form className="expenses-form" onSubmit={handleSaveExpense}>
              <div className="expenses-form-heading"><div><h3>{editingExpenseId ? "Edit expense" : "Record an expense"}</h3><p>Only actual paid costs belong in this register.</p></div><button type="button" className="expenses-icon-button" aria-label="Close expense form" onClick={resetExpenseForm}>×</button></div>
              <div className="expenses-form-grid">
                <label className="expenses-field"><span>Expense date *</span><input required type="date" value={expenseForm.expense_date} onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })} /></label>
                <label className="expenses-field"><span>Category *</span><select required value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}><option value="">Select category</option>{CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
                <label className="expenses-field expenses-field-wide"><span>Description *</span><input required maxLength={180} value={expenseForm.description} placeholder="e.g. October ground rent" onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} /></label>
                <label className="expenses-field"><span>Amount paid (₹) *</span><input required type="number" min="0.01" step="0.01" inputMode="decimal" value={expenseForm.amount_paid} onChange={(e) => setExpenseForm({ ...expenseForm, amount_paid: e.target.value })} /></label>
                <label className="expenses-field"><span>Vendor / paid to</span><input maxLength={120} value={expenseForm.vendor} onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })} /></label>
                <label className="expenses-field"><span>Payment method</span><select value={expenseForm.payment_method} onChange={(e) => setExpenseForm({ ...expenseForm, payment_method: e.target.value })}><option value="">Select method</option>{PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
                <label className="expenses-field"><span>Reference number</span><input maxLength={100} value={expenseForm.reference_number} onChange={(e) => setExpenseForm({ ...expenseForm, reference_number: e.target.value })} /></label>
                <label className="expenses-field"><span>Linked reminder{editingExpenseId ? " (fixed for existing records)" : ""}</span><select disabled={Boolean(editingExpenseId)} value={expenseForm.reminder_id} onChange={(e) => setExpenseForm({ ...expenseForm, reminder_id: e.target.value })}><option value="">None</option>{linkedReminderOptions.map((reminder) => <option key={reminder.id} value={reminder.id}>{reminder.title}</option>)}</select></label>
                <label className="expenses-field expenses-field-wide"><span>Notes</span><textarea rows="2" maxLength={1000} value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} /></label>
              </div>
              <div className="expenses-form-footer"><span>Fields marked * are required.</span><div><button type="button" className="expenses-button expenses-button-secondary" onClick={resetExpenseForm}>Cancel</button><button type="submit" className="expenses-button expenses-button-primary" disabled={saving}>{saving ? "Saving…" : editingExpenseId ? "Update expense" : "Save expense"}</button></div></div>
            </form>}

            <div className="expenses-table-wrap">
              <table className="expenses-table"><caption className="expenses-sr-only">Recorded academy expenses</caption>
                <thead><tr>{isAdmin && <th scope="col">Academy</th>}<th scope="col">Date</th><th scope="col">Expense</th><th scope="col">Category</th><th scope="col">Paid to</th><th scope="col">Amount</th><th scope="col">Method</th>{canManage && <th scope="col">Actions</th>}</tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={(isAdmin ? 1 : 0) + 6 + (canManage ? 1 : 0)} className="expenses-empty">Loading expenses…</td></tr>
                    : visibleExpenses.length === 0 ? <tr><td colSpan={(isAdmin ? 1 : 0) + 6 + (canManage ? 1 : 0)} className="expenses-empty"><strong>No expenses found</strong><span>Record an expense or change the date filters.</span></td></tr>
                    : visibleExpenses.map((expense) => <tr key={expense.id}>
                      {isAdmin && <td>{expense.academies?.academy_name || "—"}</td>}
                      <td className="expenses-date">{formatDate(expense.expense_date)}</td>
                      <td><div className="expenses-description"><strong>{expense.description}</strong>{expense.reference_number && <small>Ref: {expense.reference_number}</small>}</div></td>
                      <td>{expense.category}</td><td>{expense.vendor || "—"}</td><td className="expenses-amount">{formatCurrency(expense.amount_paid)}</td><td>{expense.payment_method || "—"}</td>
                      {canManage && <td><div className="expenses-row-actions"><button type="button" className="expenses-text-action" onClick={() => handleEditExpense(expense)}>Edit</button>{expense.reminder_id ? <span className="expenses-row-action-note">Occurrence retained</span> : <button type="button" className="expenses-text-action expenses-danger-action" onClick={() => handleDeleteExpense(expense)}>Delete</button>}</div></td>}
                    </tr>)}
                </tbody>
              </table>
            </div>
          </> : <>
            {canManage && showReminderForm && <form className="expenses-form" onSubmit={handleSaveReminder}>
              <div className="expenses-form-heading"><div><h3>{editingReminderId ? "Edit reminder" : "Add recurring reminder"}</h3><p>Reminders track expected costs only; they do not create paid expense records.</p></div><button type="button" className="expenses-icon-button" aria-label="Close reminder form" onClick={resetReminderForm}>×</button></div>
              <div className="expenses-form-grid">
                <label className="expenses-field"><span>Reminder title *</span><input required maxLength={120} value={reminderForm.title} onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })} placeholder="e.g. Ground rent" /></label>
                <label className="expenses-field"><span>Category *</span><select required value={reminderForm.category} onChange={(e) => setReminderForm({ ...reminderForm, category: e.target.value })}><option value="">Select category</option>{CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
                <label className="expenses-field"><span>Frequency *</span><select value={reminderForm.frequency} onChange={(e) => setReminderForm({ ...reminderForm, frequency: e.target.value })}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option></select></label>
                <label className="expenses-field"><span>Expected amount (₹) *</span><input required type="number" min="0.01" step="0.01" inputMode="decimal" value={reminderForm.expected_amount} onChange={(e) => setReminderForm({ ...reminderForm, expected_amount: e.target.value })} /></label>
                <label className="expenses-field"><span>Next due date *</span><input required type="date" value={reminderForm.next_due_date} onChange={(e) => setReminderForm({ ...reminderForm, next_due_date: e.target.value })} /></label>
                <label className="expenses-field"><span>Status</span><select value={reminderForm.is_active ? "active" : "inactive"} onChange={(e) => setReminderForm({ ...reminderForm, is_active: e.target.value === "active" })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
                <label className="expenses-field expenses-field-wide"><span>Description</span><input maxLength={180} value={reminderForm.description} onChange={(e) => setReminderForm({ ...reminderForm, description: e.target.value })} /></label>
                <label className="expenses-field expenses-field-wide"><span>Notes</span><textarea rows="2" maxLength={1000} value={reminderForm.notes} onChange={(e) => setReminderForm({ ...reminderForm, notes: e.target.value })} /></label>
              </div>
              <div className="expenses-form-footer"><span>Update the next due date when you review a reminder.</span><div><button type="button" className="expenses-button expenses-button-secondary" onClick={resetReminderForm}>Cancel</button><button type="submit" className="expenses-button expenses-button-primary" disabled={saving}>{saving ? "Saving…" : editingReminderId ? "Update reminder" : "Save reminder"}</button></div></div>
            </form>}

            <div className="expenses-table-wrap">
              <table className="expenses-table"><caption className="expenses-sr-only">Recurring expense reminders</caption>
                <thead><tr>{isAdmin && <th scope="col">Academy</th>}<th scope="col">Reminder</th><th scope="col">Category</th><th scope="col">Frequency</th><th scope="col">Expected amount</th><th scope="col">Next due</th><th scope="col">Status</th>{canManage && <th scope="col">Actions</th>}</tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={(isAdmin ? 1 : 0) + 6 + (canManage ? 1 : 0)} className="expenses-empty">Loading reminders…</td></tr>
                    : reminders.length === 0 ? <tr><td colSpan={(isAdmin ? 1 : 0) + 6 + (canManage ? 1 : 0)} className="expenses-empty"><strong>No reminders found</strong><span>Add a monthly or quarterly reminder for expected costs.</span></td></tr>
                    : reminders.map((reminder) => <tr key={reminder.id}>
                      {isAdmin && <td>{reminder.academies?.academy_name || "—"}</td>}
                      <td><div className="expenses-description"><strong>{reminder.title}</strong>{reminder.description && <small>{reminder.description}</small>}</div></td><td>{reminder.category}</td><td><span className="expenses-frequency">{reminder.frequency === "quarterly" ? "Quarterly" : "Monthly"}</span></td><td className="expenses-amount">{formatCurrency(reminder.expected_amount)}</td><td className="expenses-date">{formatDate(reminder.next_due_date)}</td><td><span className={reminder.is_active ? "expenses-status expenses-status-active" : "expenses-status expenses-status-inactive"}>{reminder.is_active ? "Active" : "Inactive"}</span></td>
                      {canManage && <td><div className="expenses-row-actions">{reminder.is_active && <button type="button" className="expenses-text-action" onClick={() => handleRecordOccurrence(reminder)}>Record occurrence</button>}<button type="button" className="expenses-text-action" onClick={() => handleEditReminder(reminder)}>Edit</button><button type="button" className="expenses-text-action expenses-danger-action" onClick={() => handleDeleteReminder(reminder)}>Delete</button></div></td>}
                    </tr>)}
                </tbody>
              </table>
            </div>
          </>}
        </section>
      </div>
    </Layout>
  );
}

export default Expenses;
