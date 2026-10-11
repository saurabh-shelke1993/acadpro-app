-- HISTORICAL PROPOSAL — superseded by the applied migrations below.
-- Do not run this proposal file directly against production.
-- Active migrations: 20261011135131_expenses_module_foundation and 20261011135208_tighten_expenses_table_grants.
--
-- Expense model:
--   * expense_reminders stores recurring expectations (monthly/quarterly).
--   * expenses stores only manually recorded actual expense transactions.
--   * No reminder automatically inserts an expense or marks anything as paid.
--   * Academy Owners manage records in their own academy.
--   * Super Admin has read-only access.
--   * Coach, Parent, anon and PUBLIC have no table access.

BEGIN;

CREATE TABLE public.expense_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid NOT NULL
    REFERENCES public.academies(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  category text NOT NULL CHECK (length(btrim(category)) > 0),
  description text,
  frequency text NOT NULL
    CHECK (frequency IN ('monthly', 'quarterly')),
  expected_amount numeric(12,2) NOT NULL CHECK (expected_amount > 0),
  next_due_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_reminders_id_academy_unique UNIQUE (id, academy_id)
);

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid NOT NULL
    REFERENCES public.academies(id) ON DELETE RESTRICT,
  reminder_id uuid,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL CHECK (length(btrim(category)) > 0),
  description text NOT NULL CHECK (length(btrim(description)) > 0),
  vendor text,
  amount_paid numeric(12,2) NOT NULL CHECK (amount_paid > 0),
  payment_method text,
  reference_number text,
  notes text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expenses_reminder_same_academy_fkey
    FOREIGN KEY (reminder_id, academy_id)
    REFERENCES public.expense_reminders(id, academy_id)
    ON DELETE SET NULL (reminder_id)
);

CREATE INDEX expense_reminders_academy_due_idx
  ON public.expense_reminders (academy_id, is_active, next_due_date);

CREATE INDEX expenses_academy_date_idx
  ON public.expenses (academy_id, expense_date DESC);

ALTER TABLE public.expense_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Explicit table grants: current default privileges are broad, so do not rely
-- on defaults for newly created public-schema tables.
REVOKE ALL ON TABLE public.expense_reminders FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.expenses FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expense_reminders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expenses TO authenticated;
GRANT ALL ON TABLE public.expense_reminders TO service_role;
GRANT ALL ON TABLE public.expenses TO service_role;

-- Reminders: Academy Owner can manage only their own academy; Super Admin can read.
CREATE POLICY expense_reminders_select_owner_or_super_admin
  ON public.expense_reminders
  FOR SELECT TO authenticated
  USING (
    (private.is_academy_owner()
      AND academy_id = (SELECT private.current_academy_id()))
    OR (SELECT private.is_super_admin())
  );

CREATE POLICY expense_reminders_insert_owner
  ON public.expense_reminders
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_academy_owner()
    AND academy_id = (SELECT private.current_academy_id())
  );

CREATE POLICY expense_reminders_update_owner
  ON public.expense_reminders
  FOR UPDATE TO authenticated
  USING (
    private.is_academy_owner()
    AND academy_id = (SELECT private.current_academy_id())
  )
  WITH CHECK (
    private.is_academy_owner()
    AND academy_id = (SELECT private.current_academy_id())
  );

CREATE POLICY expense_reminders_delete_owner
  ON public.expense_reminders
  FOR DELETE TO authenticated
  USING (
    private.is_academy_owner()
    AND academy_id = (SELECT private.current_academy_id())
  );

-- Expenses: Academy Owner can manage their own academy; Super Admin can read.
CREATE POLICY expenses_select_owner_or_super_admin
  ON public.expenses
  FOR SELECT TO authenticated
  USING (
    (private.is_academy_owner()
      AND academy_id = (SELECT private.current_academy_id()))
    OR (SELECT private.is_super_admin())
  );

CREATE POLICY expenses_insert_owner
  ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_academy_owner()
    AND academy_id = (SELECT private.current_academy_id())
  );

CREATE POLICY expenses_update_owner
  ON public.expenses
  FOR UPDATE TO authenticated
  USING (
    private.is_academy_owner()
    AND academy_id = (SELECT private.current_academy_id())
  )
  WITH CHECK (
    private.is_academy_owner()
    AND academy_id = (SELECT private.current_academy_id())
  );

CREATE POLICY expenses_delete_owner
  ON public.expenses
  FOR DELETE TO authenticated
  USING (
    private.is_academy_owner()
    AND academy_id = (SELECT private.current_academy_id())
  );

-- Keep updated_at consistent without granting clients direct function execution.
CREATE OR REPLACE FUNCTION private.set_expenses_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.set_expenses_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER expense_reminders_set_updated_at
  BEFORE UPDATE ON public.expense_reminders
  FOR EACH ROW EXECUTE FUNCTION private.set_expenses_updated_at();

CREATE TRIGGER expenses_set_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION private.set_expenses_updated_at();

COMMIT;
