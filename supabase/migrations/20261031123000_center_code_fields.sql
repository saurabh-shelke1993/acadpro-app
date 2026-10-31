-- Live database schema already updated through approved Supabase migrations.
ALTER TABLE public.centers ADD COLUMN IF NOT EXISTS center_code text;
ALTER TABLE public.centers ADD CONSTRAINT center_code_format_check CHECK (center_code IS NULL OR center_code ~ '^[A-Z0-9]{2,8}$');
CREATE UNIQUE INDEX centers_academy_code_unique ON public.centers (academy_id, upper(center_code)) WHERE center_code IS NOT NULL;
