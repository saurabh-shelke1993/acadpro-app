delete from public.player_batches
where player_id in (
  'b9ed2211-6c7d-4007-8d79-2ff77abbe786',
  '090414f9-5a39-445e-93ad-b34c035af7cc',
  '4173ca53-582a-43b8-a071-84d78ee4e23a',
  '9dba04d2-3799-4820-97c5-56e0f16e56cd',
  'f725350f-e1ab-478f-ab44-824135f17f8b',
  '101b107d-31c2-4ff3-b7b3-a288a5e6bf37',
  'ccda5264-ab03-4e63-bf50-a8cc833bb568',
  '08831175-6dc5-4d97-ab8f-2bcbc3b028ca'
);

insert into public.player_batches (player_id, batch_id, assigned_date)
select id, batch_id, current_date
from public.players
where id in (
  'b9ed2211-6c7d-4007-8d79-2ff77abbe786',
  '090414f9-5a39-445e-93ad-b34c035af7cc',
  '4173ca53-582a-43b8-a071-84d78ee4e23a',
  '9dba04d2-3799-4820-97c5-56e0f16e56cd',
  'f725350f-e1ab-478f-ab44-824135f17f8b',
  '101b107d-31c2-4ff3-b7b3-a288a5e6bf37',
  'ccda5264-ab03-4e63-bf50-a8cc833bb568',
  '08831175-6dc5-4d97-ab8f-2bcbc3b028ca'
)
and is_active = true
and batch_id is not null;
