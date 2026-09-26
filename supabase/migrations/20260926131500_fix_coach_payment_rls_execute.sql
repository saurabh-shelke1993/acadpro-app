-- Allow authenticated RLS evaluation to execute the private coach payment scope helper.
-- The function remains in the private schema and is not exposed through the Data API.
grant execute on function private.is_coach_payment_player(uuid) to authenticated;
