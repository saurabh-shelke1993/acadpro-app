-- AcadPro Enquiries R2: schema foundation and least-privilege database access.
-- Forward-only migration. Does not modify trial_attendance or historical migrations.
-- Existing client access remains deny-by-default until this migration commits atomically.

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.inquiries
    WHERE academy_id IS NULL
       OR nullif(pg_catalog.btrim(player_name), '') IS NULL
       OR nullif(pg_catalog.btrim(phone), '') IS NULL
       OR dob IS NULL
       OR pg_catalog.regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') !~ '^[0-9]{10}$'
  ) THEN
    RAISE EXCEPTION
      'Enquiries R2 preflight failed: existing enquiries contain missing academy/player/phone/DOB data or a non-10-digit normalized phone. Backfill and review before retrying.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.inquiries
    WHERE trial_status IS NOT NULL
      AND lower(pg_catalog.btrim(trial_status)) NOT IN (
        'pending', 'new', 'contacted', 'scheduled', 'trial_scheduled',
        'completed', 'trial_completed', 'follow_up_required', 'lost'
      )
  ) THEN
    RAISE EXCEPTION
      'Enquiries R2 preflight failed: an existing enquiry has an unsupported legacy trial_status. Review and map it before retrying.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.inquiries
    WHERE lower(pg_catalog.btrim(coalesce(trial_status, ''))) = 'converted'
  ) THEN
    RAISE EXCEPTION
      'Enquiries R2 preflight failed: legacy converted enquiries need a verified player link before conversion invariants can be enabled.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.inquiries
    WHERE inquiry_source IS NOT NULL
      AND lower(pg_catalog.btrim(inquiry_source)) NOT IN (
        'facebook', 'instagram', 'phone call', 'phone_call', 'phone',
        'walk-in / on-premises', 'walk-in', 'walk in', 'referral', 'other'
      )
  ) THEN
    RAISE EXCEPTION
      'Enquiries R2 preflight failed: an existing inquiry_source is outside the supported source list. Review and map it before retrying.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.inquiries i
    WHERE lower(pg_catalog.btrim(coalesce(i.trial_status, ''))) IN ('scheduled', 'trial_scheduled')
      AND NOT EXISTS (
        SELECT 1 FROM public.trial_attendance ta
        WHERE ta.inquiry_id = i.id
      )
  ) THEN
    RAISE EXCEPTION
      'Enquiries R2 preflight failed: a scheduled legacy trial has no trial date to migrate. Review it before retrying.';
  END IF;
END;
$preflight$;

-- Keep the existing table and foreign keys; make the quick-capture fields accurate.
ALTER TABLE public.inquiries
  ALTER COLUMN parent_name DROP NOT NULL;

ALTER TABLE public.inquiries
  ALTER COLUMN academy_id SET NOT NULL,
  ALTER COLUMN dob SET NOT NULL;

UPDATE public.inquiries
SET phone = pg_catalog.regexp_replace(phone, '[^0-9]', '', 'g'),
    player_name = pg_catalog.btrim(player_name);

-- Preserve the legacy status column's data while moving to the V1 lifecycle.
DO $rename_status$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inquiries' AND column_name = 'trial_status'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inquiries' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.inquiries RENAME COLUMN trial_status TO status;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inquiries' AND column_name = 'status'
  ) THEN
    RAISE EXCEPTION 'Enquiries R2 migration expected either trial_status or status on public.inquiries.';
  END IF;
END;
$rename_status$;

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS trial_date date,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  ADD COLUMN IF NOT EXISTS converted_player_id uuid,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_by uuid;

-- Canonicalize known legacy values; unsupported values were rejected in preflight.
UPDATE public.inquiries
SET status = CASE lower(pg_catalog.btrim(coalesce(status, 'pending')))
  WHEN 'pending' THEN 'new'
  WHEN 'new' THEN 'new'
  WHEN 'contacted' THEN 'contacted'
  WHEN 'scheduled' THEN 'trial_scheduled'
  WHEN 'trial_scheduled' THEN 'trial_scheduled'
  WHEN 'completed' THEN 'trial_completed'
  WHEN 'trial_completed' THEN 'trial_completed'
  WHEN 'follow_up_required' THEN 'follow_up_required'
  WHEN 'lost' THEN 'lost'
  ELSE status
END;

UPDATE public.inquiries i
SET trial_date = (
  SELECT min(ta.trial_date)
  FROM public.trial_attendance ta
  WHERE ta.inquiry_id = i.id
)
WHERE i.status = 'trial_scheduled'
  AND i.trial_date IS NULL;

UPDATE public.inquiries
SET inquiry_source = CASE lower(pg_catalog.btrim(inquiry_source))
  WHEN 'facebook' THEN 'Facebook'
  WHEN 'instagram' THEN 'Instagram'
  WHEN 'phone call' THEN 'Phone Call'
  WHEN 'phone_call' THEN 'Phone Call'
  WHEN 'phone' THEN 'Phone Call'
  WHEN 'walk-in / on-premises' THEN 'Walk-in / On-premises'
  WHEN 'walk-in' THEN 'Walk-in / On-premises'
  WHEN 'walk in' THEN 'Walk-in / On-premises'
  WHEN 'referral' THEN 'Referral'
  WHEN 'other' THEN 'Other'
  ELSE NULL
END
WHERE inquiry_source IS NOT NULL;

-- Every row created through the new RPCs has a creator. Historical rows may not.
ALTER TABLE public.inquiries
  ALTER COLUMN status SET DEFAULT 'new',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT pg_catalog.now();

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.inquiries'::regclass AND conname = 'inquiries_status_check'
  ) THEN
    ALTER TABLE public.inquiries
      ADD CONSTRAINT inquiries_status_check
      CHECK (status IN (
        'new', 'contacted', 'trial_scheduled', 'trial_completed',
        'follow_up_required', 'converted', 'lost'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.inquiries'::regclass AND conname = 'inquiries_source_check'
  ) THEN
    ALTER TABLE public.inquiries
      ADD CONSTRAINT inquiries_source_check
      CHECK (inquiry_source IS NULL OR inquiry_source IN (
        'Facebook', 'Instagram', 'Phone Call',
        'Walk-in / On-premises', 'Referral', 'Other'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.inquiries'::regclass AND conname = 'inquiries_trial_scheduled_requires_date'
  ) THEN
    ALTER TABLE public.inquiries
      ADD CONSTRAINT inquiries_trial_scheduled_requires_date
      CHECK (status <> 'trial_scheduled' OR trial_date IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.inquiries'::regclass AND conname = 'inquiries_conversion_link_check'
  ) THEN
    ALTER TABLE public.inquiries
      ADD CONSTRAINT inquiries_conversion_link_check
      CHECK (
        (status = 'converted'
          AND converted_player_id IS NOT NULL
          AND converted_at IS NOT NULL
          AND converted_by IS NOT NULL)
        OR
        (status <> 'converted'
          AND converted_player_id IS NULL
          AND converted_at IS NULL
          AND converted_by IS NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.inquiries'::regclass AND conname = 'inquiries_created_by_fkey'
  ) THEN
    ALTER TABLE public.inquiries
      ADD CONSTRAINT inquiries_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.inquiries'::regclass AND conname = 'inquiries_converted_player_id_fkey'
  ) THEN
    ALTER TABLE public.inquiries
      ADD CONSTRAINT inquiries_converted_player_id_fkey
      FOREIGN KEY (converted_player_id) REFERENCES public.players(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.inquiries'::regclass AND conname = 'inquiries_converted_by_fkey'
  ) THEN
    ALTER TABLE public.inquiries
      ADD CONSTRAINT inquiries_converted_by_fkey
      FOREIGN KEY (converted_by) REFERENCES public.users(id) ON DELETE RESTRICT;
  END IF;
END;
$constraints$;

CREATE INDEX IF NOT EXISTS inquiries_academy_created_at_idx
  ON public.inquiries (academy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS inquiries_academy_center_status_idx
  ON public.inquiries (academy_id, assigned_center_id, status);
CREATE INDEX IF NOT EXISTS inquiries_academy_phone_player_idx
  ON public.inquiries (academy_id, phone, lower(pg_catalog.btrim(player_name)));
CREATE UNIQUE INDEX IF NOT EXISTS inquiries_converted_player_unique_idx
  ON public.inquiries (converted_player_id)
  WHERE converted_player_id IS NOT NULL;

-- Small, boolean-only scope helper. It exposes no center or coach records.
CREATE OR REPLACE FUNCTION private.inquiry_can_access_center(p_center_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE(
    private.current_user_role() = 'coach'
    AND p_center_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.coaches c
      JOIN public.coach_batch_assignments cba
        ON cba.coach_id = c.id
      JOIN public.batches b
        ON b.id = cba.batch_id
      JOIN public.centers ctr
        ON ctr.id = b.center_id
      WHERE c.user_id = auth.uid()
        AND c.is_active = true
        AND c.academy_id = private.current_academy_id()
        AND cba.is_active = true
        AND cba.academy_id = private.current_academy_id()
        AND b.is_active = true
        AND b.academy_id = private.current_academy_id()
        AND ctr.id = p_center_id
        AND ctr.is_active = true
        AND ctr.academy_id = private.current_academy_id()
    ),
    false
  );
$function$;

REVOKE ALL ON FUNCTION private.inquiry_can_access_center(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.inquiry_can_access_center(uuid) TO authenticated;

-- Read access is scoped by RLS. All writes use validated RPCs below.
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.inquiries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.inquiries TO authenticated;

DROP POLICY IF EXISTS inquiries_select_scoped ON public.inquiries;
CREATE POLICY inquiries_select_scoped
ON public.inquiries
FOR SELECT
TO authenticated
USING (
  private.is_super_admin()
  OR (
    private.is_academy_owner()
    AND academy_id = private.current_academy_id()
  )
  OR (
    private.is_coach()
    AND academy_id = private.current_academy_id()
    AND private.inquiry_can_access_center(assigned_center_id)
  )
);

-- Maintain updated_at for all updates, including conversion.
CREATE OR REPLACE FUNCTION private.set_inquiry_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.set_inquiry_updated_at() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS inquiries_set_updated_at ON public.inquiries;
CREATE TRIGGER inquiries_set_updated_at
BEFORE UPDATE ON public.inquiries
FOR EACH ROW
EXECUTE FUNCTION private.set_inquiry_updated_at();

CREATE OR REPLACE FUNCTION public.create_inquiry(
  p_player_name text,
  p_phone text,
  p_dob date,
  p_inquiry_source text,
  p_assigned_center_id uuid,
  p_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
  v_academy_id uuid;
  v_player_name text;
  v_phone text;
  v_source text;
  v_inquiry_id uuid;
BEGIN
  v_role := private.current_user_role();
  v_academy_id := private.current_academy_id();

  IF v_role NOT IN ('academy_owner', 'coach') OR v_academy_id IS NULL THEN
    RAISE EXCEPTION 'Only an Academy Owner or authorized Coach can create an enquiry.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.academies a
    WHERE a.id = v_academy_id AND a.is_active = true
  ) THEN
    RAISE EXCEPTION 'The current academy is inactive or unavailable.'
      USING ERRCODE = '42501';
  END IF;

  v_player_name := nullif(pg_catalog.btrim(coalesce(p_player_name, '')), '');
  v_phone := pg_catalog.regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');

  IF v_player_name IS NULL OR pg_catalog.char_length(v_player_name) > 120 THEN
    RAISE EXCEPTION 'Player name is required and must be 120 characters or fewer.'
      USING ERRCODE = '22023';
  END IF;
  IF v_phone !~ '^[0-9]{10}$' THEN
    RAISE EXCEPTION 'Parent contact must normalize to exactly 10 digits.'
      USING ERRCODE = '22023';
  END IF;
  IF p_dob IS NULL OR p_dob > CURRENT_DATE THEN
    RAISE EXCEPTION 'A valid date of birth that is not in the future is required.'
      USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.char_length(coalesce(p_notes, '')) > 2000 THEN
    RAISE EXCEPTION 'Notes must be 2000 characters or fewer.'
      USING ERRCODE = '22023';
  END IF;

  v_source := CASE lower(pg_catalog.btrim(coalesce(p_inquiry_source, '')))
    WHEN '' THEN NULL
    WHEN 'facebook' THEN 'Facebook'
    WHEN 'instagram' THEN 'Instagram'
    WHEN 'phone call' THEN 'Phone Call'
    WHEN 'phone_call' THEN 'Phone Call'
    WHEN 'phone' THEN 'Phone Call'
    WHEN 'walk-in / on-premises' THEN 'Walk-in / On-premises'
    WHEN 'walk-in' THEN 'Walk-in / On-premises'
    WHEN 'walk in' THEN 'Walk-in / On-premises'
    WHEN 'referral' THEN 'Referral'
    WHEN 'other' THEN 'Other'
    ELSE NULL
  END;

  IF nullif(pg_catalog.btrim(coalesce(p_inquiry_source, '')), '') IS NOT NULL
     AND v_source IS NULL THEN
    RAISE EXCEPTION 'Unsupported enquiry source.'
      USING ERRCODE = '22023';
  END IF;

  IF v_role = 'coach' THEN
    IF p_assigned_center_id IS NULL
       OR NOT private.inquiry_can_access_center(p_assigned_center_id) THEN
      RAISE EXCEPTION 'Coach must select a center in their active authorized scope.'
        USING ERRCODE = '42501';
    END IF;
  ELSIF p_assigned_center_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.centers ctr
    WHERE ctr.id = p_assigned_center_id
      AND ctr.academy_id = v_academy_id
      AND ctr.is_active = true
  ) THEN
    RAISE EXCEPTION 'Selected center is not active in this academy.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.inquiries (
    academy_id, parent_name, player_name, phone, dob, inquiry_source,
    assigned_center_id, assigned_batch_id, status, notes, created_by, updated_at
  )
  VALUES (
    v_academy_id, NULL, v_player_name, v_phone, p_dob, v_source,
    p_assigned_center_id, NULL, 'new', nullif(pg_catalog.btrim(coalesce(p_notes, '')), ''),
    auth.uid(), pg_catalog.now()
  )
  RETURNING id INTO v_inquiry_id;

  RETURN v_inquiry_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_inquiry(text, text, date, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_inquiry(text, text, date, text, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_inquiry(
  p_inquiry_id uuid,
  p_player_name text,
  p_phone text,
  p_dob date,
  p_inquiry_source text,
  p_assigned_center_id uuid,
  p_notes text,
  p_status text,
  p_trial_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
  v_academy_id uuid;
  v_inquiry public.inquiries%ROWTYPE;
  v_player_name text;
  v_phone text;
  v_source text;
  v_status text;
BEGIN
  v_role := private.current_user_role();
  v_academy_id := private.current_academy_id();

  IF v_role NOT IN ('academy_owner', 'coach') OR v_academy_id IS NULL THEN
    RAISE EXCEPTION 'Only an Academy Owner or authorized Coach can update an enquiry.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inquiry
  FROM public.inquiries i
  WHERE i.id = p_inquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enquiry was not found.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_inquiry.academy_id <> v_academy_id THEN
    RAISE EXCEPTION 'Enquiry is outside the current academy.'
      USING ERRCODE = '42501';
  END IF;

  IF v_role = 'coach' THEN
    IF NOT private.inquiry_can_access_center(v_inquiry.assigned_center_id) THEN
      RAISE EXCEPTION 'Enquiry is outside the coach''s authorized center scope.'
        USING ERRCODE = '42501';
    END IF;
    IF p_assigned_center_id IS NULL
       OR NOT private.inquiry_can_access_center(p_assigned_center_id) THEN
      RAISE EXCEPTION 'Coach can only assign an enquiry to an active authorized center.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_inquiry.status = 'converted' THEN
    RAISE EXCEPTION 'Converted enquiries are immutable.'
      USING ERRCODE = '23514';
  END IF;
  IF lower(pg_catalog.btrim(coalesce(p_status, ''))) = 'converted' THEN
    RAISE EXCEPTION 'Use the Academy Owner conversion workflow to convert an enquiry.'
      USING ERRCODE = '23514';
  END IF;

  v_player_name := nullif(pg_catalog.btrim(coalesce(p_player_name, '')), '');
  v_phone := pg_catalog.regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_status := lower(pg_catalog.btrim(coalesce(p_status, '')));

  IF v_player_name IS NULL OR pg_catalog.char_length(v_player_name) > 120 THEN
    RAISE EXCEPTION 'Player name is required and must be 120 characters or fewer.'
      USING ERRCODE = '22023';
  END IF;
  IF v_phone !~ '^[0-9]{10}$' THEN
    RAISE EXCEPTION 'Parent contact must normalize to exactly 10 digits.'
      USING ERRCODE = '22023';
  END IF;
  IF p_dob IS NULL OR p_dob > CURRENT_DATE THEN
    RAISE EXCEPTION 'A valid date of birth that is not in the future is required.'
      USING ERRCODE = '22023';
  END IF;
  IF v_status NOT IN ('new', 'contacted', 'trial_scheduled', 'trial_completed', 'follow_up_required', 'lost') THEN
    RAISE EXCEPTION 'Unsupported enquiry status.'
      USING ERRCODE = '22023';
  END IF;
  IF v_status = 'trial_scheduled' AND p_trial_date IS NULL THEN
    RAISE EXCEPTION 'A trial date is required for Trial Scheduled status.'
      USING ERRCODE = '22023';
  END IF;
  IF v_inquiry.status = 'lost' AND v_status <> 'lost' AND v_role <> 'academy_owner' THEN
    RAISE EXCEPTION 'Only the Academy Owner can reopen a Lost enquiry.'
      USING ERRCODE = '42501';
  END IF;
  IF pg_catalog.char_length(coalesce(p_notes, '')) > 2000 THEN
    RAISE EXCEPTION 'Notes must be 2000 characters or fewer.'
      USING ERRCODE = '22023';
  END IF;

  v_source := CASE lower(pg_catalog.btrim(coalesce(p_inquiry_source, '')))
    WHEN '' THEN NULL
    WHEN 'facebook' THEN 'Facebook'
    WHEN 'instagram' THEN 'Instagram'
    WHEN 'phone call' THEN 'Phone Call'
    WHEN 'phone_call' THEN 'Phone Call'
    WHEN 'phone' THEN 'Phone Call'
    WHEN 'walk-in / on-premises' THEN 'Walk-in / On-premises'
    WHEN 'walk-in' THEN 'Walk-in / On-premises'
    WHEN 'walk in' THEN 'Walk-in / On-premises'
    WHEN 'referral' THEN 'Referral'
    WHEN 'other' THEN 'Other'
    ELSE NULL
  END;

  IF nullif(pg_catalog.btrim(coalesce(p_inquiry_source, '')), '') IS NOT NULL
     AND v_source IS NULL THEN
    RAISE EXCEPTION 'Unsupported enquiry source.'
      USING ERRCODE = '22023';
  END IF;

  IF p_assigned_center_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.centers ctr
    WHERE ctr.id = p_assigned_center_id
      AND ctr.academy_id = v_academy_id
      AND ctr.is_active = true
  ) THEN
    RAISE EXCEPTION 'Selected center is not active in this academy.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.inquiries
  SET player_name = v_player_name,
      phone = v_phone,
      dob = p_dob,
      inquiry_source = v_source,
      assigned_center_id = p_assigned_center_id,
      notes = nullif(pg_catalog.btrim(coalesce(p_notes, '')), ''),
      status = v_status,
      trial_date = p_trial_date
  WHERE id = p_inquiry_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_inquiry(uuid, text, text, date, text, uuid, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_inquiry(uuid, text, text, date, text, uuid, text, text, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_inquiry_conversion(
  p_inquiry_id uuid,
  p_parent_name text,
  p_parent_email text,
  p_parent_address text,
  p_gender text,
  p_joining_date date,
  p_center_id uuid,
  p_batch_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
  v_academy_id uuid;
  v_inquiry public.inquiries%ROWTYPE;
  v_player_result jsonb;
  v_player_id uuid;
BEGIN
  v_role := private.current_user_role();
  v_academy_id := private.current_academy_id();

  IF v_role <> 'academy_owner' OR v_academy_id IS NULL THEN
    RAISE EXCEPTION 'Only the Academy Owner can convert an enquiry.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inquiry
  FROM public.inquiries i
  WHERE i.id = p_inquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enquiry was not found.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_inquiry.academy_id <> v_academy_id THEN
    RAISE EXCEPTION 'Enquiry is outside the current academy.'
      USING ERRCODE = '42501';
  END IF;

  IF v_inquiry.status = 'converted' THEN
    RETURN pg_catalog.jsonb_build_object(
      'alreadyConverted', true,
      'playerId', v_inquiry.converted_player_id
    );
  END IF;

  IF v_inquiry.status = 'lost' THEN
    RAISE EXCEPTION 'Reopen a Lost enquiry before conversion.'
      USING ERRCODE = '23514';
  END IF;

  IF nullif(pg_catalog.btrim(coalesce(p_parent_name, '')), '') IS NULL
     OR p_joining_date IS NULL
     OR p_center_id IS NULL
     OR p_batch_id IS NULL THEN
    RAISE EXCEPTION 'Parent name, joining date, center and batch are required for conversion.'
      USING ERRCODE = '22023';
  END IF;

  IF v_inquiry.assigned_center_id IS NOT NULL
     AND v_inquiry.assigned_center_id <> p_center_id THEN
    RAISE EXCEPTION 'Conversion center must match the enquiry center. Change the enquiry center first if needed.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.centers ctr
    WHERE ctr.id = p_center_id
      AND ctr.academy_id = v_academy_id
      AND ctr.is_active = true
  ) THEN
    RAISE EXCEPTION 'Selected center is not active in this academy.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.batches b
    WHERE b.id = p_batch_id
      AND b.academy_id = v_academy_id
      AND b.center_id = p_center_id
      AND b.is_active = true
  ) THEN
    RAISE EXCEPTION 'Selected batch is not active in the selected center.'
      USING ERRCODE = '22023';
  END IF;

  v_player_result := public.create_player_transactional(
    v_academy_id,
    pg_catalog.btrim(p_parent_name),
    v_inquiry.phone,
    p_parent_email,
    p_parent_address,
    v_inquiry.player_name,
    v_inquiry.dob,
    p_gender,
    p_joining_date,
    p_center_id,
    p_batch_id
  );

  v_player_id := nullif(v_player_result ->> 'playerId', '')::uuid;
  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Player creation did not return a player ID; conversion rolled back.'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.inquiries
  SET status = 'converted',
      converted_player_id = v_player_id,
      converted_at = pg_catalog.now(),
      converted_by = auth.uid()
  WHERE id = p_inquiry_id;

  RETURN pg_catalog.jsonb_build_object(
    'alreadyConverted', false,
    'playerId', v_player_id,
    'parentId', v_player_result ->> 'parentId'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.record_inquiry_conversion(uuid, text, text, text, text, date, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_inquiry_conversion(uuid, text, text, text, text, date, uuid, uuid) TO authenticated;
