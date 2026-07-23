-- Run once in Supabase Dashboard > SQL Editor.
-- Adds realtime reactions for the unified comments and profile-picture storage.

create table if not exists public.event_comment_reactions (
  comment_id bigint not null references public.event_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('like', 'love', 'helpful')),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id, reaction)
);

create index if not exists event_comment_reactions_comment_idx
on public.event_comment_reactions(comment_id);

alter table public.event_comment_reactions enable row level security;

drop policy if exists "Comment reactions are readable" on public.event_comment_reactions;
create policy "Comment reactions are readable"
on public.event_comment_reactions for select using (true);

drop policy if exists "Users manage their comment reactions" on public.event_comment_reactions;
create policy "Users manage their comment reactions"
on public.event_comment_reactions for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$
begin
  alter publication supabase_realtime add table public.event_comment_reactions;
exception when duplicate_object then null;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Avatar images are public" on storage.objects;
create policy "Avatar images are public"
on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "Users upload their avatar" on storage.objects;
create policy "Users upload their avatar"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users update their avatar" on storage.objects;
create policy "Users update their avatar"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users delete their avatar" on storage.objects;
create policy "Users delete their avatar"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
