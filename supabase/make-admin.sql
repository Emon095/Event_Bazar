-- Run after creating and auto-confirming this user in:
-- Supabase Dashboard > Authentication > Users > Add user
update public.profiles
set is_admin = true, name = 'Emon'
where email = 'emon.kpc2019@gmail.com';

-- Confirm the result:
select id, name, email, is_admin
from public.profiles
where email = 'emon.kpc2019@gmail.com';
