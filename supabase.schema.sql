-- Slidey player economy schema
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  orb_balance integer not null default 0 check (orb_balance >= 0),
  reward_granted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy if not exists "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

create policy if not exists "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

create policy if not exists "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.touch_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute procedure public.touch_profile_updated_at();

create or replace function public.increment_player_orbs(orb_delta integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.profiles
  set orb_balance = greatest(0, orb_balance + orb_delta)
  where id = auth.uid()
  returning orb_balance into new_balance;

  if new_balance is null then
    insert into public.profiles (id, email, orb_balance)
    values (auth.uid(), auth.jwt() ->> 'email', greatest(0, orb_delta))
    returning orb_balance into new_balance;
  end if;

  return new_balance;
end;
$$;

revoke all on function public.increment_player_orbs(integer) from public;
grant execute on function public.increment_player_orbs(integer) to authenticated;

create or replace function public.grant_signup_reward(reward_amount integer default 2000)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (id, email)
  values (auth.uid(), auth.jwt() ->> 'email')
  on conflict (id) do nothing;

  update public.profiles
  set orb_balance = orb_balance + greatest(0, reward_amount),
      reward_granted = true
  where id = auth.uid() and reward_granted = false
  returning orb_balance into new_balance;

  if new_balance is null then
    select orb_balance into new_balance from public.profiles where id = auth.uid();
  end if;

  return coalesce(new_balance, 0);
end;
$$;

revoke all on function public.grant_signup_reward(integer) from public;
grant execute on function public.grant_signup_reward(integer) to authenticated;
