create or replace function public.import_players_bulk(
  p_academy_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_catalog
as $function$
declare
  v_row jsonb;
  v_player_name text;
  v_date_of_birth date;
  v_parent_name text;
  v_parent_phone text;
  v_center_name text;
  v_batch_name text;
  v_gender text;
  v_joining_date date;
  v_parent_email text;
  v_center_id uuid;
  v_batch_id uuid;
  v_parent_id uuid;
  v_player_id uuid;
  v_parent_count integer;
  v_created_parent_count integer := 0;
  v_reused_parent_count integer := 0;
  v_imported_player_count integer := 0;
begin
  if not private.is_super_admin() then
    raise exception 'Only Super Admin can import players.';
  end if;

  if p_academy_id is null then
    raise exception 'Academy is required.';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Import rows must be a JSON array.';
  end if;

  if jsonb_array_length(p_rows) = 0 then
    raise exception 'There are no players to import.';
  end if;

  if jsonb_array_length(p_rows) > 1000 then
    raise exception 'A maximum of 1000 players can be imported at once.';
  end if;

  if not exists (
    select 1
    from public.academies
    where id = p_academy_id
      and is_active = true
  ) then
    raise exception 'Selected academy was not found or is inactive.';
  end if;

  for v_row in
    select value
    from jsonb_array_elements(p_rows)
  loop
    v_player_name := nullif(trim(v_row->>'playerName'), '');
    v_date_of_birth := nullif(trim(v_row->>'dateOfBirth'), '')::date;
    v_parent_name := nullif(trim(v_row->>'parentName'), '');
    v_parent_phone := regexp_replace(
      coalesce(v_row->>'parentPhone', ''),
      '\\D',
      '',
      'g'
    );
    v_center_name := nullif(trim(v_row->>'center'), '');
    v_batch_name := nullif(trim(v_row->>'batch'), '');
    v_gender := nullif(trim(v_row->>'gender'), '');
    v_joining_date := nullif(trim(v_row->>'joiningDate'), '')::date;
    v_parent_email := lower(nullif(trim(v_row->>'parentEmail'), ''));

    if v_player_name is null
       or v_parent_name is null
       or v_center_name is null
       or v_batch_name is null
       or v_date_of_birth is null
       or v_parent_phone !~ '^\\d{10}$' then
      raise exception
        'Import validation failed for source row %.',
        coalesce(v_row->>'sourceRowNumber', '?');
    end if;

    if v_gender is not null
       and lower(v_gender) not in ('male', 'female') then
      raise exception
        'Import validation failed for source row %: invalid gender.',
        coalesce(v_row->>'sourceRowNumber', '?');
    end if;

    if v_parent_email is not null
       and v_parent_email !~ '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' then
      raise exception
        'Import validation failed for source row %: invalid parent email.',
        coalesce(v_row->>'sourceRowNumber', '?');
    end if;

    begin
      v_center_id := (v_row->>'resolvedCenterId')::uuid;
      v_batch_id := (v_row->>'resolvedBatchId')::uuid;
    exception
      when invalid_text_representation then
        raise exception
          'Import validation failed for source row %: invalid center or batch reference.',
          coalesce(v_row->>'sourceRowNumber', '?');
    end;

    if not exists (
      select 1
      from public.centers
      where id = v_center_id
        and academy_id = p_academy_id
        and is_active = true
        and lower(trim(center_name)) = lower(v_center_name)
    ) then
      raise exception
        'Center "%" is no longer valid for the selected academy (source row %).',
        v_center_name,
        coalesce(v_row->>'sourceRowNumber', '?');
    end if;

    if not exists (
      select 1
      from public.batches
      where id = v_batch_id
        and academy_id = p_academy_id
        and center_id = v_center_id
        and is_active = true
        and lower(trim(batch_name)) = lower(v_batch_name)
    ) then
      raise exception
        'Batch "%" is no longer valid for center "%" (source row %).',
        v_batch_name,
        v_center_name,
        coalesce(v_row->>'sourceRowNumber', '?');
    end if;

    perform pg_advisory_xact_lock(
      hashtextextended(
        p_academy_id::text || ':' || v_parent_phone,
        0
      )
    );

    select count(*), min(id)
    into v_parent_count, v_parent_id
    from public.parents
    where academy_id = p_academy_id
      and phone = v_parent_phone
      and is_active = true;

    if v_parent_count > 1 then
      raise exception
        'Multiple active parents already use phone "%" (source row %).',
        v_parent_phone,
        coalesce(v_row->>'sourceRowNumber', '?');
    elsif v_parent_count = 1 then
      v_reused_parent_count := v_reused_parent_count + 1;

      if v_parent_email is not null
         and exists (
           select 1
           from public.parents
           where id = v_parent_id
             and email is not null
             and lower(trim(email)) <> v_parent_email
         ) then
        raise exception
          'Parent email does not match the existing parent with phone "%" (source row %).',
          v_parent_phone,
          coalesce(v_row->>'sourceRowNumber', '?');
      end if;
    else
      insert into public.parents (
        academy_id,
        parent_name,
        email,
        phone,
        is_active
      )
      values (
        p_academy_id,
        v_parent_name,
        v_parent_email,
        v_parent_phone,
        true
      )
      returning id into v_parent_id;

      v_created_parent_count := v_created_parent_count + 1;
    end if;

    if exists (
      select 1
      from public.players
      where academy_id = p_academy_id
        and lower(trim(full_name)) = lower(v_player_name)
        and phone = v_parent_phone
        and is_active = true
    ) then
      raise exception
        'Player "%" already exists with this parent phone (source row %).',
        v_player_name,
        coalesce(v_row->>'sourceRowNumber', '?');
    end if;

    insert into public.players (
      academy_id,
      parent_id,
      full_name,
      dob,
      gender,
      joining_date,
      player_status,
      is_active,
      center_id,
      batch_id,
      phone
    )
    values (
      p_academy_id,
      v_parent_id,
      v_player_name,
      v_date_of_birth,
      v_gender,
      v_joining_date,
      'active',
      true,
      v_center_id,
      v_batch_id,
      v_parent_phone
    )
    returning id into v_player_id;

    insert into public.player_batches (
      player_id,
      batch_id
    )
    values (
      v_player_id,
      v_batch_id
    );

    v_imported_player_count := v_imported_player_count + 1;
  end loop;

  return jsonb_build_object(
    'importedPlayerCount', v_imported_player_count,
    'createdParentCount', v_created_parent_count,
    'reusedParentCount', v_reused_parent_count
  );
end;
$function$;

grant execute on function public.import_players_bulk(uuid, jsonb) to authenticated;
revoke execute on function public.import_players_bulk(uuid, jsonb) from anon;
