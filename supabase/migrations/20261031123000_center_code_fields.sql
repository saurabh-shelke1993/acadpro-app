-- CEN3 center codes. Applied live using approved Supabase migrations on 2026-10-31.
-- Idempotent to avoid duplicate constraint when synchronizing repository migration history.
ALTER TABLE public.centers ADD COLUMN IF NOT EXISTS center_code text;
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.centers'::regclass
      AND conname = 'center_code_format_check'
  ) THEN
    ALTER TABLE public.centers
      ADD CONSTRAINT center_code_format_check
      CHECK (center_code IS NULL OR center_code ~ '^[A-Z0-9]{2,8}$');
  END IF;
END;
$migration$;
CREATE UNIQUE INDEX IF NOT EXISTS centers_academy_code_unique
  ON public.centers (academy_id, upper(center_code))
  WHERE center_code IS NOT NULL;
