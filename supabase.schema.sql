-- Slidey anonymous profile + progress persistence
create table if not exists public.player_profiles (
  device_id text primary key,
  wallet_orbs integer not null default 0 check (wallet_orbs >= 0),
  highest_level integer not null default 1 check (highest_level >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.player_profiles enable row level security;

drop policy if exists "player_profiles_select" on public.player_profiles;
drop policy if exists "player_profiles_insert" on public.player_profiles;
drop policy if exists "player_profiles_update" on public.player_profiles;

create policy "player_profiles_select"
on public.player_profiles
for select
using (true);

create policy "player_profiles_insert"
on public.player_profiles
for insert
with check (true);

create policy "player_profiles_update"
on public.player_profiles
for update
using (true)
with check (true);

create or replace function public.touch_player_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_player_profiles_updated_at on public.player_profiles;
create trigger trg_player_profiles_updated_at
before update on public.player_profiles
for each row
execute procedure public.touch_player_profiles_updated_at();

-- Real-time challenge ghost sync
create table if not exists public.challenge_presence (
  challenge_code text not null,
  device_id text not null,
  level integer not null default 1 check (level >= 1),
  pos_x double precision not null default 0,
  pos_y double precision not null default 0,
  render_x double precision not null default 0,
  render_y double precision not null default 0,
  shape text not null default 'square',
  phase text not null default 'playing',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (challenge_code, device_id)
);

create index if not exists idx_challenge_presence_room_updated
on public.challenge_presence (challenge_code, updated_at desc);

alter table public.challenge_presence enable row level security;

drop policy if exists "challenge_presence_select" on public.challenge_presence;
drop policy if exists "challenge_presence_insert" on public.challenge_presence;
drop policy if exists "challenge_presence_update" on public.challenge_presence;
drop policy if exists "challenge_presence_delete" on public.challenge_presence;

create policy "challenge_presence_select"
on public.challenge_presence
for select
using (true);

create policy "challenge_presence_insert"
on public.challenge_presence
for insert
with check (true);

create policy "challenge_presence_update"
on public.challenge_presence
for update
using (true)
with check (true);

create policy "challenge_presence_delete"
on public.challenge_presence
for delete
using (true);

create or replace function public.touch_challenge_presence_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_challenge_presence_updated_at on public.challenge_presence;
create trigger trg_challenge_presence_updated_at
before update on public.challenge_presence
for each row
execute procedure public.touch_challenge_presence_updated_at();
