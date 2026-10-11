# Phase 7 — Security Advisor remediation

Date: 2026-10-11
Branch: payment-module-finalization

## Completed: public table lockdown

Migration: `supabase/migrations/20261011140000_phase_7_lock_down_unused_public_tables.sql`

Applied to the connected Supabase project and committed to the repository.

- Enabled RLS on `public.trial_attendance` and `public.inquiries`.
- Revoked direct `anon` and `authenticated` table privileges on both tables.
- Revoked direct client privileges on `public.payment_number_counters`; the table remains available to server-side `service_role` and database administration.
- Verified RLS is enabled on all three tables and that anon/authenticated cannot SELECT or INSERT. `service_role` retains SELECT access.
- At the time of remediation, `trial_attendance` and `inquiries` had zero rows. No matching references were found in the repository search. Client-side use of these tables is intentionally blocked until an explicit access model is designed.

## Security Definer RPC review

The following functions remain executable by `authenticated` intentionally because they implement app workflows. Anonymous execution was verified as false for each. Their `search_path` is set to an empty path, and referenced objects are schema-qualified.

- `approve_payment_correction(uuid)`: checks authenticated user, role, pending status, and academy scope for academy owners.
- `collect_payment(uuid, numeric, text, text)`: checks authenticated user, role, payment mode/amount, due state, and academy scope for academy owners.
- `reject_payment_correction(uuid, text)`: checks authenticated user, role, reason, pending status, and academy scope for academy owners.
- `request_payment_correction(uuid, numeric, text)`: checks authenticated user, role, payment, amount/reason, duplicate pending requests, and academy scope for academy owners.
- `get_parent_child_coaches()` and `get_parent_coach_profiles()`: constrain results to the current parent and require the current role to be `parent`.
- `update_my_coach_profile(...)`: updates only the active coach record whose `user_id = auth.uid()`.

These seven findings remain in Supabase Advisor as warnings because authenticated execution of SECURITY DEFINER functions is still a linter finding. Do not revoke authenticated execution or switch these functions to SECURITY INVOKER without redesigning and regression-testing the dependent workflows.

## Remaining action

- Enable leaked-password protection in Supabase Dashboard under Authentication / Auth settings (Email provider / Password security, wording may vary). Supabase indicates this feature is available on Pro plan and above.
- Re-run Security Advisor after enabling the setting.
- Revisit RLS policies for `trial_attendance` and `inquiries` before any frontend/API workflow is added for these tables.
- RLS-enabled/no-policy findings for `trial_attendance`, `inquiries`, and `payment_number_counters` are intentional deny-by-default configurations pending a justified policy model.
