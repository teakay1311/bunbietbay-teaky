begin;

-- Restore the authoritative trip creator as the sole active owner before
-- tightening policies. Existing child data is not touched.
update public.trip_memberships membership
set role = 'admin'
from public.trips trip
where membership.trip_id = trip.id
  and membership.role = 'owner'
  and membership.user_id <> trip.created_by;

insert into public.trip_memberships (trip_id, user_id, role, revoked_at)
select trip.id, trip.created_by, 'owner', null
from public.trips trip
join public.profiles profile on profile.id = trip.created_by
on conflict (trip_id, user_id) do update
set role = 'owner', revoked_at = null;

drop policy if exists "Managers can insert memberships" on public.trip_memberships;
create policy "Managers can insert memberships"
on public.trip_memberships for insert to authenticated
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
        select 1 from public.trip_invitations invitation
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
on public.trip_memberships for update to authenticated
using (role <> 'owner' and (public.is_trip_manager(trip_id) or exists (
  select 1 from public.trips trip where trip.id = trip_id and trip.created_by = auth.uid()
)))
with check (role <> 'owner' and (public.is_trip_manager(trip_id) or exists (
  select 1 from public.trips trip where trip.id = trip_id and trip.created_by = auth.uid()
)));

drop policy if exists "Managers can delete memberships" on public.trip_memberships;
create policy "Managers can delete memberships"
on public.trip_memberships for delete to authenticated
using (role <> 'owner' and (public.is_trip_manager(trip_id) or exists (
  select 1 from public.trips trip where trip.id = trip_id and trip.created_by = auth.uid()
)));

drop policy if exists "Managers can delete notebook memberships" on public.notebook_memberships;
create policy "Managers can delete notebook memberships"
on public.notebook_memberships for delete to authenticated
using (role <> 'owner' and (public.is_notebook_manager(notebook_id) or user_id = auth.uid()));

commit;
