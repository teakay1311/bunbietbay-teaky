-- Additive migration. Run after add_revoked_trip_memberships.sql and add_trip_entity_links.sql.

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

alter table public.user_preferences enable row level security;
alter table public.trip_notification_preferences enable row level security;

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at before update on public.user_preferences
for each row execute procedure public.set_updated_at();

drop trigger if exists trip_notification_preferences_set_updated_at on public.trip_notification_preferences;
create trigger trip_notification_preferences_set_updated_at before update on public.trip_notification_preferences
for each row execute procedure public.set_updated_at();

drop policy if exists "Users manage own preferences" on public.user_preferences;
create policy "Users manage own preferences" on public.user_preferences
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Members manage own trip notification preferences" on public.trip_notification_preferences;
create policy "Members manage own trip notification preferences" on public.trip_notification_preferences
for all to authenticated
using (user_id = auth.uid() and public.is_trip_member(trip_id))
with check (user_id = auth.uid() and public.is_trip_member(trip_id));

create index if not exists trip_notification_preferences_user_idx on public.trip_notification_preferences (user_id);

create or replace function public.is_notebook_manager(target_nb_id uuid)
returns boolean language sql security definer set search_path = public stable
as $function$
  select exists (
    select 1 from public.notebook_memberships membership
    where membership.notebook_id = target_nb_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'admin')
  ) or exists (
    select 1 from public.notebooks notebook
    where notebook.id = target_nb_id and notebook.created_by = auth.uid()
  );
$function$;

create or replace function public.has_shared_notebook(target_user_id uuid)
returns boolean language sql security definer set search_path = public stable
as $function$
  select exists (
    select 1 from public.notebook_memberships mine
    join public.notebook_memberships theirs on theirs.notebook_id = mine.notebook_id
    where mine.user_id = auth.uid() and theirs.user_id = target_user_id
  );
$function$;

drop policy if exists "Profiles are visible to shared trip members" on public.profiles;
create policy "Profiles are visible to shared trip members" on public.profiles
for select to authenticated using (auth.uid() = id or public.has_shared_trip(id) or public.has_shared_notebook(id));

drop policy if exists "Notebook members can update" on public.notebooks;
create policy "Notebook members can update" on public.notebooks
for update to authenticated
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

drop policy if exists "Owner can insert notebook memberships" on public.notebook_memberships;
drop policy if exists "Managers can insert notebook memberships" on public.notebook_memberships;
create policy "Managers can insert notebook memberships" on public.notebook_memberships
for insert to authenticated with check (
  (role = 'owner' and user_id = auth.uid() and exists (
    select 1 from public.notebooks notebook
    where notebook.id = notebook_id and notebook.created_by = auth.uid()
  ))
  or (public.is_notebook_manager(notebook_id) and role <> 'owner')
);

drop policy if exists "Managers can update notebook memberships" on public.notebook_memberships;
create policy "Managers can update notebook memberships" on public.notebook_memberships
for update to authenticated
using (public.is_notebook_manager(notebook_id) and role <> 'owner')
with check (public.is_notebook_manager(notebook_id) and role <> 'owner');

drop policy if exists "Owner can delete notebook memberships" on public.notebook_memberships;
drop policy if exists "Managers can delete notebook memberships" on public.notebook_memberships;
create policy "Managers can delete notebook memberships" on public.notebook_memberships
for delete to authenticated
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

drop policy if exists "Notebook owners can read invitations" on public.notebook_invitations;
drop policy if exists "Notebook managers can read invitations" on public.notebook_invitations;
create policy "Notebook managers can read invitations" on public.notebook_invitations
for select to authenticated using (public.is_notebook_manager(notebook_id) or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "Notebook owners can create invitations" on public.notebook_invitations;
drop policy if exists "Notebook managers can create invitations" on public.notebook_invitations;
create policy "Notebook managers can create invitations" on public.notebook_invitations
for insert to authenticated with check (invited_by = auth.uid() and public.is_notebook_manager(notebook_id));

drop policy if exists "Notebook owners can update invitations" on public.notebook_invitations;
drop policy if exists "Notebook managers can update invitations" on public.notebook_invitations;
create policy "Notebook managers can update invitations" on public.notebook_invitations
for update to authenticated using (public.is_notebook_manager(notebook_id) or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
