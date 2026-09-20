-- Make the player batch invariant safe for Supabase RPC transactions.
--
-- Transactional player RPCs temporarily mark their own transaction so the
-- constraint trigger does not reject the intentional intermediate state between
-- the players write and player_batches write. Each RPC explicitly validates the
-- final state before returning.

create or replace function public.assert_player_batch_invariant(p_player_id uuid)
returns void
language plpgsql
set search_path = public, private, pg_catalog
as $function$
declare
  v_batch_id uuid;
  v_mapping_count integer;
  v_matching_mapping_count integer;
  v_is_active boolean;
begin
  select p.is_active, p.batch_id
  into v_is_active, v_batch_id
  from public.players p
  where p.id = p_player_id;

  if not found or not v_is_active then
    return;
  end if;

  select
    count(*),
    count(*) filter (where pb.batch_id = v_batch_id)
  into v_mapping_count, v_matching_mapping_count
  from public.player_batches pb
  where pb.player_id = p_player_id;

  if v_batch_id is null then
    if v_mapping_count <> 0 then
      raise exception
        'Player batch invariant violated: active player % has no current batch but % player_batches mapping(s) exist. Expected 0.',
        p_player_id, v_mapping_count;
    end if;
  elsif v_mapping_count <> 1 or v_matching_mapping_count <> 1 then
    raise exception
      'Player batch invariant violated: active player % has current batch % but % player_batches mapping(s). Expected exactly 1.',
      p_player_id, v_batch_id, v_mapping_count;
  end if;
end;
$function$;

create or replace function public.enforce_player_batch_invariant()
returns trigger
language plpgsql
set search_path = public, private, pg_catalog
as $function$
begin
  if current_setting('acadpro.player_batch_transaction', true) = 'on' then
    return coalesce(NEW, OLD);
  end if;

  perform public.assert_player_batch_invariant(coalesce(NEW.player_id, OLD.player_id));
  return coalesce(NEW, OLD);
end;
$function$;

create or replace function public.create_player_transactional(
  p_academy_id uuid, p_parent_name text, p_parent_phone text, p_parent_email text,
  p_parent_address text, p_full_name text, p_dob date, p_gender text,
  p_joining_date date, p_center_id uuid, p_batch_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_catalog
as $function$
declare
  v_role text; v_user_academy_id uuid; v_phone text; v_email text;
  v_parent_id uuid; v_parent_count integer; v_player_id uuid;
begin
  perform set_config('acadpro.player_batch_transaction', 'on', true);

  v_role := private.current_user_role();
  select academy_id into v_user_academy_id from public.users where id = auth.uid();

  if not (private.is_super_admin()
      or (v_role = 'academy_owner' and v_user_academy_id = p_academy_id)) then
    raise exception 'You are not authorized to create a player in this academy.';
  end if;

  if p_academy_id is null or p_center_id is null or p_batch_id is null
     or nullif(trim(p_full_name), '') is null or p_dob is null
     or p_joining_date is null or nullif(trim(p_parent_name), '') is null then
    raise exception 'Required player, parent, academy, center, and batch information is missing.';
  end if;

  v_phone := regexp_replace(coalesce(p_parent_phone, ''), '[^0-9]', '', 'g');
  v_email := lower(nullif(trim(p_parent_email), ''));

  if v_phone !~ '^[0-9]{10}$' then
    raise exception 'Parent phone must be exactly 10 digits.';
  end if;
  if v_email is not null and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid parent email.';
  end if;
  if p_gender is not null and lower(trim(p_gender)) not in ('male', 'female') then
    raise exception 'Invalid gender.';
  end if;

  if not exists (select 1 from public.centers where id=p_center_id and academy_id=p_academy_id and is_active=true) then
    raise exception 'Selected center is not valid for this academy.';
  end if;
  if not exists (select 1 from public.batches where id=p_batch_id and academy_id=p_academy_id and center_id=p_center_id and is_active=true) then
    raise exception 'Selected batch is not valid for the selected center.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_academy_id::text || ':' || v_phone, 0));

  select count(*) into v_parent_count
  from public.parents where academy_id=p_academy_id and phone=v_phone and is_active=true;

  if v_parent_count > 1 then
    raise exception 'Multiple active parents already use phone "%".', v_phone;
  elsif v_parent_count = 1 then
    select id into v_parent_id from public.parents
    where academy_id=p_academy_id and phone=v_phone and is_active=true limit 1;

    if v_email is not null and exists (
      select 1 from public.parents where id=v_parent_id and email is not null and lower(trim(email)) <> v_email
    ) then
      raise exception 'Parent email does not match the existing parent with phone "%".', v_phone;
    end if;
  else
    insert into public.parents (academy_id,parent_name,phone,email,address,is_active)
    values (p_academy_id,trim(p_parent_name),v_phone,v_email,nullif(trim(p_parent_address),''),true)
    returning id into v_parent_id;
  end if;

  if exists (
    select 1 from public.players
    where academy_id=p_academy_id
      and lower(trim(full_name))=lower(trim(p_full_name))
      and phone=v_phone and is_active=true
  ) then
    raise exception 'Player "%" already exists with this parent phone.', trim(p_full_name);
  end if;

  insert into public.players (
    academy_id,parent_id,full_name,dob,gender,joining_date,player_status,is_active,center_id,batch_id,phone
  )
  values (
    p_academy_id,v_parent_id,trim(p_full_name),p_dob,nullif(trim(p_gender),''),
    p_joining_date,'active',true,p_center_id,p_batch_id,v_phone
  )
  returning id into v_player_id;

  insert into public.player_batches (player_id,batch_id) values (v_player_id,p_batch_id);

  perform public.assert_player_batch_invariant(v_player_id);

  return jsonb_build_object('playerId',v_player_id,'parentId',v_parent_id);
end;
$function$;

create or replace function public.update_player_transactional(
  p_player_id uuid, p_academy_id uuid, p_parent_id uuid, p_parent_name text,
  p_parent_phone text, p_parent_email text, p_parent_address text,
  p_full_name text, p_dob date, p_gender text, p_joining_date date,
  p_center_id uuid, p_batch_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_catalog
as $function$
declare
  v_role text; v_user_academy_id uuid; v_player_academy_id uuid;
  v_phone text; v_email text; v_parent_academy_id uuid; v_duplicate_count integer;
begin
  perform set_config('acadpro.player_batch_transaction', 'on', true);

  v_role := private.current_user_role();
  select academy_id into v_user_academy_id from public.users where id=auth.uid();
  select academy_id into v_player_academy_id from public.players where id=p_player_id for update;

  if v_player_academy_id is null then raise exception 'Player was not found.'; end if;
  if not (private.is_super_admin()
      or (v_role='academy_owner' and v_user_academy_id=v_player_academy_id)) then
    raise exception 'You are not authorized to update this player.';
  end if;
  if p_academy_id <> v_player_academy_id then
    raise exception 'Player academy cannot be changed during player update.';
  end if;

  if p_parent_id is null or p_center_id is null or p_batch_id is null
     or nullif(trim(p_full_name),'') is null or p_dob is null
     or p_joining_date is null or nullif(trim(p_parent_name),'') is null then
    raise exception 'Required player, parent, center, and batch information is missing.';
  end if;

  v_phone := regexp_replace(coalesce(p_parent_phone,''),'[^0-9]','','g');
  v_email := lower(nullif(trim(p_parent_email),''));

  if v_phone !~ '^[0-9]{10}$' then raise exception 'Parent phone must be exactly 10 digits.'; end if;
  if v_email is not null and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid parent email.';
  end if;
  if p_gender is not null and lower(trim(p_gender)) not in ('male','female') then raise exception 'Invalid gender.'; end if;

  if not exists (select 1 from public.centers where id=p_center_id and academy_id=v_player_academy_id and is_active=true) then
    raise exception 'Selected center is not valid for this academy.';
  end if;
  if not exists (select 1 from public.batches where id=p_batch_id and academy_id=v_player_academy_id and center_id=p_center_id and is_active=true) then
    raise exception 'Selected batch is not valid for this center.';
  end if;

  select academy_id into v_parent_academy_id from public.parents where id=p_parent_id;
  if v_parent_academy_id is null or v_parent_academy_id <> v_player_academy_id then
    raise exception 'Selected parent is not valid for this academy.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_player_academy_id::text || ':' || v_phone,0));

  select count(*) into v_duplicate_count from public.parents
  where academy_id=v_player_academy_id and phone=v_phone and is_active=true and id<>p_parent_id;
  if v_duplicate_count > 0 then raise exception 'Another active parent already uses phone "%".',v_phone; end if;

  select count(*) into v_duplicate_count from public.players
  where academy_id=v_player_academy_id and lower(trim(full_name))=lower(trim(p_full_name))
    and phone=v_phone and is_active=true and id<>p_player_id;
  if v_duplicate_count > 0 then raise exception 'Another active player "%" already exists with this parent phone.',trim(p_full_name); end if;

  update public.parents
  set parent_name=trim(p_parent_name),phone=v_phone,email=v_email,address=nullif(trim(p_parent_address),'')
  where id=p_parent_id;

  update public.players
  set center_id=p_center_id,batch_id=p_batch_id,full_name=trim(p_full_name),dob=p_dob,
      gender=nullif(trim(p_gender),''),joining_date=p_joining_date,phone=v_phone
  where id=p_player_id;

  delete from public.player_batches where player_id=p_player_id;
  insert into public.player_batches (player_id,batch_id) values (p_player_id,p_batch_id);

  perform public.assert_player_batch_invariant(p_player_id);

  return jsonb_build_object('playerId',p_player_id,'parentId',p_parent_id,'batchId',p_batch_id);
end;
$function$;

create or replace function public.import_players_bulk(p_academy_id uuid,p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_catalog
as $function$
declare
  v_row jsonb; v_player_name text; v_date_of_birth date; v_parent_name text; v_parent_phone text;
  v_center_name text; v_batch_name text; v_gender text; v_joining_date date; v_parent_email text;
  v_center_id uuid; v_batch_id uuid; v_parent_id uuid; v_player_id uuid; v_parent_count integer;
  v_created_parent_count integer:=0; v_reused_parent_count integer:=0; v_imported_player_count integer:=0;
begin
  perform set_config('acadpro.player_batch_transaction','on',true);

  if not private.is_super_admin() then raise exception 'Only Super Admin can import players.'; end if;
  if p_academy_id is null then raise exception 'Academy is required.'; end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' then raise exception 'Import rows must be a JSON array.'; end if;
  if jsonb_array_length(p_rows)=0 then raise exception 'There are no players to import.'; end if;
  if jsonb_array_length(p_rows)>1000 then raise exception 'A maximum of 1000 players can be imported at once.'; end if;
  if not exists (select 1 from public.academies where id=p_academy_id and is_active=true) then
    raise exception 'Selected academy was not found or is inactive.';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_player_name:=nullif(trim(v_row->>'playerName'),'');
    v_date_of_birth:=nullif(trim(v_row->>'dateOfBirth'),'')::date;
    v_parent_name:=nullif(trim(v_row->>'parentName'),'');
    v_parent_phone:=regexp_replace(coalesce(v_row->>'parentPhone',''),'[^0-9]','','g');
    v_center_name:=nullif(trim(v_row->>'center'),'');
    v_batch_name:=nullif(trim(v_row->>'batch'),'');
    v_gender:=nullif(trim(v_row->>'gender'),'');
    v_joining_date:=nullif(trim(v_row->>'joiningDate'),'')::date;
    v_parent_email:=lower(nullif(trim(v_row->>'parentEmail'),''));

    if v_player_name is null or v_parent_name is null or v_center_name is null or v_batch_name is null
       or v_date_of_birth is null or v_parent_phone !~ '^[0-9]{10}$' then
      raise exception 'Import validation failed for source row %.',coalesce(v_row->>'sourceRowNumber','?');
    end if;
    if v_gender is not null and lower(v_gender) not in ('male','female') then
      raise exception 'Import validation failed for source row %: invalid gender.',coalesce(v_row->>'sourceRowNumber','?');
    end if;
    if v_parent_email is not null and v_parent_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'Import validation failed for source row %: invalid parent email.',coalesce(v_row->>'sourceRowNumber','?');
    end if;

    begin
      v_center_id:=(v_row->>'resolvedCenterId')::uuid;
      v_batch_id:=(v_row->>'resolvedBatchId')::uuid;
    exception when invalid_text_representation then
      raise exception 'Import validation failed for source row %: invalid center or batch reference.',coalesce(v_row->>'sourceRowNumber','?');
    end;

    if not exists (select 1 from public.centers where id=v_center_id and academy_id=p_academy_id and is_active=true and lower(trim(center_name))=lower(v_center_name)) then
      raise exception 'Center "%" is no longer valid for the selected academy (source row %).',v_center_name,coalesce(v_row->>'sourceRowNumber','?');
    end if;
    if not exists (select 1 from public.batches where id=v_batch_id and academy_id=p_academy_id and center_id=v_center_id and is_active=true and lower(trim(batch_name))=lower(v_batch_name)) then
      raise exception 'Batch "%" is no longer valid for center "%" (source row %).',v_batch_name,v_center_name,coalesce(v_row->>'sourceRowNumber','?');
    end if;

    perform pg_advisory_xact_lock(hashtextextended(p_academy_id::text||':'||v_parent_phone,0));

    select count(*) into v_parent_count from public.parents
    where academy_id=p_academy_id and phone=v_parent_phone and is_active=true;

    if v_parent_count=1 then
      select id into v_parent_id from public.parents
      where academy_id=p_academy_id and phone=v_parent_phone and is_active=true limit 1;
    else
      v_parent_id:=null;
    end if;

    if v_parent_count>1 then
      raise exception 'Multiple active parents already use phone "%" (source row %).',v_parent_phone,coalesce(v_row->>'sourceRowNumber','?');
    elsif v_parent_count=1 then
      v_reused_parent_count:=v_reused_parent_count+1;
      if v_parent_email is not null and exists (
        select 1 from public.parents where id=v_parent_id and email is not null and lower(trim(email))<>v_parent_email
      ) then
        raise exception 'Parent email does not match the existing parent with phone "%" (source row %).',v_parent_phone,coalesce(v_row->>'sourceRowNumber','?');
      end if;
    else
      insert into public.parents(academy_id,parent_name,email,phone,is_active)
      values(p_academy_id,v_parent_name,v_parent_email,v_parent_phone,true)
      returning id into v_parent_id;
      v_created_parent_count:=v_created_parent_count+1;
    end if;

    if exists (
      select 1 from public.players where academy_id=p_academy_id and lower(trim(full_name))=lower(v_player_name)
        and phone=v_parent_phone and is_active=true
    ) then
      raise exception 'Player "%" already exists with this parent phone (source row %).',v_player_name,coalesce(v_row->>'sourceRowNumber','?');
    end if;

    insert into public.players(academy_id,parent_id,full_name,dob,gender,joining_date,player_status,is_active,center_id,batch_id,phone)
    values(p_academy_id,v_parent_id,v_player_name,v_date_of_birth,v_gender,v_joining_date,'active',true,v_center_id,v_batch_id,v_parent_phone)
    returning id into v_player_id;

    insert into public.player_batches(player_id,batch_id) values(v_player_id,v_batch_id);
    perform public.assert_player_batch_invariant(v_player_id);
    v_imported_player_count:=v_imported_player_count+1;
  end loop;

  return jsonb_build_object(
    'importedPlayerCount',v_imported_player_count,
    'createdParentCount',v_created_parent_count,
    'reusedParentCount',v_reused_parent_count
  );
end;
$function$;

revoke execute on function public.assert_player_batch_invariant(uuid) from public;
revoke execute on function public.create_player_transactional(uuid,text,text,text,text,text,date,text,date,uuid,uuid) from public;
revoke execute on function public.update_player_transactional(uuid,uuid,uuid,text,text,text,text,text,date,text,date,uuid,uuid) from public;
revoke execute on function public.import_players_bulk(uuid,jsonb) from public;

grant execute on function public.assert_player_batch_invariant(uuid) to authenticated;
grant execute on function public.create_player_transactional(uuid,text,text,text,text,text,date,text,date,uuid,uuid) to authenticated;
grant execute on function public.update_player_transactional(uuid,uuid,uuid,text,text,text,text,text,date,text,date,uuid,uuid) to authenticated;
grant execute on function public.import_players_bulk(uuid,jsonb) to authenticated;
