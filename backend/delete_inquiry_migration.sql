-- Secure deletion for enquiries.
-- Only an authenticated Academy Owner or a Coach within their authorized center scope
-- can delete an enquiry in their own academy. Converted enquiries are immutable.
CREATE OR REPLACE FUNCTION public.delete_inquiry(p_inquiry_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_role text;
  v_academy_id uuid;
  v_inquiry public.inquiries%ROWTYPE;
BEGIN
  v_role := private.current_user_role();
  v_academy_id := private.current_academy_id();

  IF v_role IS NULL
     OR v_role NOT IN ('academy_owner', 'coach')
     OR v_academy_id IS NULL THEN
    RAISE EXCEPTION 'Only an Academy Owner or authorized Coach can delete an enquiry.'
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

  IF v_inquiry.status = 'converted' OR v_inquiry.converted_player_id IS NOT NULL THEN
    RAISE EXCEPTION 'Converted enquiries cannot be deleted.'
      USING ERRCODE = '23514';
  END IF;

  IF v_role = 'coach'
     AND NOT private.inquiry_can_access_center(v_inquiry.assigned_center_id) THEN
    RAISE EXCEPTION 'Enquiry is outside the coach''s authorized center scope.'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.inquiries WHERE id = p_inquiry_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_inquiry(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_inquiry(uuid) TO authenticated;
