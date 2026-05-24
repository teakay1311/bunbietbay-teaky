create table if not exists public.trip_settings (
  trip_id uuid primary key references public.trips (id) on delete cascade,
  category_budgets jsonb not null default '{}'::jsonb,
  exchange_rates jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.trip_activity_logs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name text,
  action text not null check (action in ('created', 'updated', 'deleted', 'settled', 'imported')),
  entity_type text not null check (entity_type in ('trip', 'activity', 'expense', 'place', 'packing', 'photo', 'member', 'notebook')),
  entity_id text,
  summary text not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.trip_settings enable row level security;
alter table public.trip_activity_logs enable row level security;

drop policy if exists "Trip settings are visible to trip members" on public.trip_settings;
create policy "Trip settings are visible to trip members"
on public.trip_settings for select
using (public.is_trip_member(trip_id));

drop policy if exists "Trip admins can manage trip settings" on public.trip_settings;
create policy "Trip admins can manage trip settings"
on public.trip_settings for all
using (public.is_trip_manager(trip_id))
with check (public.is_trip_manager(trip_id));

drop policy if exists "Trip logs are visible to trip members" on public.trip_activity_logs;
create policy "Trip logs are visible to trip members"
on public.trip_activity_logs for select
using (public.is_trip_member(trip_id));

drop policy if exists "Trip editors can create trip logs" on public.trip_activity_logs;
create policy "Trip editors can create trip logs"
on public.trip_activity_logs for insert
with check (public.is_trip_editor(trip_id));
