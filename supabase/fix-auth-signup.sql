-- Repairs "Database error saving new user" for Event Bazar.
-- Run this entire file in Supabase Dashboard > SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  email text not null,
  avatar_url text,
  bio text check (char_length(bio) <= 1000),
  institution text,
  location text,
  website_url text,
  skills text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
begin
  profile_name := trim(coalesce(
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'full_name',
    split_part(coalesce(new.email, ''), '@', 1),
    'Event Bazar User'
  ));

  if char_length(profile_name) < 2 then
    profile_name := 'Event Bazar User';
  end if;

  insert into public.profiles (id, name, email, avatar_url)
  values (
    new.id,
    left(profile_name, 100),
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set
    name = excluded.name,
    email = excluded.email,
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  return new;
end;
$$;

alter function public.handle_new_user() owner to postgres;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "Public profiles are readable" on public.profiles;
create policy "Public profiles are readable"
on public.profiles for select
using (true);

drop policy if exists "Users update their profile" on public.profiles;
create policy "Users update their profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Create profiles for any Auth users that existed before the trigger was repaired.
insert into public.profiles (id, name, email, avatar_url)
select
  u.id,
  left(
    case
      when char_length(trim(coalesce(
        u.raw_user_meta_data ->> 'name',
        u.raw_user_meta_data ->> 'full_name',
        split_part(coalesce(u.email, ''), '@', 1)
      ))) >= 2
      then trim(coalesce(
        u.raw_user_meta_data ->> 'name',
        u.raw_user_meta_data ->> 'full_name',
        split_part(coalesce(u.email, ''), '@', 1)
      ))
      else 'Event Bazar User'
    end,
    100
  ),
  coalesce(u.email, ''),
  u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
on conflict (id) do nothing;
