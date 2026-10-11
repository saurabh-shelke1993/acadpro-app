-- Allow coaches to mark attendance for past occurrences of an active assigned
-- session, even if the assignment record was created after that occurrence.
-- Future-dated attendance is explicitly denied at the RLS helper level.
CREATE OR REPLACE FUNCTION private.can_coach_access_attendance(
  p_academy_id uuid,
  p_batch_id uuid,
  p_batch_schedule_id uuid,
  p_attendance_date date
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    private.current_user_role() = 'coach'
    AND p_academy_id = private.current_academy_id()
    AND p_attendance_date <= CURRENT_DATE
    AND CASE
      WHEN p_batch_schedule_id IS NOT NULL THEN EXISTS (
        SELECT 1
        FROM public.coaches c
        JOIN public.coach_batch_schedule_assignments a ON a.coach_id = c.id
        JOIN public.batch_schedules bs ON bs.id = a.batch_schedule_id
        WHERE c.user_id = auth.uid()
          AND a.batch_schedule_id = p_batch_schedule_id
          AND a.is_active = true
          AND (a.assigned_until IS NULL OR a.assigned_until >= p_attendance_date)
          AND bs.is_active = true
          AND bs.day_of_week = EXTRACT(ISODOW FROM p_attendance_date)::smallint
      )
      ELSE private.is_coach_assigned_to_batch(p_batch_id)
    END;
$function$;
