drop policy if exists player_performance_assessments_insert on public.player_performance_assessments;
drop policy if exists player_performance_assessments_update on public.player_performance_assessments;
drop policy if exists player_performance_assessments_delete on public.player_performance_assessments;

create policy player_performance_assessments_insert
on public.player_performance_assessments
for insert
to authenticated
with check (
  (
    private.current_user_role() = 'coach'
    and exists (
      select 1 from public.coaches c
      where c.id = player_performance_assessments.coach_id
        and c.user_id = auth.uid()
    )
    and exists (
      select 1 from public.players p
      where p.id = player_performance_assessments.player_id
        and private.is_coach_assigned_to_batch(p.batch_id)
    )
  )
  or
  (
    private.current_user_role() in ('academy_owner', 'super_admin')
    and exists (
      select 1 from public.players p
      where p.id = player_performance_assessments.player_id
        and (
          private.current_user_role() = 'super_admin'
          or p.academy_id = private.current_academy_id()
        )
    )
    and exists (
      select 1 from public.coaches c
      where c.id = player_performance_assessments.coach_id
        and c.is_active = true
        and c.academy_id = player_performance_assessments.academy_id
        and (
          private.current_user_role() = 'super_admin'
          or c.academy_id = private.current_academy_id()
        )
    )
  )
);

create policy player_performance_assessments_update
on public.player_performance_assessments
for update
to authenticated
using (
  (
    private.current_user_role() = 'coach'
    and exists (
      select 1 from public.coaches c
      where c.id = player_performance_assessments.coach_id
        and c.user_id = auth.uid()
    )
    and exists (
      select 1 from public.players p
      where p.id = player_performance_assessments.player_id
        and private.is_coach_assigned_to_batch(p.batch_id)
    )
  )
  or
  (
    private.current_user_role() in ('academy_owner', 'super_admin')
    and (
      private.current_user_role() = 'super_admin'
      or player_performance_assessments.academy_id = private.current_academy_id()
    )
  )
)
with check (
  (
    private.current_user_role() = 'coach'
    and exists (
      select 1 from public.coaches c
      where c.id = player_performance_assessments.coach_id
        and c.user_id = auth.uid()
    )
    and exists (
      select 1 from public.players p
      where p.id = player_performance_assessments.player_id
        and private.is_coach_assigned_to_batch(p.batch_id)
    )
  )
  or
  (
    private.current_user_role() in ('academy_owner', 'super_admin')
    and exists (
      select 1 from public.players p
      where p.id = player_performance_assessments.player_id
        and p.academy_id = player_performance_assessments.academy_id
        and (
          private.current_user_role() = 'super_admin'
          or p.academy_id = private.current_academy_id()
        )
    )
    and exists (
      select 1 from public.coaches c
      where c.id = player_performance_assessments.coach_id
        and c.is_active = true
        and c.academy_id = player_performance_assessments.academy_id
        and (
          private.current_user_role() = 'super_admin'
          or c.academy_id = private.current_academy_id()
        )
    )
  )
);

create policy player_performance_assessments_delete
on public.player_performance_assessments
for delete
to authenticated
using (
  (
    private.current_user_role() = 'coach'
    and exists (
      select 1 from public.coaches c
      where c.id = player_performance_assessments.coach_id
        and c.user_id = auth.uid()
    )
    and exists (
      select 1 from public.players p
      where p.id = player_performance_assessments.player_id
        and private.is_coach_assigned_to_batch(p.batch_id)
    )
  )
  or
  (
    private.current_user_role() in ('academy_owner', 'super_admin')
    and (
      private.current_user_role() = 'super_admin'
      or player_performance_assessments.academy_id = private.current_academy_id()
    )
  )
);