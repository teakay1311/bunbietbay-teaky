create extension if not exists pgcrypto;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $handle_profile$
begin
  insert into public.profiles (
    id,
    email,
    display_name,
    avatar_url
  )
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(split_part(coalesce(new.email, ''), '@', 1), 'Traveler'),
    'https://api.dicebear.com/9.x/glass/svg?seed=' || gen_random_uuid()::text
  )
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$handle_profile$;


create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text not null,
  avatar_url text not null default 'https://api.dicebear.com/9.x/glass/svg?seed=traveler',
  phone text,
  birthdate date,
  bio text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  location text not null,
  start_date date not null,
  end_date date not null,
  budget numeric not null default 0,
  base_currency text not null default 'VND',
  status text not null default 'upcoming' check (status in ('upcoming', 'completed', 'draft')),
  image text not null default '',
  review jsonb,
  theme_color text,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.trip_memberships (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz,
  unique (trip_id, user_id)
);

alter table public.trip_memberships add column if not exists revoked_at timestamptz;

create table if not exists public.trip_invitations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'editor', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  invited_by uuid not null references public.profiles (id) on delete cascade,
  accepted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (trip_id, email)
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  date date not null,
  time text not null,
  title text not null,
  location text not null,
  note text not null default '',
  type text not null,
  image text,
  map_url text,
  booking_code text,
  place_id uuid,
  is_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  date date not null,
  time text not null,
  title text not null,
  category text not null,
  amount numeric not null,
  original_amount numeric,
  currency text,
  exchange_rate numeric,
  paid_by uuid not null references public.profiles (id) on delete restrict,
  participants uuid[] not null default '{}',
  note text,
  receipt_image text,
  is_settlement boolean not null default false,
  activity_id uuid,
  place_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.saved_places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null,
  type text not null,
  phone text,
  address text,
  rating numeric,
  note text,
  source_notebook_place_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null,
  is_packed boolean not null default false,
  assignee_id uuid references public.profiles (id) on delete set null,
  category text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  url text not null,
  album text not null default 'Chung',
  storage text check (storage in ('embedded', 'remote')),
  provider text,
  provider_public_id text,
  taken_on date,
  place text,
  people text[] not null default '{}',
  tags text[] not null default '{}',
  item_type text not null default 'photo',
  content text,
  activity_id uuid references public.activities (id) on delete set null,
  place_id uuid references public.saved_places (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notebooks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'personal' check (type in ('personal', 'shared')),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notebook_memberships (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (notebook_id, user_id)
);

create table if not exists public.notebook_places (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks (id) on delete cascade,
  name text not null,
  type text not null check (type in ('hotel', 'restaurant', 'cafe', 'entertainment', 'other')),
  address text,
  phone text,
  note text,
  rating numeric not null default 5,
  custom_fields jsonb not null default '[]'::jsonb,
  cover_image text,
  photos text[] not null default '{}',
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  theme_mode text not null default 'system' check (theme_mode in ('light', 'dark', 'system')),
  theme_preset_id text not null default 'teal-editorial',
  ui_density text not null default 'cozy' check (ui_density in ('cozy', 'compact')),
  is_privacy_mode boolean not null default false,
  reminders_enabled boolean not null default true,
  activity_lead_minutes integer not null default 120 check (activity_lead_minutes between 1 and 10080),
  trip_start_lead_minutes integer not null default 1440 check (trip_start_lead_minutes between 1 and 20160),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.trip_notification_preferences (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  use_defaults boolean not null default true,
  enabled boolean,
  activity_lead_minutes integer check (activity_lead_minutes between 1 and 10080),
  trip_start_lead_minutes integer check (trip_start_lead_minutes between 1 and 20160),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (trip_id, user_id)
);

do $entity_link_constraints$
begin
  if not exists (select 1 from pg_constraint where conname = 'saved_places_source_notebook_place_id_fkey') then
    alter table public.saved_places add constraint saved_places_source_notebook_place_id_fkey
      foreign key (source_notebook_place_id) references public.notebook_places (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'activities_place_id_fkey') then
    alter table public.activities add constraint activities_place_id_fkey
      foreign key (place_id) references public.saved_places (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'expenses_activity_id_fkey') then
    alter table public.expenses add constraint expenses_activity_id_fkey
      foreign key (activity_id) references public.activities (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'expenses_place_id_fkey') then
    alter table public.expenses add constraint expenses_place_id_fkey
      foreign key (place_id) references public.saved_places (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'photos_activity_id_fkey') then
    alter table public.photos add constraint photos_activity_id_fkey
      foreign key (activity_id) references public.activities (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'photos_place_id_fkey') then
    alter table public.photos add constraint photos_place_id_fkey
      foreign key (place_id) references public.saved_places (id) on delete set null;
  end if;
end;
$entity_link_constraints$;

create index if not exists activities_place_id_idx on public.activities (place_id);
create index if not exists expenses_activity_id_idx on public.expenses (activity_id);
create index if not exists expenses_place_id_idx on public.expenses (place_id);
create index if not exists saved_places_source_notebook_place_id_idx on public.saved_places (source_notebook_place_id);
create index if not exists photos_activity_id_idx on public.photos (activity_id);
create index if not exists photos_place_id_idx on public.photos (place_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $set_updated$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$set_updated$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists trips_set_updated_at on public.trips;
create trigger trips_set_updated_at before update on public.trips
for each row execute procedure public.set_updated_at();

drop trigger if exists trip_invitations_set_updated_at on public.trip_invitations;
create trigger trip_invitations_set_updated_at before update on public.trip_invitations
for each row execute procedure public.set_updated_at();

drop trigger if exists activities_set_updated_at on public.activities;
create trigger activities_set_updated_at before update on public.activities
for each row execute procedure public.set_updated_at();

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at before update on public.expenses
for each row execute procedure public.set_updated_at();

drop trigger if exists saved_places_set_updated_at on public.saved_places;
create trigger saved_places_set_updated_at before update on public.saved_places
for each row execute procedure public.set_updated_at();

drop trigger if exists packing_items_set_updated_at on public.packing_items;
create trigger packing_items_set_updated_at before update on public.packing_items
for each row execute procedure public.set_updated_at();

drop trigger if exists photos_set_updated_at on public.photos;
create trigger photos_set_updated_at before update on public.photos
for each row execute procedure public.set_updated_at();

drop trigger if exists notebooks_set_updated_at on public.notebooks;
create trigger notebooks_set_updated_at before update on public.notebooks
for each row execute procedure public.set_updated_at();

drop trigger if exists notebook_places_set_updated_at on public.notebook_places;
create trigger notebook_places_set_updated_at before update on public.notebook_places
for each row execute procedure public.set_updated_at();

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at before update on public.user_preferences
for each row execute procedure public.set_updated_at();

drop trigger if exists trip_notification_preferences_set_updated_at on public.trip_notification_preferences;
create trigger trip_notification_preferences_set_updated_at before update on public.trip_notification_preferences
for each row execute procedure public.set_updated_at();

create or replace function public.is_trip_member(target_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $is_member$
  select exists (
    select 1
    from public.trip_memberships membership
    where membership.trip_id = target_trip_id
      and membership.user_id = auth.uid()
      and membership.revoked_at is null
  );
$is_member$;

create or replace function public.is_trip_editor(target_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $is_editor$
  select exists (
    select 1
    from public.trip_memberships membership
    where membership.trip_id = target_trip_id
      and membership.user_id = auth.uid()
      and membership.revoked_at is null
      and membership.role in ('owner', 'admin', 'editor')
  );
$is_editor$;

create or replace function public.is_trip_manager(target_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $is_manager$
  select exists (
    select 1
    from public.trip_memberships membership
    where membership.trip_id = target_trip_id
      and membership.user_id = auth.uid()
      and membership.revoked_at is null
      and membership.role in ('owner', 'admin')
  );
$is_manager$;

create or replace function public.is_trip_owner(target_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $is_owner$
  select exists (
    select 1
    from public.trip_memberships membership
    where membership.trip_id = target_trip_id
      and membership.user_id = auth.uid()
      and membership.revoked_at is null
      and membership.role = 'owner'
  );
$is_owner$;

-- NOTE: The accept_trip_invitation and accept_notebook_invitation functions are in a separate file
-- (accept_invitation_function.sql) to avoid Supabase SQL Editor parsing issues.
-- Please run that file separately after this schema.

create or replace function public.has_shared_trip(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $has_shared$
  select exists (
    select 1
    from public.trip_memberships mine
    join public.trip_memberships theirs on theirs.trip_id = mine.trip_id
    where mine.user_id = auth.uid()
      and mine.revoked_at is null
      and theirs.user_id = target_user_id
  );
$has_shared$;

create or replace function public.is_notebook_member(target_nb_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $is_nb_member$
  select exists (
    select 1
    from public.notebook_memberships membership
    where membership.notebook_id = target_nb_id
      and membership.user_id = auth.uid()
  );
$is_nb_member$;

create or replace function public.is_notebook_editor(target_nb_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $is_nb_editor$
  select exists (
    select 1
    from public.notebook_memberships membership
    where membership.notebook_id = target_nb_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'admin', 'editor')
  );
$is_nb_editor$;

create or replace function public.is_notebook_manager(target_nb_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $is_nb_manager$
  select exists (
    select 1 from public.notebook_memberships membership
    where membership.notebook_id = target_nb_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'admin')
  ) or exists (
    select 1 from public.notebooks notebook
    where notebook.id = target_nb_id and notebook.created_by = auth.uid()
  );
$is_nb_manager$;

create or replace function public.has_shared_notebook(target_user_id uuid)
returns boolean language sql security definer set search_path = public stable
as $has_shared_notebook$
  select exists (
    select 1 from public.notebook_memberships mine
    join public.notebook_memberships theirs on theirs.notebook_id = mine.notebook_id
    where mine.user_id = auth.uid() and theirs.user_id = target_user_id
  );
$has_shared_notebook$;

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_memberships enable row level security;
alter table public.trip_invitations enable row level security;
alter table public.activities enable row level security;
alter table public.expenses enable row level security;
alter table public.saved_places enable row level security;
alter table public.packing_items enable row level security;
alter table public.photos enable row level security;
alter table public.notebooks enable row level security;
alter table public.notebook_memberships enable row level security;
alter table public.notebook_places enable row level security;
alter table public.user_preferences enable row level security;
alter table public.trip_notification_preferences enable row level security;

drop policy if exists "Profiles are visible to shared trip members" on public.profiles;
create policy "Profiles are visible to shared trip members"
on public.profiles
for select
to authenticated
using (auth.uid() = id or public.has_shared_trip(id) or public.has_shared_notebook(id));

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Members can read trips" on public.trips;
create policy "Members can read trips"
on public.trips
for select
to authenticated
using (created_by = auth.uid() or public.is_trip_member(id));

drop policy if exists "Authenticated users can create trips" on public.trips;
create policy "Authenticated users can create trips"
on public.trips
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "Trip managers can update trips" on public.trips;
create policy "Trip managers can update trips"
on public.trips
for update
to authenticated
using (created_by = auth.uid() or public.is_trip_manager(id))
with check (created_by = auth.uid() or public.is_trip_manager(id));

drop policy if exists "Trip owners can delete trips" on public.trips;
create policy "Trip owners can delete trips"
on public.trips
for delete
to authenticated
using (created_by = auth.uid() or public.is_trip_owner(id));

drop policy if exists "Members can read memberships" on public.trip_memberships;
create policy "Members can read memberships"
on public.trip_memberships
for select
to authenticated
using (public.is_trip_member(trip_id) or exists (
  select 1 from public.trips trip where trip.id = trip_id and trip.created_by = auth.uid()
));

drop policy if exists "Managers can insert memberships" on public.trip_memberships;
create policy "Managers can insert memberships"
on public.trip_memberships
for insert
to authenticated
with check (
  (role = 'owner' and user_id = auth.uid() and exists (
    select 1 from public.trips trip where trip.id = trip_id and trip.created_by = auth.uid()
  ))
  or (role <> 'owner' and (
    public.is_trip_manager(trip_id)
    or exists (select 1 from public.trips trip where trip.id = trip_id and trip.created_by = auth.uid())
    or (
    user_id = auth.uid()
    and exists (
      select 1
      from public.trip_invitations invitation
      where invitation.trip_id = trip_id
        and invitation.role = role
        and lower(invitation.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and invitation.status = 'pending'
    )
    )
  ))
);

drop policy if exists "Managers can update memberships" on public.trip_memberships;
create policy "Managers can update memberships"
on public.trip_memberships
for update
to authenticated
using (role <> 'owner' and (public.is_trip_manager(trip_id) or exists (
  select 1 from public.trips trip where trip.id = trip_id and trip.created_by = auth.uid()
)))
with check (role <> 'owner' and (public.is_trip_manager(trip_id) or exists (
  select 1 from public.trips trip where trip.id = trip_id and trip.created_by = auth.uid()
)));

drop policy if exists "Managers can delete memberships" on public.trip_memberships;
create policy "Managers can delete memberships"
on public.trip_memberships
for delete
to authenticated
using (role <> 'owner' and (public.is_trip_manager(trip_id) or exists (
  select 1 from public.trips trip where trip.id = trip_id and trip.created_by = auth.uid()
)));

drop policy if exists "Managers and invited users can read invitations" on public.trip_invitations;
create policy "Managers and invited users can read invitations"
on public.trip_invitations
for select
to authenticated
using (
  public.is_trip_manager(trip_id)
  or exists (select 1 from public.trips trip where trip.id = trip_id and trip.created_by = auth.uid())
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "Managers can create invitations" on public.trip_invitations;
create policy "Managers can create invitations"
on public.trip_invitations
for insert
to authenticated
with check (
  invited_by = auth.uid()
  and (
    public.is_trip_manager(trip_id)
    or exists (select 1 from public.trips trip where trip.id = trip_id and trip.created_by = auth.uid())
  )
);

drop policy if exists "Managers and invited users can update invitations" on public.trip_invitations;
create policy "Managers and invited users can update invitations"
on public.trip_invitations
for update
to authenticated
using (
  public.is_trip_manager(trip_id)
  or exists (select 1 from public.trips trip where trip.id = trip_id and trip.created_by = auth.uid())
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
)
with check (
  public.is_trip_manager(trip_id)
  or exists (select 1 from public.trips trip where trip.id = trip_id and trip.created_by = auth.uid())
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "Members can read activities" on public.activities;
create policy "Members can read activities"
on public.activities
for select
to authenticated
using (public.is_trip_member(trip_id));

drop policy if exists "Editors can manage activities" on public.activities;
create policy "Editors can manage activities"
on public.activities
for insert
to authenticated
with check (public.is_trip_editor(trip_id));

drop policy if exists "Editors can update activities" on public.activities;
create policy "Editors can update activities"
on public.activities
for update
to authenticated
using (public.is_trip_editor(trip_id))
with check (public.is_trip_editor(trip_id));

drop policy if exists "Editors can delete activities" on public.activities;
create policy "Editors can delete activities"
on public.activities
for delete
to authenticated
using (public.is_trip_editor(trip_id));

drop policy if exists "Members can read expenses" on public.expenses;
create policy "Members can read expenses"
on public.expenses
for select
to authenticated
using (public.is_trip_member(trip_id));

drop policy if exists "Editors can manage expenses" on public.expenses;
create policy "Editors can manage expenses"
on public.expenses
for insert
to authenticated
with check (public.is_trip_editor(trip_id));

drop policy if exists "Editors can update expenses" on public.expenses;
create policy "Editors can update expenses"
on public.expenses
for update
to authenticated
using (public.is_trip_editor(trip_id))
with check (public.is_trip_editor(trip_id));

drop policy if exists "Editors can delete expenses" on public.expenses;
create policy "Editors can delete expenses"
on public.expenses
for delete
to authenticated
using (public.is_trip_editor(trip_id));

drop policy if exists "Members can read saved places" on public.saved_places;
create policy "Members can read saved places"
on public.saved_places
for select
to authenticated
using (public.is_trip_member(trip_id));

drop policy if exists "Editors can manage saved places" on public.saved_places;
create policy "Editors can manage saved places"
on public.saved_places
for insert
to authenticated
with check (public.is_trip_editor(trip_id));

drop policy if exists "Editors can update saved places" on public.saved_places;
create policy "Editors can update saved places"
on public.saved_places
for update
to authenticated
using (public.is_trip_editor(trip_id))
with check (public.is_trip_editor(trip_id));

drop policy if exists "Editors can delete saved places" on public.saved_places;
create policy "Editors can delete saved places"
on public.saved_places
for delete
to authenticated
using (public.is_trip_editor(trip_id));

drop policy if exists "Members can read packing items" on public.packing_items;
create policy "Members can read packing items"
on public.packing_items
for select
to authenticated
using (public.is_trip_member(trip_id));

drop policy if exists "Editors can manage packing items" on public.packing_items;
create policy "Editors can manage packing items"
on public.packing_items
for insert
to authenticated
with check (public.is_trip_editor(trip_id));

drop policy if exists "Editors can update packing items" on public.packing_items;
create policy "Editors can update packing items"
on public.packing_items
for update
to authenticated
using (public.is_trip_editor(trip_id))
with check (public.is_trip_editor(trip_id));

drop policy if exists "Editors can delete packing items" on public.packing_items;
create policy "Editors can delete packing items"
on public.packing_items
for delete
to authenticated
using (public.is_trip_editor(trip_id));

drop policy if exists "Members can read photos" on public.photos;
create policy "Members can read photos"
on public.photos
for select
to authenticated
using (public.is_trip_member(trip_id));

drop policy if exists "Editors can manage photos" on public.photos;
create policy "Editors can manage photos"
on public.photos
for insert
to authenticated
with check (public.is_trip_editor(trip_id));

drop policy if exists "Editors can update photos" on public.photos;
create policy "Editors can update photos"
on public.photos
for update
to authenticated
using (public.is_trip_editor(trip_id))
with check (public.is_trip_editor(trip_id));

drop policy if exists "Editors can delete photos" on public.photos;
create policy "Editors can delete photos"
on public.photos
for delete
to authenticated
using (public.is_trip_editor(trip_id));

-- Notebooks policies
drop policy if exists "Members can read notebooks" on public.notebooks;
create policy "Members can read notebooks"
on public.notebooks
for select
to authenticated
using (created_by = auth.uid() or public.is_notebook_member(id));

drop policy if exists "Authenticated users can create notebooks" on public.notebooks;
create policy "Authenticated users can create notebooks"
on public.notebooks
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "Notebook members can update" on public.notebooks;
create policy "Notebook members can update"
on public.notebooks
for update
to authenticated
using (created_by = auth.uid() or public.is_notebook_manager(id));

create or replace function public.validate_notebook_owner_change()
returns trigger language plpgsql security definer set search_path = public
as $validate_notebook_owner$
begin
  if new.created_by is distinct from old.created_by and not (
    old.created_by = auth.uid()
    and exists (
      select 1 from public.notebook_memberships membership
      where membership.notebook_id = old.id
        and membership.user_id = old.created_by
        and membership.role = 'admin'
    )
    and exists (
      select 1 from public.notebook_memberships membership
      where membership.notebook_id = old.id
        and membership.user_id = new.created_by
        and membership.role = 'owner'
    )
  ) then
    raise exception 'Notebook ownership must be transferred with the ownership RPC' using errcode = '42501';
  end if;
  return new;
end;
$validate_notebook_owner$;

drop trigger if exists notebooks_validate_owner_change on public.notebooks;
create trigger notebooks_validate_owner_change before update on public.notebooks
for each row execute procedure public.validate_notebook_owner_change();

drop policy if exists "Notebook owner can delete" on public.notebooks;
create policy "Notebook owner can delete"
on public.notebooks
for delete
to authenticated
using (created_by = auth.uid());

-- Notebook Memberships
drop policy if exists "Members can read notebook memberships" on public.notebook_memberships;
create policy "Members can read notebook memberships"
on public.notebook_memberships
for select
to authenticated
using (public.is_notebook_member(notebook_id) or exists(select 1 from public.notebooks where id = notebook_id and created_by = auth.uid()));

drop policy if exists "Owner can insert notebook memberships" on public.notebook_memberships;
drop policy if exists "Managers can insert notebook memberships" on public.notebook_memberships;
create policy "Managers can insert notebook memberships"
on public.notebook_memberships
for insert
to authenticated
with check (
  (role = 'owner' and user_id = auth.uid() and exists (
    select 1 from public.notebooks notebook
    where notebook.id = notebook_id and notebook.created_by = auth.uid()
  ))
  or (public.is_notebook_manager(notebook_id) and role <> 'owner')
);

drop policy if exists "Managers can update notebook memberships" on public.notebook_memberships;
create policy "Managers can update notebook memberships"
on public.notebook_memberships
for update
to authenticated
using (public.is_notebook_manager(notebook_id) and role <> 'owner')
with check (public.is_notebook_manager(notebook_id) and role <> 'owner');

drop policy if exists "Owner can delete notebook memberships" on public.notebook_memberships;
drop policy if exists "Managers can delete notebook memberships" on public.notebook_memberships;
create policy "Managers can delete notebook memberships"
on public.notebook_memberships
for delete
to authenticated
using (role <> 'owner' and (public.is_notebook_manager(notebook_id) or user_id = auth.uid()));

create or replace function public.transfer_notebook_ownership(target_membership_id uuid)
returns void language plpgsql security definer set search_path = public
as $transfer_notebook_owner$
declare
  target_membership public.notebook_memberships%rowtype;
  current_owner_id uuid;
begin
  select * into target_membership from public.notebook_memberships where id = target_membership_id for update;
  if not found or target_membership.user_id = auth.uid() then
    raise exception 'Invalid ownership target' using errcode = '22023';
  end if;
  select id into current_owner_id from public.notebook_memberships
  where notebook_id = target_membership.notebook_id and user_id = auth.uid() and role = 'owner' for update;
  if current_owner_id is null then
    raise exception 'Only the owner can transfer this library' using errcode = '42501';
  end if;
  update public.notebook_memberships set role = 'admin' where id = current_owner_id;
  update public.notebook_memberships set role = 'owner' where id = target_membership_id;
  update public.notebooks set created_by = target_membership.user_id where id = target_membership.notebook_id;
end;
$transfer_notebook_owner$;

grant execute on function public.transfer_notebook_ownership(uuid) to authenticated;

-- Notebook Places
drop policy if exists "Members can read notebook places" on public.notebook_places;
create policy "Members can read notebook places"
on public.notebook_places
for select
to authenticated
using (public.is_notebook_member(notebook_id) or created_by = auth.uid());

drop policy if exists "Editors can manage notebook places" on public.notebook_places;
create policy "Editors can manage notebook places"
on public.notebook_places
for insert
to authenticated
with check (public.is_notebook_editor(notebook_id) or created_by = auth.uid());

drop policy if exists "Editors can update notebook places" on public.notebook_places;
create policy "Editors can update notebook places"
on public.notebook_places
for update
to authenticated
using (public.is_notebook_editor(notebook_id) or created_by = auth.uid());

drop policy if exists "Editors can delete notebook places" on public.notebook_places;
create policy "Editors can delete notebook places"
on public.notebook_places
for delete
to authenticated
using (public.is_notebook_editor(notebook_id) or created_by = auth.uid());

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists trips_created_by_idx on public.trips (created_by);
create index if not exists trip_memberships_trip_idx on public.trip_memberships (trip_id);
create index if not exists trip_memberships_user_idx on public.trip_memberships (user_id);
create index if not exists trip_invitations_trip_idx on public.trip_invitations (trip_id);
create index if not exists trip_invitations_email_idx on public.trip_invitations (lower(email));
create index if not exists activities_trip_idx on public.activities (trip_id);
create index if not exists expenses_trip_idx on public.expenses (trip_id);
create index if not exists saved_places_trip_idx on public.saved_places (trip_id);
create index if not exists packing_items_trip_idx on public.packing_items (trip_id);
create index if not exists photos_trip_idx on public.photos (trip_id);
create index if not exists notebook_memberships_nb_idx on public.notebook_memberships (notebook_id);
create index if not exists notebook_places_nb_idx on public.notebook_places (notebook_id);
create index if not exists trip_notification_preferences_user_idx on public.trip_notification_preferences (user_id);

-- Notebook Invitations
create table if not exists public.notebook_invitations (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks (id) on delete cascade,
  email text not null,
  role text not null default 'editor' check (role in ('admin', 'editor', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  invited_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (notebook_id, email)
);

alter table public.notebook_invitations enable row level security;

drop policy if exists "Notebook owners can read invitations" on public.notebook_invitations;
drop policy if exists "Notebook managers can read invitations" on public.notebook_invitations;
create policy "Notebook managers can read invitations"
on public.notebook_invitations
for select
to authenticated
using (
  public.is_notebook_manager(notebook_id)
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "Notebook owners can create invitations" on public.notebook_invitations;
drop policy if exists "Notebook managers can create invitations" on public.notebook_invitations;
create policy "Notebook managers can create invitations"
on public.notebook_invitations
for insert
to authenticated
with check (
  invited_by = auth.uid()
  and public.is_notebook_manager(notebook_id)
);

drop policy if exists "Notebook owners can update invitations" on public.notebook_invitations;
drop policy if exists "Notebook managers can update invitations" on public.notebook_invitations;
create policy "Notebook managers can update invitations"
on public.notebook_invitations
for update
to authenticated
using (
  public.is_notebook_manager(notebook_id)
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

create index if not exists notebook_invitations_nb_idx on public.notebook_invitations (notebook_id);
create index if not exists notebook_invitations_email_idx on public.notebook_invitations (lower(email));

drop policy if exists "Users manage own preferences" on public.user_preferences;
create policy "Users manage own preferences" on public.user_preferences
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Members manage own trip notification preferences" on public.trip_notification_preferences;
create policy "Members manage own trip notification preferences" on public.trip_notification_preferences
for all to authenticated
using (user_id = auth.uid() and public.is_trip_member(trip_id))
with check (user_id = auth.uid() and public.is_trip_member(trip_id));
