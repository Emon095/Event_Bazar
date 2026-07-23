-- Run once in Supabase Dashboard > SQL Editor.
-- Adds private realtime member chat and activity notifications.

alter table public.notifications add column if not exists actor_id uuid references public.profiles(id) on delete set null;
alter table public.notifications add column if not exists kind text not null default 'activity';
alter table public.notifications add column if not exists link text;

create table if not exists public.direct_messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 3000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index if not exists direct_messages_sender_created_idx on public.direct_messages(sender_id, created_at desc);
create index if not exists direct_messages_recipient_created_idx on public.direct_messages(recipient_id, created_at desc);
alter table public.direct_messages enable row level security;

drop policy if exists "Members read their direct messages" on public.direct_messages;
create policy "Members read their direct messages" on public.direct_messages for select to authenticated
using (auth.uid() = sender_id or auth.uid() = recipient_id);
drop policy if exists "Members send direct messages" on public.direct_messages;
create policy "Members send direct messages" on public.direct_messages for insert to authenticated
with check (auth.uid() = sender_id);
drop policy if exists "Recipients mark messages read" on public.direct_messages;
create policy "Recipients mark messages read" on public.direct_messages for update to authenticated
using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);
drop policy if exists "Senders delete direct messages" on public.direct_messages;
create policy "Senders delete direct messages" on public.direct_messages for delete to authenticated
using (auth.uid() = sender_id);

create or replace function public.push_event_activity_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner_id uuid; actor_id uuid; actor_name text; event_title text; target_id uuid; message_text text; activity_kind text;
begin
  select creator_id, title into owner_id, event_title from public.events where id::text = new.event_key limit 1;
  if tg_table_name = 'event_comments' then
    actor_id := new.author_id;
    activity_kind := case when new.parent_id is null then 'comment' else 'reply' end;
    message_text := case when new.parent_id is null then 'commented on your event' else 'replied to a comment' end;
    if new.parent_id is not null then select author_id into target_id from public.event_comments where id = new.parent_id; end if;
    target_id := coalesce(target_id, owner_id);
  elsif tg_table_name = 'event_interests' then actor_id := new.user_id; activity_kind := 'interest'; message_text := 'is interested in your event'; target_id := owner_id;
  else actor_id := new.user_id; activity_kind := 'reaction'; message_text := 'reacted ' || new.reaction || ' to your event'; target_id := owner_id;
  end if;
  select name into actor_name from public.profiles where id = actor_id;
  if target_id is not null and target_id <> actor_id then
    insert into public.notifications(user_id, actor_id, kind, title, body, link)
    values(target_id, actor_id, activity_kind, coalesce(actor_name,'A member') || ' ' || message_text, coalesce(event_title,'Event activity'), '/events/' || coalesce((select slug from public.events where id::text=new.event_key limit 1),''));
  end if;
  return new;
end $$;

create or replace function public.push_comment_reaction_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_id uuid; actor_name text; event_value text;
begin
  select author_id,event_key into target_id,event_value from public.event_comments where id=new.comment_id;
  select name into actor_name from public.profiles where id=new.user_id;
  if target_id is not null and target_id <> new.user_id then
    insert into public.notifications(user_id,actor_id,kind,title,body,link)
    values(target_id,new.user_id,'comment_reaction',coalesce(actor_name,'A member') || ' reacted to your comment',new.reaction,'/');
  end if;
  return new;
end $$;

create or replace function public.push_message_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor_name text;
begin
  select name into actor_name from public.profiles where id=new.sender_id;
  insert into public.notifications(user_id,actor_id,kind,title,body,link)
  values(new.recipient_id,new.sender_id,'message','New message from ' || coalesce(actor_name,'a member'),left(new.body,120),'/messages?with=' || new.sender_id);
  return new;
end $$;

drop trigger if exists notify_event_comment on public.event_comments;
create trigger notify_event_comment after insert on public.event_comments for each row execute function public.push_event_activity_notification();
drop trigger if exists notify_event_interest on public.event_interests;
create trigger notify_event_interest after insert on public.event_interests for each row execute function public.push_event_activity_notification();
drop trigger if exists notify_event_reaction on public.event_engagement_reactions;
create trigger notify_event_reaction after insert or update on public.event_engagement_reactions for each row execute function public.push_event_activity_notification();
drop trigger if exists notify_comment_reaction on public.event_comment_reactions;
create trigger notify_comment_reaction after insert on public.event_comment_reactions for each row execute function public.push_comment_reaction_notification();
drop trigger if exists notify_direct_message on public.direct_messages;
create trigger notify_direct_message after insert on public.direct_messages for each row execute function public.push_message_notification();

do $$ begin alter publication supabase_realtime add table public.direct_messages; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end $$;
