-- Run once in Supabase Dashboard > SQL Editor.
-- Provides real, realtime interest totals and threaded comments for every event
-- source, including external events whose IDs are not UUIDs.

create table if not exists public.event_interests (
  event_key text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_key, user_id)
);

create table if not exists public.event_comments (
  id bigint generated always as identity primary key,
  event_key text not null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id bigint references public.event_comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_interests_event_idx on public.event_interests(event_key);
create index if not exists event_comments_event_created_idx on public.event_comments(event_key, created_at);
create index if not exists event_comments_parent_idx on public.event_comments(parent_id);

alter table public.event_interests enable row level security;
alter table public.event_comments enable row level security;

drop policy if exists "Interests are readable" on public.event_interests;
create policy "Interests are readable" on public.event_interests for select using (true);
drop policy if exists "Users manage their interests" on public.event_interests;
create policy "Users manage their interests" on public.event_interests for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Event comments are readable" on public.event_comments;
create policy "Event comments are readable" on public.event_comments for select using (true);
drop policy if exists "Users create event comments" on public.event_comments;
create policy "Users create event comments" on public.event_comments for insert to authenticated
with check (author_id = auth.uid());
drop policy if exists "Authors update event comments" on public.event_comments;
create policy "Authors update event comments" on public.event_comments for update to authenticated
using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists "Authors delete event comments" on public.event_comments;
create policy "Authors delete event comments" on public.event_comments for delete to authenticated
using (author_id = auth.uid());

-- Keep existing community engagement when this migration is applied.
insert into public.event_interests (event_key, user_id, created_at)
select event_id::text, user_id, created_at
from public.event_reactions
where reaction = 'interested'
on conflict do nothing;

insert into public.event_comments (event_key, author_id, body, created_at, updated_at)
select event_id::text, author_id, body, created_at, updated_at
from public.comments
on conflict do nothing;

do $$
begin
  alter publication supabase_realtime add table public.event_interests;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.event_comments;
exception when duplicate_object then null;
end $$;
