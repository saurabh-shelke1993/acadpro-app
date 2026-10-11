-- Phase 7 security remediation.
-- These two tables are empty and have no current frontend references.
-- Until an explicit access model is implemented, deny direct client access.
ALTER TABLE public.trial_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.trial_attendance FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.inquiries FROM anon, authenticated;

-- payment_number_counters intentionally remains RLS-enabled with no client policies.
-- Existing grants are limited to postgres/service_role for server-side number generation.
REVOKE ALL PRIVILEGES ON TABLE public.payment_number_counters FROM anon, authenticated;
