-- Run once in Supabase Dashboard > SQL Editor.
-- Adds one Like, Love, or Wow reaction per user to every event source.

create table if not exists public.event_engagement_reactions (
  event_key text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('like', 'love', 'wow')),
  created_at timestamptz not null default now(),
  primary key (event_key, user_id)
);

create index if not exists event_engagement_reactions_event_idx
on public.event_engagement_reactions(event_key);

alter table public.event_engagement_reactions enable row level security;

drop policy if exists "Event reactions are readable" on public.event_engagement_reactions;
create policy "Event reactions are readable"
on public.event_engagement_reactions for select using (true);

drop policy if exists "Users manage their event reaction" on public.event_engagement_reactions;
create policy "Users manage their event reaction"
on public.event_engagement_reactions for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$
begin
  alter publication supabase_realtime add table public.event_engagement_reactions;
exception when duplicate_object then null;
end $$;
