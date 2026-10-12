-- P1.6 follow-up: preserve recurring occurrence history and keep reminder deletion semantics safe.

CREATE OR REPLACE FUNCTION private.prevent_expense_reminder_relink()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF OLD.reminder_id IS DISTINCT FROM NEW.reminder_id THEN
    -- Deleting a reminder is allowed to SET NULL on existing linked expenses;
    -- ordinary client updates cannot attach, detach, or reassign the reminder.
    IF NEW.reminder_id IS NULL
       AND OLD.reminder_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM public.expense_reminders
         WHERE id = OLD.reminder_id
       ) THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'A recurring reminder cannot be linked or changed on an existing expense; record a new occurrence instead';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.prevent_recurring_expense_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF OLD.reminder_id IS NOT NULL THEN
    RAISE EXCEPTION 'A recorded recurring expense cannot be deleted; edit its details to correct the record and preserve occurrence history';
  END IF;
  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION private.prevent_expense_reminder_relink() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.prevent_recurring_expense_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS expenses_prevent_reminder_relink ON public.expenses;
CREATE TRIGGER expenses_prevent_reminder_relink
  BEFORE UPDATE OF reminder_id ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_expense_reminder_relink();

DROP TRIGGER IF EXISTS expenses_prevent_recurring_delete ON public.expenses;
CREATE TRIGGER expenses_prevent_recurring_delete
  BEFORE DELETE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_recurring_expense_delete();
