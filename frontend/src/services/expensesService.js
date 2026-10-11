import { supabase } from "../supabaseClient";
import { isAcademyOwner, isSuperAdmin } from "../utils/roles";

const assertCanView = (user) => {
  if (!isAcademyOwner(user) && !isSuperAdmin(user)) {
    throw new Error("You do not have permission to view Expenses.");
  }
  if (isAcademyOwner(user) && !user?.academy_id) {
    throw new Error("Your user account is not linked to an academy.");
  }
};

const assertCanManage = (user) => {
  if (!isAcademyOwner(user) || !user?.academy_id) {
    throw new Error("Only an Academy Owner can manage Expenses for their academy.");
  }
};

const applyAcademyScope = (query, user, academyId) => {
  if (isAcademyOwner(user)) {
    return query.eq("academy_id", user.academy_id);
  }
  return academyId ? query.eq("academy_id", academyId) : query;
};

export const fetchExpenseAcademies = async (user) => {
  assertCanView(user);

  let query = supabase
    .from("academies")
    .select("id, academy_name")
    .eq("is_active", true)
    .order("academy_name");

  if (isAcademyOwner(user)) {
    query = query.eq("id", user.academy_id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const fetchExpenses = async (user, filters = {}) => {
  assertCanView(user);

  let query = supabase
    .from("expenses")
    .select("id, academy_id, reminder_id, expense_date, category, description, vendor, amount_paid, payment_method, reference_number, notes, created_by, created_at, updated_at, academies(academy_name)")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  query = applyAcademyScope(query, user, filters.academyId);
  if (filters.fromDate) query = query.gte("expense_date", filters.fromDate);
  if (filters.toDate) query = query.lte("expense_date", filters.toDate);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const fetchExpenseReminders = async (user, filters = {}) => {
  assertCanView(user);

  let query = supabase
    .from("expense_reminders")
    .select("id, academy_id, title, category, description, frequency, expected_amount, next_due_date, is_active, notes, created_by, created_at, updated_at, academies(academy_name)")
    .order("next_due_date", { ascending: true })
    .order("title", { ascending: true });

  query = applyAcademyScope(query, user, filters.academyId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const saveExpense = async (user, expense, expenseId = null) => {
  assertCanManage(user);

  const payload = {
    academy_id: user.academy_id,
    expense_date: expense.expense_date,
    category: expense.category.trim(),
    description: expense.description.trim(),
    vendor: expense.vendor?.trim() || null,
    amount_paid: Number(expense.amount_paid),
    payment_method: expense.payment_method || null,
    reference_number: expense.reference_number?.trim() || null,
    reminder_id: expense.reminder_id || null,
    notes: expense.notes?.trim() || null
  };

  const request = expenseId
    ? supabase.from("expenses").update(payload).eq("id", expenseId).eq("academy_id", user.academy_id)
    : supabase.from("expenses").insert({ ...payload, created_by: user.id });

  const { data, error } = await request.select("id");
  if (error) throw error;
  if (expenseId && (!data || data.length === 0)) {
    throw new Error("Expense was not updated. Refresh the list and try again.");
  }
  return data?.[0] || null;
};

export const deleteExpense = async (user, expenseId) => {
  assertCanManage(user);
  const { data, error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .eq("academy_id", user.academy_id)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Expense was not deleted. Refresh the list and try again.");
};

export const saveExpenseReminder = async (user, reminder, reminderId = null) => {
  assertCanManage(user);

  const payload = {
    academy_id: user.academy_id,
    title: reminder.title.trim(),
    category: reminder.category.trim(),
    description: reminder.description?.trim() || null,
    frequency: reminder.frequency,
    expected_amount: Number(reminder.expected_amount),
    next_due_date: reminder.next_due_date,
    is_active: Boolean(reminder.is_active),
    notes: reminder.notes?.trim() || null
  };

  const request = reminderId
    ? supabase.from("expense_reminders").update(payload).eq("id", reminderId).eq("academy_id", user.academy_id)
    : supabase.from("expense_reminders").insert({ ...payload, created_by: user.id });

  const { data, error } = await request.select("id");
  if (error) throw error;
  if (reminderId && (!data || data.length === 0)) {
    throw new Error("Reminder was not updated. Refresh the list and try again.");
  }
  return data?.[0] || null;
};

export const deleteExpenseReminder = async (user, reminderId) => {
  assertCanManage(user);
  const { data, error } = await supabase
    .from("expense_reminders")
    .delete()
    .eq("id", reminderId)
    .eq("academy_id", user.academy_id)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Reminder was not deleted. Refresh the list and try again.");
};
