drop policy if exists player_performance_assessments_insert on public.player_performance_assessments;
drop policy if exists player_performance_assessments_update on public.player_performance_assessments;
drop policy if exists player_performance_assessments_delete on public.player_performance_assessments;

create policy player_performance_assessments_insert
on public.player_performance_assessments
for insert
to authenticated
with check (
  private.current_user_role() = 'coach'
  and exists (
    select 1
    from public.coaches c
    where c.id = player_performance_assessments.coach_id
      and c.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.players p
    where p.id = player_performance_assessments.player_id
      and private.is_coach_assigned_to_batch(p.batch_id)
  )
);

create policy player_performance_assessments_update
on public.player_performance_assessments
for update
to authenticated
using (
  private.current_user_role() = 'coach'
  and exists (
    select 1
    from public.coaches c
    where c.id = player_performance_assessments.coach_id
      and c.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.players p
    where p.id = player_performance_assessments.player_id
      and private.is_coach_assigned_to_batch(p.batch_id)
  )
)
with check (
  private.current_user_role() = 'coach'
  and exists (
    select 1
    from public.coaches c
    where c.id = player_performance_assessments.coach_id
      and c.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.players p
    where p.id = player_performance_assessments.player_id
      and private.is_coach_assigned_to_batch(p.batch_id)
  )
);

create policy player_performance_assessments_delete
on public.player_performance_assessments
for delete
to authenticated
using (
  private.current_user_role() = 'coach'
  and exists (
    select 1
    from public.coaches c
    where c.id = player_performance_assessments.coach_id
      and c.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.players p
    where p.id = player_performance_assessments.player_id
      and private.is_coach_assigned_to_batch(p.batch_id)
  )
);
