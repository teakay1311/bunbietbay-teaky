alter table public.trip_memberships
add column if not exists revoked_at timestamptz;

create or replace function public.is_trip_member(target_trip_id uuid)
returns boolean language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.trip_memberships membership
    where membership.trip_id = target_trip_id
      and membership.user_id = auth.uid()
      and membership.revoked_at is null
  );
$$;

create or replace function public.is_trip_editor(target_trip_id uuid)
returns boolean language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.trip_memberships membership
    where membership.trip_id = target_trip_id
      and membership.user_id = auth.uid()
      and membership.revoked_at is null
      and membership.role in ('owner', 'admin', 'editor')
  );
$$;

create or replace function public.is_trip_manager(target_trip_id uuid)
returns boolean language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.trip_memberships membership
    where membership.trip_id = target_trip_id
      and membership.user_id = auth.uid()
      and membership.revoked_at is null
      and membership.role in ('owner', 'admin')
  );
$$;

create or replace function public.is_trip_owner(target_trip_id uuid)
returns boolean language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.trip_memberships membership
    where membership.trip_id = target_trip_id
      and membership.user_id = auth.uid()
      and membership.revoked_at is null
      and membership.role = 'owner'
  );
$$;

create or replace function public.has_shared_trip(target_user_id uuid)
returns boolean language sql security definer set search_path = public stable
as $$
  select exists (
    select 1
    from public.trip_memberships mine
    join public.trip_memberships theirs on theirs.trip_id = mine.trip_id
    where mine.user_id = auth.uid()
      and mine.revoked_at is null
      and theirs.user_id = target_user_id
  );
$$;

create or replace function public.accept_trip_invitation(target_invitation_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform 1 from public.trip_invitations
  where id = target_invitation_id
    and status = 'pending'
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  for update;

  if not found then
    raise exception 'Invitation not found, not pending, or does not belong to current user';
  end if;

  insert into public.trip_memberships (trip_id, user_id, role, revoked_at)
  select trip_id, auth.uid(), role, null
  from public.trip_invitations
  where id = target_invitation_id
  on conflict (trip_id, user_id)
  do update set role = excluded.role,
                revoked_at = null;

  update public.trip_invitations
  set status = 'accepted', accepted_by = auth.uid()
  where id = target_invitation_id;
end;
$$;

notify pgrst, 'reload schema';
