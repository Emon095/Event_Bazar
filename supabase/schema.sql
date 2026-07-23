-- Event Bazar Supabase schema. Run once in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create type public.event_status as enum ('published', 'rejected');
create type public.event_format as enum ('Online', 'Offline', 'Hybrid');

create table public.profiles (
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

create table public.categories (
  id bigint generated always as identity primary key,
  name text not null unique,
  slug text not null unique
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.profiles(id) on delete set null,
  category_id bigint not null references public.categories(id),
  slug text not null unique,
  title text not null,
  short_description text not null,
  description text not null,
  organizer_name text not null,
  banner_url text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  registration_deadline timestamptz not null,
  registration_url text,
  website_url text,
  discord_url text,
  prize text not null default 'Free',
  team_size text not null default 'Solo',
  difficulty text not null default 'All levels',
  format public.event_format not null default 'Online',
  location text not null default 'Worldwide',
  status public.event_status not null default 'published',
  is_featured boolean not null default false,
  source text not null default 'community',
  created_at timestamptz not null default now(),
  check (registration_deadline < starts_at),
  check (ends_at is null or ends_at > starts_at)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_reactions (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('interested','like','love')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id, reaction)
);

create table public.comment_reactions (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('like','love','helpful')),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id, reaction)
);

create table public.saved_events (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.email, ''),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.categories(name, slug) values
  ('CTF','ctf'), ('Programming','programming'), ('Hackathon','hackathon'),
  ('Workshop','workshop'), ('Career','career')
on conflict do nothing;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.comments enable row level security;
alter table public.event_reactions enable row level security;
alter table public.comment_reactions enable row level security;
alter table public.saved_events enable row level security;
alter table public.notifications enable row level security;
alter table public.categories enable row level security;

create policy "Public profiles are readable" on public.profiles for select using (true);
create policy "Users create their profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users update their profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "Categories are readable" on public.categories for select using (true);
create policy "Published events are readable" on public.events for select using (status = 'published');
create policy "Signed-in users create events" on public.events for insert to authenticated with check (creator_id = auth.uid());
create policy "Creators update events" on public.events for update to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy "Creators or admins delete events" on public.events for delete to authenticated
  using (creator_id = auth.uid() or exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "Comments are readable" on public.comments for select using (true);
create policy "Users create comments" on public.comments for insert to authenticated with check (author_id = auth.uid());
create policy "Authors manage comments" on public.comments for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "Authors delete comments" on public.comments for delete to authenticated using (author_id = auth.uid());
create policy "Reactions are readable" on public.event_reactions for select using (true);
create policy "Users manage event reactions" on public.event_reactions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Comment reactions are readable" on public.comment_reactions for select using (true);
create policy "Users manage comment reactions" on public.comment_reactions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage saves" on public.saved_events for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users read notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "Users update notifications" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create index events_status_starts_idx on public.events(status, starts_at);
create index comments_event_created_idx on public.comments(event_id, created_at);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);
