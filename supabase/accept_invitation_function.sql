-- Run this file SEPARATELY after running schema.sql
-- The Supabase SQL Editor has issues parsing PL/pgSQL function bodies in large files.

create or replace function public.accept_trip_invitation(target_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $accept_inv$
begin
  -- Validate: invitation must exist, be pending, and belong to the requesting user
  perform 1
  from public.trip_invitations
  where id = target_invitation_id
    and status = 'pending'
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  for update;

  if not found then
    raise exception 'Invitation not found, not pending, or does not belong to current user';
  end if;

  -- Create membership from the invitation data
  insert into public.trip_memberships (trip_id, user_id, role)
  select trip_id, auth.uid(), role
  from public.trip_invitations
  where id = target_invitation_id
  on conflict (trip_id, user_id)
  do update set role = excluded.role;

  -- Mark invitation as accepted
  update public.trip_invitations
  set status = 'accepted',
      accepted_by = auth.uid()
  where id = target_invitation_id;
end;
$accept_inv$;

create or replace function public.accept_notebook_invitation(target_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $accept_notebook_inv$
begin
  perform 1
  from public.notebook_invitations
  where id = target_invitation_id
    and status = 'pending'
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  for update;

  if not found then
    raise exception 'Notebook invitation not found, not pending, or does not belong to current user';
  end if;

  insert into public.notebook_memberships (notebook_id, user_id, role)
  select notebook_id, auth.uid(), role
  from public.notebook_invitations
  where id = target_invitation_id
  on conflict (notebook_id, user_id)
  do update set role = excluded.role;

  update public.notebook_invitations
  set status = 'accepted'
  where id = target_invitation_id;
end;
$accept_notebook_inv$;
