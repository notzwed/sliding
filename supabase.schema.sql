-- Slidey anonymous profile + progress persistence
create table if not exists public.player_profiles (
  device_id text primary key,
  wallet_orbs integer not null default 0 check (wallet_orbs >= 0),
  highest_level integer not null default 1 check (highest_level >= 1),
  best_time_ms integer check (best_time_ms > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.player_profiles
add column if not exists best_time_ms integer;

alter table public.player_profiles
drop constraint if exists player_profiles_best_time_ms_check;

alter table public.player_profiles
add constraint player_profiles_best_time_ms_check
check (best_time_ms is null or best_time_ms > 0);

create index if not exists idx_player_profiles_best_time
on public.player_profiles (best_time_ms asc nulls last);

create index if not exists idx_player_profiles_updated_at
on public.player_profiles (updated_at desc);

create index if not exists idx_player_profiles_active_orbs
on public.player_profiles (updated_at desc, wallet_orbs desc);

create index if not exists idx_player_profiles_active_levels
on public.player_profiles (updated_at desc, highest_level desc, wallet_orbs desc);

create index if not exists idx_player_profiles_active_best_time
on public.player_profiles (updated_at desc, best_time_ms asc)
where best_time_ms is not null;

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

-- Global best time per level
create table if not exists public.level_records (
  level integer primary key check (level >= 1),
  best_time_ms integer not null check (best_time_ms > 0),
  holder_name text not null default 'Top',
  holder_device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.level_records enable row level security;

drop policy if exists "level_records_select" on public.level_records;
drop policy if exists "level_records_insert" on public.level_records;
drop policy if exists "level_records_update" on public.level_records;

create policy "level_records_select"
on public.level_records
for select
using (true);

create policy "level_records_insert"
on public.level_records
for insert
with check (true);

create policy "level_records_update"
on public.level_records
for update
using (true)
with check (true);

create or replace function public.touch_level_records_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_level_records_updated_at on public.level_records;
create trigger trg_level_records_updated_at
before update on public.level_records
for each row
execute procedure public.touch_level_records_updated_at();

-- Daily seeded run leaderboard (one best run per player per UTC day)
create table if not exists public.daily_runs (
  date_key text not null check (date_key ~ '^[0-9]{8}$'),
  device_id text not null,
  player_alias text not null default 'Runner',
  level integer not null default 1 check (level >= 1),
  time_ms integer not null check (time_ms > 0),
  replay jsonb not null default '[]'::jsonb,
  shape text not null default 'square',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (date_key, device_id),
  constraint daily_runs_replay_is_array check (jsonb_typeof(replay) = 'array')
);

create index if not exists idx_daily_runs_date_time
on public.daily_runs (date_key, time_ms asc);

alter table public.daily_runs enable row level security;

drop policy if exists "daily_runs_select" on public.daily_runs;
drop policy if exists "daily_runs_insert" on public.daily_runs;
drop policy if exists "daily_runs_update" on public.daily_runs;

create policy "daily_runs_select"
on public.daily_runs
for select
using (true);

create policy "daily_runs_insert"
on public.daily_runs
for insert
with check (true);

create policy "daily_runs_update"
on public.daily_runs
for update
using (true)
with check (true);

create or replace function public.touch_daily_runs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_daily_runs_updated_at on public.daily_runs;
create trigger trg_daily_runs_updated_at
before update on public.daily_runs
for each row
execute procedure public.touch_daily_runs_updated_at();
