-- A primary-key lookup returns at most one settings row per academy, so this
-- partial index duplicates the primary-key access path and is unnecessary.
DROP INDEX IF EXISTS public.academy_payment_settings_enabled_idx;
