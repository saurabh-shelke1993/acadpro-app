create or replace function public.enforce_player_batch_invariant()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $function$
declare
  v_player_id uuid;
  v_player_batch_id uuid;
  v_mapping_count integer;
begin
  if tg_table_name = 'players' then
    v_player_id := new.id;
  else
    v_player_id := coalesce(new.player_id, old.player_id);
  end if;

  if not exists (select 1 from public.players where id = v_player_id) then
    return coalesce(new, old);
  end if;

  select batch_id into v_player_batch_id
  from public.players where id = v_player_id;

  select count(*) into v_mapping_count
  from public.player_batches where player_id = v_player_id;

  if v_player_batch_id is null then
    if v_mapping_count <> 0 then
      raise exception
        'Player batch invariant violated: player % has no current batch but has % player_batches mapping(s).',
        v_player_id, v_mapping_count;
    end if;
  else
    if v_mapping_count <> 1 then
      raise exception
        'Player batch invariant violated: player % has current batch % but % player_batches mapping(s). Expected exactly 1.',
        v_player_id, v_player_batch_id, v_mapping_count;
    end if;

    if not exists (
      select 1 from public.player_batches
      where player_id = v_player_id
        and batch_id = v_player_batch_id
    ) then
      raise exception
        'Player batch invariant violated: player % current batch % does not match player_batches.',
        v_player_id, v_player_batch_id;
    end if;
  end if;

  return coalesce(new, old);
end;
$function$;

drop trigger if exists trg_enforce_player_batch_invariant on public.players;
drop trigger if exists trg_enforce_player_batch_invariant on public.player_batches;

create constraint trigger trg_enforce_player_batch_invariant
after insert or update of batch_id
on public.players
deferrable initially deferred
for each row
execute function public.enforce_player_batch_invariant();

create constraint trigger trg_enforce_player_batch_invariant
after insert or update of batch_id or delete
on public.player_batches
deferrable initially deferred
for each row
execute function public.enforce_player_batch_invariant();
