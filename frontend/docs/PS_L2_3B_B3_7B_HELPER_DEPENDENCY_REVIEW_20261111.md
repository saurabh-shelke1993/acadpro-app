# Kheltriva — B3.7B Historical Helper Dependency Disposition

**11 November 2026** · payment-module-finalization · **READ-ONLY, NO SQL EXECUTED**

The original migration ledger identifies the first private-helper consumer as `20260903173804`. Its original source creates `private.coach_academy_id`, four Coach Batch Assignment policies, and grants USAGE on the private schema. It also calls four foundational helpers whose authentic original CREATE statements are absent: `private.is_super_admin`, `private.is_academy_owner`, `private.current_academy_id`, and `private.batch_academy_id`. No original CREATE SCHEMA private was found in the 82-version retained source audit.

The original `private.current_parent_id` created at `20260908062059` uses email-based parent resolution. At `20260912142706`, the schema adds `parents.user_id` and revises the helper. The modern helper cannot be inserted before the column exists without changing historical semantics.

**Three options, none approved:** (1) Recover independently trustworthy original function/schema creation source; (2) build an explicitly nonhistorical, disposable-only reconstruction from B2.9's current-state helper fixture, with exact grants, body, search-path and actual Supabase Auth/RLS negative tests; (3) design a new audited current-state baseline, an architectural change requiring separate approval.

The second option is the most practical *test strategy*, but is not evidence of authentic historical migration replay, and cannot be selected silently. Original-source review also still requires the six divergences, 14 quarantined data/DDL splits, 82-version security provenance and a full unlinked disposable Auth/RLS/finance/Storage baseline.

**Status:** B3.7B first-use dependency investigation reviewed; reconstruction strategy and B3 replay NOT APPROVED. B4 integration cannot be certified. No production, canonical migrations or customer/financial data modified. [Non-executable structural record](../../supabase/recovery/historical-baseline/b3_7b_dependency_review_20261111.json).
