-- P1.6: record a recurring expense occurrence and advance its reminder atomically.
-- Actual expenses remain manually recorded; a reminder alone never creates a payment.

CREATE OR REPLACE FUNCTION public.record_expense_occurrence(
  p_reminder_id uuid,
  p_expense_date date,
  p_amount_paid numeric,
  p_description text DEFAULT NULL,
  p_vendor text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_reference_number text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_academy_id uuid;
  v_reminder public.expense_reminders%rowtype;
  v_expense public.expenses%rowtype;
  v_description text;
  v_next_due_date date;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_role := private.current_user_role();
  IF v_role <> 'academy_owner' THEN
    RAISE EXCEPTION 'Only the Academy Owner can record recurring expenses';
  END IF;

  v_academy_id := private.current_academy_id();
  IF v_academy_id IS NULL THEN
    RAISE EXCEPTION 'Your user account is not linked to an academy';
  END IF;

  IF p_reminder_id IS NULL THEN
    RAISE EXCEPTION 'Select a recurring expense reminder';
  END IF;
  IF p_expense_date IS NULL THEN
    RAISE EXCEPTION 'Expense date is required';
  END IF;
  IF p_amount_paid IS NULL OR p_amount_paid <= 0 OR p_amount_paid > 9999999999 THEN
    RAISE EXCEPTION 'Enter a valid expense amount greater than zero';
  END IF;
  IF p_vendor IS NOT NULL AND length(p_vendor) > 120 THEN
    RAISE EXCEPTION 'Vendor must be 120 characters or fewer';
  END IF;
  IF p_payment_method IS NOT NULL
     AND p_payment_method NOT IN ('Cash', 'UPI', 'Bank Transfer', 'Card', 'Cheque', 'Other') THEN
    RAISE EXCEPTION 'Unsupported expense payment method';
  END IF;
  IF p_reference_number IS NOT NULL AND length(p_reference_number) > 100 THEN
    RAISE EXCEPTION 'Reference number must be 100 characters or fewer';
  END IF;
  IF p_notes IS NOT NULL AND length(p_notes) > 1000 THEN
    RAISE EXCEPTION 'Notes must be 1000 characters or fewer';
  END IF;

  SELECT *
  INTO v_reminder
  FROM public.expense_reminders
  WHERE id = p_reminder_id
    AND academy_id = v_academy_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recurring reminder not found for your academy';
  END IF;
  IF NOT v_reminder.is_active THEN
    RAISE EXCEPTION 'This recurring reminder is inactive';
  END IF;
  IF v_reminder.frequency NOT IN ('monthly', 'quarterly') THEN
    RAISE EXCEPTION 'Unsupported recurring reminder frequency';
  END IF;

  v_description := COALESCE(NULLIF(pg_catalog.btrim(p_description), ''), v_reminder.title);
  IF length(v_description) > 180 THEN
    RAISE EXCEPTION 'Expense description must be 180 characters or fewer';
  END IF;

  INSERT INTO public.expenses (
    academy_id, reminder_id, expense_date, category, description,
    vendor, amount_paid, payment_method, reference_number, notes, created_by
  )
  VALUES (
    v_academy_id, v_reminder.id, p_expense_date, v_reminder.category, v_description,
    NULLIF(pg_catalog.btrim(p_vendor), ''), p_amount_paid, p_payment_method,
    NULLIF(pg_catalog.btrim(p_reference_number), ''), NULLIF(pg_catalog.btrim(p_notes), ''),
    v_user_id
  )
  RETURNING * INTO v_expense;

  v_next_due_date := CASE
    WHEN v_reminder.frequency = 'monthly'
      THEN (v_reminder.next_due_date + interval '1 month')::date
    ELSE (v_reminder.next_due_date + interval '3 months')::date
  END;

  UPDATE public.expense_reminders
  SET next_due_date = v_next_due_date,
      updated_at = pg_catalog.now()
  WHERE id = v_reminder.id;

  RETURN v_expense;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_expense_occurrence(uuid, date, numeric, text, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_expense_occurrence(uuid, date, numeric, text, text, text, text, text)
  TO authenticated;

-- Linked recurring occurrences must use the atomic RPC so the due date cannot
-- silently remain unchanged when an expense is inserted through the client API.
DROP POLICY IF EXISTS expenses_insert_owner ON public.expenses;
CREATE POLICY expenses_insert_owner
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (
    reminder_id IS NULL
    AND private.is_academy_owner()
    AND academy_id = (SELECT private.current_academy_id())
    AND (created_by IS NULL OR created_by = (SELECT auth.uid()))
  );


-- Existing expense edits must not bypass the occurrence RPC by attaching or
-- reassigning a reminder without advancing its schedule.
CREATE OR REPLACE FUNCTION private.prevent_expense_reminder_relink()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF OLD.reminder_id IS DISTINCT FROM NEW.reminder_id THEN
    RAISE EXCEPTION 'A recurring reminder cannot be linked or changed on an existing expense; record a new occurrence instead';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.prevent_expense_reminder_relink() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS expenses_prevent_reminder_relink ON public.expenses;
CREATE TRIGGER expenses_prevent_reminder_relink
  BEFORE UPDATE OF reminder_id ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_expense_reminder_relink();
