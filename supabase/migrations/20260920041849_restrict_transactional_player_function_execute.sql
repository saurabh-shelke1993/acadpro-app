revoke execute on function public.create_player_transactional(uuid,text,text,text,text,text,date,text,date,uuid,uuid) from public;
revoke execute on function public.create_player_transactional(uuid,text,text,text,text,text,date,text,date,uuid,uuid) from anon;
grant execute on function public.create_player_transactional(uuid,text,text,text,text,text,date,text,date,uuid,uuid) to authenticated;

revoke execute on function public.update_player_transactional(uuid,uuid,uuid,text,text,text,text,text,date,text,date,uuid,uuid) from public;
revoke execute on function public.update_player_transactional(uuid,uuid,uuid,text,text,text,text,text,date,text,date,uuid,uuid) from anon;
grant execute on function public.update_player_transactional(uuid,uuid,uuid,text,text,text,text,text,date,text,date,uuid,uuid) to authenticated;
