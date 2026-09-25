-- AcadPro: allow multiple active coaches per batch while preventing
-- duplicate active assignment of the same coach to the same batch.

create unique index coach_batch_assignments_one_active_per_coach_per_batch_idx
on public.coach_batch_assignments (batch_id, coach_id)
where is_active = true;

-- Parent-safe coach lookup. Parents receive only the fields required by
-- the Parent Portal and only for their linked players' current batches.
create or replace function public.get_parent_child_coaches()
returns table (
  batch_id uuid,
  coach_id uuid,
  coach_name text
)
language sql
security definer
set search_path = ''
stable
as $$
  select distinct
    p.batch_id,
    c.id as coach_id,
    c.full_name as coach_name
  from public.players p
  join public.coach_batch_assignments cba
    on cba.batch_id = p.batch_id
   and cba.academy_id = p.academy_id
   and cba.is_active = true
  join public.coaches c
    on c.id = cba.coach_id
   and c.academy_id = p.academy_id
   and c.is_active = true
  where p.parent_id = (select private.current_parent_id())
    and p.batch_id is not null
    and (select private.current_user_role()) = 'parent'
  order by p.batch_id, c.full_name, c.id;
$$;

revoke execute on function public.get_parent_child_coaches() from public, anon;
grant execute on function public.get_parent_child_coaches() to authenticated;
