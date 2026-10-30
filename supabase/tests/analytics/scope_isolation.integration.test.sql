-- Kheltriva Analytics: disposable-database scope isolation fixture
-- SAFETY: Run only against a disposable local Supabase database or dedicated test project.
-- Never run against production. All fixture writes are rolled back at the end.
-- This verifies ownership predicates against real Postgres rows; it does not invoke
-- the Edge Function or prove its deployment/authentication configuration.
begin;
insert into public.academies (id, academy_name, owner_name) values
('823e4567-e89b-42d3-a456-426614174000','Analytics Test Academy A','Test Owner A'),
('923e4567-e89b-42d3-a456-426614174000','Analytics Test Academy B','Test Owner B');
insert into public.centers (id, academy_id, center_name) values
('a23e4567-e89b-42d3-a456-426614174000','823e4567-e89b-42d3-a456-426614174000','Test Center A'),
('b23e4567-e89b-42d3-a456-426614174000','923e4567-e89b-42d3-a456-426614174000','Test Center B');
insert into public.batches (id, academy_id, center_id, batch_name) values
('c23e4567-e89b-42d3-a456-426614174000','823e4567-e89b-42d3-a456-426614174000','a23e4567-e89b-42d3-a456-426614174000','Test Batch A'),
('d23e4567-e89b-42d3-a456-426614174000','923e4567-e89b-42d3-a456-426614174000','b23e4567-e89b-42d3-a456-426614174000','Test Batch B'),
('e23e4567-e89b-42d3-a456-426614174000','823e4567-e89b-42d3-a456-426614174000','b23e4567-e89b-42d3-a456-426614174000','Mismatched Center Batch');
do $test$
declare
  academy_a uuid := '823e4567-e89b-42d3-a456-426614174000';
  center_a uuid := 'a23e4567-e89b-42d3-a456-426614174000';
  center_b uuid := 'b23e4567-e89b-42d3-a456-426614174000';
  batch_a uuid := 'c23e4567-e89b-42d3-a456-426614174000';
  batch_b uuid := 'd23e4567-e89b-42d3-a456-426614174000';
  batch_mismatch uuid := 'e23e4567-e89b-42d3-a456-426614174000';
begin
  if not exists (select 1 from public.centers where id=center_a and academy_id=academy_a) then raise exception 'FAIL: valid center rejected'; end if;
  if exists (select 1 from public.centers where id=center_b and academy_id=academy_a) then raise exception 'FAIL: cross-academy center accepted'; end if;
  if not exists (select 1 from public.batches where id=batch_a and academy_id=academy_a) then raise exception 'FAIL: valid batch rejected'; end if;
  if exists (select 1 from public.batches where id=batch_b and academy_id=academy_a) then raise exception 'FAIL: cross-academy batch accepted'; end if;
  if not exists (select 1 from public.batches where id=batch_mismatch and academy_id=academy_a) then raise exception 'FAIL: mismatched-center fixture not created; review schema constraints'; end if;
  if exists (
    select 1 from public.batches b join public.centers c on c.id=b.center_id
    where b.id=batch_mismatch and b.academy_id=academy_a and c.academy_id=academy_a
  ) then raise exception 'FAIL: batch linked to another academy center accepted'; end if;
end
$test$;
rollback;
