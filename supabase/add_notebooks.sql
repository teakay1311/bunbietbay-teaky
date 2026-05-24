-- Migration: Phase 5 Notebook Sharing System
-- Execute this script in the Supabase SQL Editor

-- 1. Create Notebook Tables
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

-- 2. Add Triggers
drop trigger if exists notebooks_set_updated_at on public.notebooks;
create trigger notebooks_set_updated_at before update on public.notebooks
for each row execute procedure public.set_updated_at();

drop trigger if exists notebook_places_set_updated_at on public.notebook_places;
create trigger notebook_places_set_updated_at before update on public.notebook_places
for each row execute procedure public.set_updated_at();

-- 3. Add Helper Functions
create or replace function public.is_notebook_member(target_nb_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.notebook_memberships membership
    where membership.notebook_id = target_nb_id
      and membership.user_id = auth.uid()
  );
$$;

create or replace function public.is_notebook_editor(target_nb_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.notebook_memberships membership
    where membership.notebook_id = target_nb_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'admin', 'editor')
  );
$$;

-- 4. Enable RLS
alter table public.notebooks enable row level security;
alter table public.notebook_memberships enable row level security;
alter table public.notebook_places enable row level security;
alter table public.notebook_invitations enable row level security;

-- 5. Add Policies
-- Notebooks policies
drop policy if exists "Members can read notebooks" on public.notebooks;
create policy "Members can read notebooks"
on public.notebooks for select to authenticated
using (created_by = auth.uid() or public.is_notebook_member(id));

drop policy if exists "Authenticated users can create notebooks" on public.notebooks;
create policy "Authenticated users can create notebooks"
on public.notebooks for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists "Notebook members can update" on public.notebooks;
create policy "Notebook members can update"
on public.notebooks for update to authenticated
using (created_by = auth.uid() or public.is_notebook_editor(id));

drop policy if exists "Notebook owner can delete" on public.notebooks;
create policy "Notebook owner can delete"
on public.notebooks for delete to authenticated
using (created_by = auth.uid());

-- Notebook Memberships policies
drop policy if exists "Members can read notebook memberships" on public.notebook_memberships;
create policy "Members can read notebook memberships"
on public.notebook_memberships for select to authenticated
using (public.is_notebook_member(notebook_id) or exists(select 1 from public.notebooks where id = notebook_id and created_by = auth.uid()));

drop policy if exists "Owner can insert notebook memberships" on public.notebook_memberships;
create policy "Owner can insert notebook memberships"
on public.notebook_memberships for insert to authenticated
with check (exists(select 1 from public.notebooks where id = notebook_id and created_by = auth.uid()));

drop policy if exists "Owner can delete notebook memberships" on public.notebook_memberships;
create policy "Owner can delete notebook memberships"
on public.notebook_memberships for delete to authenticated
using (exists(select 1 from public.notebooks where id = notebook_id and created_by = auth.uid() or user_id = auth.uid()));

-- Notebook Places policies
drop policy if exists "Members can read notebook places" on public.notebook_places;
create policy "Members can read notebook places"
on public.notebook_places for select to authenticated
using (public.is_notebook_member(notebook_id) or created_by = auth.uid());

drop policy if exists "Editors can manage notebook places" on public.notebook_places;
create policy "Editors can manage notebook places"
on public.notebook_places for insert to authenticated
with check (public.is_notebook_editor(notebook_id) or created_by = auth.uid());

drop policy if exists "Editors can update notebook places" on public.notebook_places;
create policy "Editors can update notebook places"
on public.notebook_places for update to authenticated
using (public.is_notebook_editor(notebook_id) or created_by = auth.uid());

drop policy if exists "Editors can delete notebook places" on public.notebook_places;
create policy "Editors can delete notebook places"
on public.notebook_places for delete to authenticated
using (public.is_notebook_editor(notebook_id) or created_by = auth.uid());

-- Notebook Invitations policies
drop policy if exists "Notebook owners can read invitations" on public.notebook_invitations;
create policy "Notebook owners can read invitations"
on public.notebook_invitations for select to authenticated
using (
  exists(select 1 from public.notebooks where id = notebook_id and created_by = auth.uid())
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "Notebook owners can create invitations" on public.notebook_invitations;
create policy "Notebook owners can create invitations"
on public.notebook_invitations for insert to authenticated
with check (
  invited_by = auth.uid()
  and exists(select 1 from public.notebooks where id = notebook_id and created_by = auth.uid())
);

drop policy if exists "Notebook owners can update invitations" on public.notebook_invitations;
create policy "Notebook owners can update invitations"
on public.notebook_invitations for update to authenticated
using (
  exists(select 1 from public.notebooks where id = notebook_id and created_by = auth.uid())
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- 6. Indexes
create index if not exists notebook_memberships_nb_idx on public.notebook_memberships (notebook_id);
create index if not exists notebook_places_nb_idx on public.notebook_places (notebook_id);
create index if not exists notebook_invitations_nb_idx on public.notebook_invitations (notebook_id);
create index if not exists notebook_invitations_email_idx on public.notebook_invitations (lower(email));
