-- Administrative bootstrap: assign an existing Auth user as venue admin.
-- 1. Create the user in the Supabase dashboard (Authentication > Users).
-- 2. Copy that user's UUID.
-- 3. Replace the placeholder below and run this in the SQL editor.
--
-- There is no application signup and no self-serve admin grant.

insert into public.venue_memberships (venue_id, user_id, role)
values (
  '11111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000', -- replace with the Auth user UUID
  'admin'
)
on conflict (venue_id, user_id) do update
set role = excluded.role;
