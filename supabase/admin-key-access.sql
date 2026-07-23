-- Run once in Supabase Dashboard > SQL Editor.
-- This enables the Event Bazar key-based moderation screen.
-- Replace SET_A_PRIVATE_ADMIN_KEY with a private value before running.

create or replace function public.admin_list_events(access_key text)
returns table (
  id uuid,
  title text,
  short_description text,
  starts_at timestamptz,
  organizer_name text,
  category_name text,
  source text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if access_key is distinct from 'SET_A_PRIVATE_ADMIN_KEY' then
    raise exception 'Invalid admin key' using errcode = '42501';
  end if;

  return query
    select e.id, e.title, e.short_description, e.starts_at, e.organizer_name,
           c.name, e.source, e.created_at
    from public.events e
    join public.categories c on c.id = e.category_id
    order by e.created_at desc;
end;
$$;

create or replace function public.admin_delete_event(access_key text, target_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  removed_count integer;
begin
  if access_key is distinct from 'SET_A_PRIVATE_ADMIN_KEY' then
    raise exception 'Invalid admin key' using errcode = '42501';
  end if;

  delete from public.events where id = target_event_id;
  get diagnostics removed_count = row_count;
  return removed_count = 1;
end;
$$;

revoke all on function public.admin_list_events(text) from public;
revoke all on function public.admin_delete_event(text, uuid) from public;
grant execute on function public.admin_list_events(text) to anon, authenticated;
grant execute on function public.admin_delete_event(text, uuid) to anon, authenticated;
