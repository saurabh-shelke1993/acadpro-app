-- Revert the mistakenly scoped P1.6 Expenses feature work.
-- P1.6 belongs to the parent UPI payment integration release gate, not a new
-- Expenses feature. Keep the two applied migrations in history and compensate
-- for their database changes rather than deleting/re-writing ledger entries.

DROP TRIGGER IF EXISTS expenses_prevent_recurring_delete ON public.expenses;
DROP TRIGGER IF EXISTS expenses_prevent_reminder_relink ON public.expenses;

DROP FUNCTION IF EXISTS private.prevent_recurring_expense_delete();
DROP FUNCTION IF EXISTS private.prevent_expense_reminder_relink();
DROP FUNCTION IF EXISTS public.record_expense_occurrence(uuid, date, numeric, text, text, text, text, text);

-- Restore the original Expenses insert policy from the foundation migration.
DROP POLICY IF EXISTS expenses_insert_owner ON public.expenses;
CREATE POLICY expenses_insert_owner
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (
    private.is_academy_owner()
    AND academy_id = (SELECT private.current_academy_id())
    AND (created_by IS NULL OR created_by = (SELECT auth.uid()))
  );

-- No expense/payment rows are deleted or rewritten by this rollback.
