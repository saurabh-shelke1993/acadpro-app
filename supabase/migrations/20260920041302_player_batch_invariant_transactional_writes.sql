create or replace function public.create_player_transactional(
  p_academy_id uuid,
  p_parent_name text,
  p_parent_phone text,
  p_parent_email text,
  p_parent_address text,
  p_full_name text,
  p_dob date,
  p_gender text,
  p_joining_date date,
  p_center_id uuid,
  p_batch_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_catalog
as $function$
declare
  v_role text;
  v_user_academy_id uuid;
  v_phone text;
  v_email text;
  v_parent_id uuid;
  v_parent_count integer;
  v_player_id uuid;
begin
  v_role := private.current_user_role();

  select academy_id
  into v_user_academy_id
  from public.users
  where id = auth.uid();

  if not (
    private.is_super_admin()
    or (v_role = 'academy_owner' and v_user_academy_id = p_academy_id)
  ) then
    raise exception 'You are not authorized to create a player in this academy.';
  end if;

  if p_academy_id is null
     or p_center_id is null
     or p_batch_id is null
     or nullif(trim(p_full_name), '') is null
     or p_dob is null
     or p_joining_date is null
     or nullif(trim(p_parent_name), '') is null then
    raise exception 'Required player, parent, academy, center, and batch information is missing.';
  end if;

  v_phone := regexp_replace(coalesce(p_parent_phone, ''), '[^0-9]', '', 'g');
  v_email := lower(nullif(trim(p_parent_email), ''));

  if v_phone !~ '^[0-9]{10}$' then
    raise exception 'Parent phone must be exactly 10 digits.';
  end if;

  if v_email is not null
     and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid parent email.';
  end if;

  if p_gender is not null
     and lower(trim(p_gender)) not in ('male', 'female') then
    raise exception 'Invalid gender.';
  end if;

  if not exists (
    select 1 from public.centers
    where id = p_center_id and academy_id = p_academy_id and is_active = true
  ) then
    raise exception 'Selected center is not valid for this academy.';
  end if;

  if not exists (
    select 1 from public.batches
    where id = p_batch_id
      and academy_id = p_academy_id
      and center_id = p_center_id
      and is_active = true
  ) then
    raise exception 'Selected batch is not valid for the selected center.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_academy_id::text || ':' || v_phone, 0));

  select count(*) into v_parent_count
  from public.parents
  where academy_id = p_academy_id and phone = v_phone and is_active = true;

  if v_parent_count > 1 then
    raise exception 'Multiple active parents already use phone "%".', v_phone;
  elsif v_parent_count = 1 then
    select id into v_parent_id
    from public.parents
    where academy_id = p_academy_id and phone = v_phone and is_active = true
    limit 1;

    if v_email is not null
       and exists (
         select 1 from public.parents
         where id = v_parent_id
           and email is not null
           and lower(trim(email)) <> v_email
       ) then
      raise exception 'Parent email does not match the existing parent with phone "%".', v_phone;
    end if;
  else
    insert into public.parents (
      academy_id, parent_name, phone, email, address, is_active
    )
    values (
      p_academy_id, trim(p_parent_name), v_phone, v_email,
      nullif(trim(p_parent_address), ''), true
    )
    returning id into v_parent_id;
  end if;

  if exists (
    select 1 from public.players
    where academy_id = p_academy_id
      and lower(trim(full_name)) = lower(trim(p_full_name))
      and phone = v_phone
      and is_active = true
  ) then
    raise exception 'Player "%" already exists with this parent phone.', trim(p_full_name);
  end if;

  insert into public.players (
    academy_id, parent_id, full_name, dob, gender, joining_date,
    player_status, is_active, center_id, batch_id, phone
  )
  values (
    p_academy_id, v_parent_id, trim(p_full_name), p_dob, nullif(trim(p_gender), ''),
    p_joining_date, 'active', true, p_center_id, p_batch_id, v_phone
  )
  returning id into v_player_id;

  insert into public.player_batches (player_id, batch_id)
  values (v_player_id, p_batch_id);

  return jsonb_build_object('playerId', v_player_id, 'parentId', v_parent_id);
end;
$function$;

create or replace function public.update_player_transactional(
  p_player_id uuid,
  p_academy_id uuid,
  p_parent_id uuid,
  p_parent_name text,
  p_parent_phone text,
  p_parent_email text,
  p_parent_address text,
  p_full_name text,
  p_dob date,
  p_gender text,
  p_joining_date date,
  p_center_id uuid,
  p_batch_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_catalog
as $function$
declare
  v_role text;
  v_user_academy_id uuid;
  v_player_academy_id uuid;
  v_phone text;
  v_email text;
  v_parent_academy_id uuid;
  v_duplicate_count integer;
begin
  v_role := private.current_user_role();

  select academy_id into v_user_academy_id
  from public.users where id = auth.uid();

  select academy_id into v_player_academy_id
  from public.players where id = p_player_id for update;

  if v_player_academy_id is null then
    raise exception 'Player was not found.';
  end if;

  if not (
    private.is_super_admin()
    or (v_role = 'academy_owner' and v_user_academy_id = v_player_academy_id)
  ) then
    raise exception 'You are not authorized to update this player.';
  end if;

  if p_academy_id <> v_player_academy_id then
    raise exception 'Player academy cannot be changed during player update.';
  end if;

  if p_parent_id is null
     or p_center_id is null
     or p_batch_id is null
     or nullif(trim(p_full_name), '') is null
     or p_dob is null
     or p_joining_date is null
     or nullif(trim(p_parent_name), '') is null then
    raise exception 'Required player, parent, center, and batch information is missing.';
  end if;

  v_phone := regexp_replace(coalesce(p_parent_phone, ''), '[^0-9]', '', 'g');
  v_email := lower(nullif(trim(p_parent_email), ''));

  if v_phone !~ '^[0-9]{10}$' then
    raise exception 'Parent phone must be exactly 10 digits.';
  end if;

  if v_email is not null
     and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid parent email.';
  end if;

  if p_gender is not null
     and lower(trim(p_gender)) not in ('male', 'female') then
    raise exception 'Invalid gender.';
  end if;

  if not exists (
    select 1 from public.centers
    where id = p_center_id and academy_id = v_player_academy_id and is_active = true
  ) then
    raise exception 'Selected center is not valid for this academy.';
  end if;

  if not exists (
    select 1 from public.batches
    where id = p_batch_id
      and academy_id = v_player_academy_id
      and center_id = p_center_id
      and is_active = true
  ) then
    raise exception 'Selected batch is not valid for the selected center.';
  end if;

  select academy_id into v_parent_academy_id
  from public.parents where id = p_parent_id;

  if v_parent_academy_id is null or v_parent_academy_id <> v_player_academy_id then
    raise exception 'Selected parent is not valid for this academy.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_player_academy_id::text || ':' || v_phone, 0));

  select count(*) into v_duplicate_count
  from public.parents
  where academy_id = v_player_academy_id
    and phone = v_phone
    and is_active = true
    and id <> p_parent_id;

  if v_duplicate_count > 0 then
    raise exception 'Another active parent already uses phone "%".', v_phone;
  end if;

  select count(*) into v_duplicate_count
  from public.players
  where academy_id = v_player_academy_id
    and lower(trim(full_name)) = lower(trim(p_full_name))
    and phone = v_phone
    and is_active = true
    and id <> p_player_id;

  if v_duplicate_count > 0 then
    raise exception 'Another active player "%" already exists with this parent phone.', trim(p_full_name);
  end if;

  update public.parents
  set parent_name = trim(p_parent_name),
      phone = v_phone,
      email = v_email,
      address = nullif(trim(p_parent_address), '')
  where id = p_parent_id;

  update public.players
  set center_id = p_center_id,
      batch_id = p_batch_id,
      full_name = trim(p_full_name),
      dob = p_dob,
      gender = nullif(trim(p_gender), ''),
      joining_date = p_joining_date,
      phone = v_phone
  where id = p_player_id;

  delete from public.player_batches where player_id = p_player_id;

  insert into public.player_batches (player_id, batch_id)
  values (p_player_id, p_batch_id);

  return jsonb_build_object(
    'playerId', p_player_id,
    'parentId', p_parent_id,
    'batchId', p_batch_id
  );
end;
$function$;

revoke execute on function public.create_player_transactional(uuid,text,text,text,text,text,date,text,date,uuid,uuid) from public;
revoke execute on function public.update_player_transactional(uuid,uuid,uuid,text,text,text,text,text,date,text,date,uuid,uuid) from public;

grant execute on function public.create_player_transactional(uuid,text,text,text,text,text,date,text,date,uuid,uuid) to authenticated;
grant execute on function public.update_player_transactional(uuid,uuid,uuid,text,text,text,text,text,date,text,date,uuid,uuid) to authenticated;
