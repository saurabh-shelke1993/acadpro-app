-- Remove broad default table privileges for authenticated clients.
-- Re-grant only the CRUD operations required by the Expenses UI.
REVOKE ALL ON TABLE public.expense_reminders FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.expenses FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expense_reminders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expenses TO authenticated;
GRANT ALL ON TABLE public.expense_reminders TO service_role;
GRANT ALL ON TABLE public.expenses TO service_role;
