-- Coach attendance validates the player's academy/batch membership and the
-- schedule's active state + weekday in private.validate_attendance_batch_schedule().
-- player_batch_schedules is optional schedule-specific metadata; requiring a row
-- there incorrectly blocks players enrolled through the current player_batches flow.
CREATE OR REPLACE FUNCTION private.validate_attendance_batch_schedule()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_schedule_academy_id uuid;
  v_schedule_batch_id uuid;
  v_schedule_center_id uuid;
  v_schedule_day smallint;
  v_schedule_active boolean;
  v_player_academy_id uuid;
  v_player_batch_id uuid;
BEGIN
  IF NEW.batch_schedule_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT bs.academy_id, bs.batch_id, bs.center_id, bs.day_of_week, bs.is_active
    INTO v_schedule_academy_id, v_schedule_batch_id, v_schedule_center_id,
         v_schedule_day, v_schedule_active
  FROM public.batch_schedules bs
  WHERE bs.id = NEW.batch_schedule_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch schedule % does not exist', NEW.batch_schedule_id
      USING ERRCODE = '23503';
  END IF;

  SELECT p.academy_id, p.batch_id
    INTO v_player_academy_id, v_player_batch_id
  FROM public.players p
  WHERE p.id = NEW.player_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player % does not exist', NEW.player_id
      USING ERRCODE = '23503';
  END IF;

  IF NEW.academy_id IS NULL THEN
    NEW.academy_id := v_schedule_academy_id;
  ELSIF NEW.academy_id IS DISTINCT FROM v_schedule_academy_id THEN
    RAISE EXCEPTION 'Attendance academy does not match schedule academy' USING ERRCODE = '23514';
  END IF;

  IF NEW.batch_id IS NULL THEN
    NEW.batch_id := v_schedule_batch_id;
  ELSIF NEW.batch_id IS DISTINCT FROM v_schedule_batch_id THEN
    RAISE EXCEPTION 'Attendance batch does not match schedule batch' USING ERRCODE = '23514';
  END IF;

  IF NEW.center_id IS NULL THEN
    NEW.center_id := v_schedule_center_id;
  ELSIF NEW.center_id IS DISTINCT FROM v_schedule_center_id THEN
    RAISE EXCEPTION 'Attendance center does not match schedule center' USING ERRCODE = '23514';
  END IF;

  IF v_player_academy_id IS DISTINCT FROM v_schedule_academy_id
     OR v_player_batch_id IS DISTINCT FROM v_schedule_batch_id THEN
    RAISE EXCEPTION 'Player % is not assigned to the batch associated with schedule %',
      NEW.player_id, NEW.batch_schedule_id USING ERRCODE = '23514';
  END IF;

  IF EXTRACT(ISODOW FROM NEW.attendance_date)::smallint IS DISTINCT FROM v_schedule_day THEN
    RAISE EXCEPTION 'Attendance date % does not match schedule weekday %',
      NEW.attendance_date, v_schedule_day USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT' AND NOT v_schedule_active THEN
    RAISE EXCEPTION 'Cannot mark attendance for inactive schedule %', NEW.batch_schedule_id
      USING ERRCODE = '23514';
  END IF;

  -- Batch membership and matching schedule weekday are validated above.
  -- Do not require a duplicate player_batch_schedules row: current player enrollment
  -- is batch-based, and that table is optional schedule-specific enrollment metadata.
  RETURN NEW;
END;
$function$;
