-- Pixel Pit — Supabase schema
-- Run once in Supabase → SQL editor. Safe to re-run.
-- Nothing here is production hardened: rooms are readable by any signed-in
-- player so people can join by code.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text not null,
  avatar_color text not null default '#b8ff3d',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are readable by signed-in players" on public.profiles;
create policy "profiles are readable by signed-in players"
  on public.profiles for select to authenticated using (true);

drop policy if exists "players insert their own profile" on public.profiles;
create policy "players insert their own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

drop policy if exists "players update their own profile" on public.profiles;
create policy "players update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- Create a profile whenever someone signs up. The username comes from the
-- sign-up metadata, with a numeric suffix if it is already taken.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  suffix int := 0;
begin
  base := lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email, 'player'), '@', 1), 'player'));
  base := regexp_replace(base, '[^a-z0-9_]', '', 'g');
  if base = '' then
    base := 'player';
  end if;

  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := base || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_color)
  values (
    new.id,
    candidate,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), candidate),
    (array['#b8ff3d', '#4de3ff', '#ff5cc8', '#ffc857', '#a78bfa'])[1 + floor(random() * 5)::int]
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------- friendships

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  constraint friendships_no_self check (requester_id <> addressee_id),
  constraint friendships_pair unique (requester_id, addressee_id)
);

create index if not exists friendships_addressee_idx
  on public.friendships (addressee_id);

alter table public.friendships enable row level security;

drop policy if exists "players see their own friendships" on public.friendships;
create policy "players see their own friendships"
  on public.friendships for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "players send friend requests" on public.friendships;
create policy "players send friend requests"
  on public.friendships for insert to authenticated
  with check (auth.uid() = requester_id and status = 'pending');

drop policy if exists "addressees answer friend requests" on public.friendships;
create policy "addressees answer friend requests"
  on public.friendships for update to authenticated
  using (auth.uid() = addressee_id)
  with check (auth.uid() = addressee_id);

drop policy if exists "players remove their friendships" on public.friendships;
create policy "players remove their friendships"
  on public.friendships for delete to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- ----------------------------------------------------------------- lobbies

create table if not exists public.lobbies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references public.profiles (id) on delete cascade,
  current_game text,
  created_at timestamptz not null default now()
);

alter table public.lobbies enable row level security;
alter table public.lobbies replica identity full;

drop policy if exists "signed-in players can look up rooms" on public.lobbies;
create policy "signed-in players can look up rooms"
  on public.lobbies for select to authenticated using (true);

drop policy if exists "players open their own rooms" on public.lobbies;
create policy "players open their own rooms"
  on public.lobbies for insert to authenticated
  with check (auth.uid() = host_id);

drop policy if exists "hosts update their rooms" on public.lobbies;
create policy "hosts update their rooms"
  on public.lobbies for update to authenticated
  using (auth.uid() = host_id) with check (auth.uid() = host_id);

drop policy if exists "hosts close their rooms" on public.lobbies;
create policy "hosts close their rooms"
  on public.lobbies for delete to authenticated
  using (auth.uid() = host_id);

-- ----------------------------------------------------------- lobby members

create table if not exists public.lobby_members (
  lobby_id uuid not null references public.lobbies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (lobby_id, user_id)
);

create index if not exists lobby_members_user_idx
  on public.lobby_members (user_id);

alter table public.lobby_members enable row level security;

drop policy if exists "signed-in players see room rosters" on public.lobby_members;
create policy "signed-in players see room rosters"
  on public.lobby_members for select to authenticated using (true);

drop policy if exists "players join rooms as themselves" on public.lobby_members;
create policy "players join rooms as themselves"
  on public.lobby_members for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "players leave or hosts remove" on public.lobby_members;
create policy "players leave or hosts remove"
  on public.lobby_members for delete to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.lobbies l
      where l.id = lobby_id and l.host_id = auth.uid()
    )
  );

-- ----------------------------------------------------------- lobby invites

create table if not exists public.lobby_invites (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.lobbies (id) on delete cascade,
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint lobby_invites_unique unique (lobby_id, invitee_id)
);

create index if not exists lobby_invites_invitee_idx
  on public.lobby_invites (invitee_id);

alter table public.lobby_invites enable row level security;

drop policy if exists "players see invites sent to or by them" on public.lobby_invites;
create policy "players see invites sent to or by them"
  on public.lobby_invites for select to authenticated
  using (auth.uid() = invitee_id or auth.uid() = inviter_id);

drop policy if exists "hosts invite players to their room" on public.lobby_invites;
create policy "hosts invite players to their room"
  on public.lobby_invites for insert to authenticated
  with check (
    auth.uid() = inviter_id
    and exists (
      select 1 from public.lobbies l
      where l.id = lobby_id and l.host_id = auth.uid()
    )
  );

drop policy if exists "players dismiss their invites" on public.lobby_invites;
create policy "players dismiss their invites"
  on public.lobby_invites for delete to authenticated
  using (auth.uid() = invitee_id or auth.uid() = inviter_id);

-- ------------------------------------------------------------------ grants

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles,
  public.friendships,
  public.lobbies,
  public.lobby_members,
  public.lobby_invites
to authenticated;

-- ---------------------------------------------------------------- realtime
-- Realtime powers live rosters and host game switches.

do $$
declare
  target text;
begin
  foreach target in array array['lobbies', 'lobby_members', 'lobby_invites'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target);
    end if;
  end loop;
end;
$$;
