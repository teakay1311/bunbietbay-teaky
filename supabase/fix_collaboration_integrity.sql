create or replace function public.validate_trip_comment()
returns trigger language plpgsql set search_path = public as $$
declare linked_trip uuid; parent_trip uuid; parent_parent uuid; parent_target_type text; parent_target_id uuid; mentioned uuid;
begin
  case new.target_type
    when 'activity' then select trip_id into linked_trip from public.activities where id = new.target_id;
    when 'expense' then select trip_id into linked_trip from public.expenses where id = new.target_id;
    when 'place' then select trip_id into linked_trip from public.saved_places where id = new.target_id;
    when 'photo' then select trip_id into linked_trip from public.photos where id = new.target_id;
    when 'task' then select trip_id into linked_trip from public.trip_tasks where id = new.target_id;
    when 'poll' then select trip_id into linked_trip from public.trip_polls where id = new.target_id;
  end case;
  if linked_trip is distinct from new.trip_id then raise exception 'Comment target must belong to the same trip'; end if;
  if new.parent_id is not null then
    select trip_id, parent_id, target_type, target_id into parent_trip, parent_parent, parent_target_type, parent_target_id from public.trip_comments where id = new.parent_id;
    if parent_trip is distinct from new.trip_id or parent_parent is not null or parent_target_type is distinct from new.target_type or parent_target_id is distinct from new.target_id then raise exception 'Replies must belong to the same comment thread'; end if;
  end if;
  foreach mentioned in array new.mentioned_user_ids loop
    if not exists (select 1 from public.trip_memberships m where m.trip_id = new.trip_id and m.user_id = mentioned and m.revoked_at is null) then raise exception 'Mentioned user must be an active trip member'; end if;
  end loop;
  return new;
end;
$$;

create or replace function public.clear_revoked_trip_assignments()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.revoked_at is null and new.revoked_at is not null then
    update public.trip_tasks set assignee_id = null where trip_id = new.trip_id and assignee_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trip_memberships_clear_revoked_assignments on public.trip_memberships;
create trigger trip_memberships_clear_revoked_assignments
after update of revoked_at on public.trip_memberships
for each row execute procedure public.clear_revoked_trip_assignments();

update public.trip_tasks task set assignee_id = null
where task.assignee_id is not null and not exists (
  select 1 from public.trip_memberships membership
  where membership.trip_id = task.trip_id and membership.user_id = task.assignee_id and membership.revoked_at is null
);
