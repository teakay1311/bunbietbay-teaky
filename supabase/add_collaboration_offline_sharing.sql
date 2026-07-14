create extension if not exists pgcrypto;

alter table public.activities add column if not exists duration_minutes integer not null default 60 check (duration_minutes between 5 and 1440);
alter table public.activities add column if not exists travel_minutes_after integer not null default 0 check (travel_minutes_after between 0 and 720);
alter table public.photos add column if not exists content_hash text;
alter table public.photos add column if not exists perceptual_hash text;
alter table public.photos add column if not exists hash_version integer;

create table if not exists public.trip_collaboration_settings (
  trip_id uuid primary key references public.trips (id) on delete cascade,
  viewer_can_vote boolean not null default true,
  viewer_can_comment boolean not null default true,
  viewer_can_update_assigned_tasks boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.trip_collaboration_settings (trip_id)
select id from public.trips on conflict (trip_id) do nothing;

create or replace function public.create_trip_collaboration_settings()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.trip_collaboration_settings (trip_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists trips_create_collaboration_settings on public.trips;
create trigger trips_create_collaboration_settings after insert on public.trips
for each row execute procedure public.create_trip_collaboration_settings();

create table if not exists public.trip_tasks (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  assignee_id uuid references public.profiles (id) on delete set null,
  due_date date,
  due_time time,
  activity_id uuid references public.activities (id) on delete set null,
  place_id uuid references public.saved_places (id) on delete set null,
  created_by uuid not null references public.profiles (id),
  completed_by uuid references public.profiles (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.trip_polls (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  question text not null check (char_length(trim(question)) between 1 and 300),
  kind text not null default 'custom' check (kind in ('place', 'hotel', 'restaurant', 'time', 'custom')),
  selection_mode text not null default 'single' check (selection_mode in ('single', 'multiple')),
  status text not null default 'open' check (status in ('open', 'closed')),
  deadline timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.trip_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.trip_polls (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 200),
  activity_id uuid references public.activities (id) on delete set null,
  place_id uuid references public.saved_places (id) on delete set null,
  proposed_date date,
  proposed_time time,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.trip_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.trip_polls (id) on delete cascade,
  option_id uuid not null references public.trip_poll_options (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (poll_id, option_id, user_id)
);

create table if not exists public.trip_comments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  target_type text not null check (target_type in ('activity', 'expense', 'place', 'photo', 'task', 'poll')),
  target_id uuid not null,
  parent_id uuid references public.trip_comments (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null check (char_length(body) between 1 and 5000),
  mentioned_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.trip_notifications (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  type text not null check (type in ('task_assigned', 'comment_reply', 'mention', 'poll_closed')),
  event_key text not null unique,
  title text not null,
  message text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.trip_public_shares (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  token_hash text not null unique,
  scopes text[] not null default array['overview','itinerary','places']::text[],
  expires_at timestamptz not null default timezone('utc', now()) + interval '30 days',
  revoked_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (scopes <@ array['overview','itinerary','places','photos']::text[] and cardinality(scopes) > 0)
);

create index if not exists trip_tasks_trip_status_idx on public.trip_tasks (trip_id, status);
create index if not exists trip_tasks_assignee_due_idx on public.trip_tasks (assignee_id, due_date);
create index if not exists trip_polls_trip_status_idx on public.trip_polls (trip_id, status, deadline);
create index if not exists trip_poll_options_poll_idx on public.trip_poll_options (poll_id);
create index if not exists trip_poll_votes_poll_idx on public.trip_poll_votes (poll_id);
create index if not exists trip_comments_target_idx on public.trip_comments (trip_id, target_type, target_id, created_at);
create index if not exists trip_notifications_recipient_idx on public.trip_notifications (recipient_id, read_at, created_at desc);
create index if not exists photos_content_hash_idx on public.photos (content_hash) where content_hash is not null;
create index if not exists photos_perceptual_hash_idx on public.photos (perceptual_hash) where perceptual_hash is not null;

drop trigger if exists trip_collaboration_settings_set_updated_at on public.trip_collaboration_settings;
create trigger trip_collaboration_settings_set_updated_at before update on public.trip_collaboration_settings for each row execute procedure public.set_updated_at();
drop trigger if exists trip_tasks_set_updated_at on public.trip_tasks;
create trigger trip_tasks_set_updated_at before update on public.trip_tasks for each row execute procedure public.set_updated_at();
drop trigger if exists trip_polls_set_updated_at on public.trip_polls;
create trigger trip_polls_set_updated_at before update on public.trip_polls for each row execute procedure public.set_updated_at();
drop trigger if exists trip_comments_set_updated_at on public.trip_comments;
create trigger trip_comments_set_updated_at before update on public.trip_comments for each row execute procedure public.set_updated_at();
drop trigger if exists trip_public_shares_set_updated_at on public.trip_public_shares;
create trigger trip_public_shares_set_updated_at before update on public.trip_public_shares for each row execute procedure public.set_updated_at();

create or replace function public.validate_collaboration_entity_links()
returns trigger language plpgsql set search_path = public as $$
declare linked_trip uuid;
begin
  if tg_table_name = 'trip_tasks' then
    if new.assignee_id is not null and not exists (select 1 from public.trip_memberships m where m.trip_id = new.trip_id and m.user_id = new.assignee_id and m.revoked_at is null) then raise exception 'Task assignee must be an active trip member'; end if;
    if new.activity_id is not null then select trip_id into linked_trip from public.activities where id = new.activity_id; if linked_trip is distinct from new.trip_id then raise exception 'Task activity must belong to the same trip'; end if; end if;
    if new.place_id is not null then select trip_id into linked_trip from public.saved_places where id = new.place_id; if linked_trip is distinct from new.trip_id then raise exception 'Task place must belong to the same trip'; end if; end if;
  elsif tg_table_name = 'trip_poll_options' then
    select trip_id into linked_trip from public.trip_polls where id = new.poll_id; if linked_trip is distinct from new.trip_id then raise exception 'Poll option must belong to the same trip'; end if;
    if new.activity_id is not null then select trip_id into linked_trip from public.activities where id = new.activity_id; if linked_trip is distinct from new.trip_id then raise exception 'Poll activity must belong to the same trip'; end if; end if;
    if new.place_id is not null then select trip_id into linked_trip from public.saved_places where id = new.place_id; if linked_trip is distinct from new.trip_id then raise exception 'Poll place must belong to the same trip'; end if; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trip_tasks_validate_links on public.trip_tasks;
create trigger trip_tasks_validate_links before insert or update on public.trip_tasks for each row execute procedure public.validate_collaboration_entity_links();
drop trigger if exists trip_poll_options_validate_links on public.trip_poll_options;
create trigger trip_poll_options_validate_links before insert or update on public.trip_poll_options for each row execute procedure public.validate_collaboration_entity_links();

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

drop trigger if exists trip_comments_validate on public.trip_comments;
create trigger trip_comments_validate before insert or update on public.trip_comments for each row execute procedure public.validate_trip_comment();

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
create trigger trip_memberships_clear_revoked_assignments after update of revoked_at on public.trip_memberships for each row execute procedure public.clear_revoked_trip_assignments();

update public.trip_tasks task set assignee_id = null
where task.assignee_id is not null and not exists (
  select 1 from public.trip_memberships membership
  where membership.trip_id = task.trip_id and membership.user_id = task.assignee_id and membership.revoked_at is null
);

create or replace function public.validate_poll_vote()
returns trigger language plpgsql set search_path = public as $$
declare selected_poll public.trip_polls; option_trip uuid; existing_count integer;
begin
  select * into selected_poll from public.trip_polls where id = new.poll_id;
  select trip_id into option_trip from public.trip_poll_options where id = new.option_id and poll_id = new.poll_id;
  if selected_poll.id is null or selected_poll.trip_id is distinct from new.trip_id or option_trip is distinct from new.trip_id then raise exception 'Invalid poll vote links'; end if;
  if selected_poll.status <> 'open' or (selected_poll.deadline is not null and selected_poll.deadline <= timezone('utc', now())) then raise exception 'Poll is closed'; end if;
  if selected_poll.selection_mode = 'single' then
    select count(*) into existing_count from public.trip_poll_votes where poll_id = new.poll_id and user_id = new.user_id and id <> new.id;
    if existing_count > 0 then raise exception 'Single-choice poll accepts one vote'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trip_poll_votes_validate on public.trip_poll_votes;
create trigger trip_poll_votes_validate before insert or update on public.trip_poll_votes for each row execute procedure public.validate_poll_vote();

create or replace function public.lock_voted_poll_options()
returns trigger language plpgsql set search_path = public as $$
begin
  if exists (select 1 from public.trip_poll_votes where poll_id = old.poll_id) then raise exception 'Poll options are locked after the first vote'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists trip_poll_options_lock on public.trip_poll_options;
create trigger trip_poll_options_lock before update on public.trip_poll_options for each row execute procedure public.lock_voted_poll_options();

create or replace function public.validate_poll_lifecycle()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and exists (select 1 from public.trip_poll_votes where poll_id = old.id)
    and (new.question is distinct from old.question or new.kind is distinct from old.kind or new.selection_mode is distinct from old.selection_mode) then
    raise exception 'Poll definition is locked after the first vote';
  end if;
  if tg_op = 'UPDATE' and old.status = 'closed' and new.status = 'open' and not public.is_trip_manager(old.trip_id) then
    raise exception 'Only trip managers can reopen a poll';
  end if;
  if tg_op = 'DELETE' and exists (select 1 from public.trip_poll_votes where poll_id = old.id) and not public.is_trip_manager(old.trip_id) then
    raise exception 'Only trip managers can delete a poll that has votes';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists trip_polls_validate_lifecycle on public.trip_polls;
create trigger trip_polls_validate_lifecycle before update or delete on public.trip_polls for each row execute procedure public.validate_poll_lifecycle();

create or replace function public.delete_target_comments()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.trip_comments
  where target_type = tg_argv[0] and target_id = old.id;
  return old;
end;
$$;
drop trigger if exists activities_delete_comments on public.activities;
create trigger activities_delete_comments after delete on public.activities for each row execute procedure public.delete_target_comments('activity');
drop trigger if exists expenses_delete_comments on public.expenses;
create trigger expenses_delete_comments after delete on public.expenses for each row execute procedure public.delete_target_comments('expense');
drop trigger if exists saved_places_delete_comments on public.saved_places;
create trigger saved_places_delete_comments after delete on public.saved_places for each row execute procedure public.delete_target_comments('place');
drop trigger if exists photos_delete_comments on public.photos;
create trigger photos_delete_comments after delete on public.photos for each row execute procedure public.delete_target_comments('photo');
drop trigger if exists trip_tasks_delete_comments on public.trip_tasks;
create trigger trip_tasks_delete_comments after delete on public.trip_tasks for each row execute procedure public.delete_target_comments('task');
drop trigger if exists trip_polls_delete_comments on public.trip_polls;
create trigger trip_polls_delete_comments after delete on public.trip_polls for each row execute procedure public.delete_target_comments('poll');

create or replace function public.notify_collaboration_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare member_id uuid; parent_author uuid;
begin
  if tg_table_name = 'trip_tasks' and new.assignee_id is not null and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    insert into public.trip_notifications (trip_id, recipient_id, actor_id, type, event_key, title, message, entity_type, entity_id)
    values (new.trip_id, new.assignee_id, auth.uid(), 'task_assigned', 'task:' || new.id || ':assignee:' || new.assignee_id, 'Bạn được giao một nhiệm vụ', new.title, 'task', new.id)
    on conflict (event_key) do nothing;
  elsif tg_table_name = 'trip_comments' and tg_op = 'INSERT' then
    foreach member_id in array new.mentioned_user_ids loop
      if member_id <> new.author_id then insert into public.trip_notifications (trip_id, recipient_id, actor_id, type, event_key, title, message, entity_type, entity_id)
        values (new.trip_id, member_id, new.author_id, 'mention', 'comment:' || new.id || ':mention:' || member_id, 'Bạn được nhắc tên', left(new.body, 200), new.target_type, new.target_id) on conflict (event_key) do nothing; end if;
    end loop;
    if new.parent_id is not null then select author_id into parent_author from public.trip_comments where id = new.parent_id;
      if parent_author is not null and parent_author <> new.author_id then insert into public.trip_notifications (trip_id, recipient_id, actor_id, type, event_key, title, message, entity_type, entity_id)
        values (new.trip_id, parent_author, new.author_id, 'comment_reply', 'comment:' || new.id || ':reply:' || parent_author, 'Có phản hồi bình luận của bạn', left(new.body, 200), new.target_type, new.target_id) on conflict (event_key) do nothing; end if;
    end if;
  elsif tg_table_name = 'trip_polls' and tg_op = 'UPDATE' and old.status = 'open' and new.status = 'closed' then
    for member_id in select distinct user_id from public.trip_poll_votes where poll_id = new.id loop
      insert into public.trip_notifications (trip_id, recipient_id, actor_id, type, event_key, title, message, entity_type, entity_id)
      values (new.trip_id, member_id, auth.uid(), 'poll_closed', 'poll:' || new.id || ':closed:' || member_id, 'Bình chọn đã đóng', new.question, 'poll', new.id) on conflict (event_key) do nothing;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trip_tasks_notify on public.trip_tasks;
create trigger trip_tasks_notify after insert or update of assignee_id on public.trip_tasks for each row execute procedure public.notify_collaboration_event();
drop trigger if exists trip_comments_notify on public.trip_comments;
create trigger trip_comments_notify after insert on public.trip_comments for each row execute procedure public.notify_collaboration_event();
drop trigger if exists trip_polls_notify on public.trip_polls;
create trigger trip_polls_notify after update of status on public.trip_polls for each row execute procedure public.notify_collaboration_event();

alter table public.trip_collaboration_settings enable row level security;
alter table public.trip_tasks enable row level security;
alter table public.trip_polls enable row level security;
alter table public.trip_poll_options enable row level security;
alter table public.trip_poll_votes enable row level security;
alter table public.trip_comments enable row level security;
alter table public.trip_notifications enable row level security;
alter table public.trip_public_shares enable row level security;

drop policy if exists "Members read collaboration settings" on public.trip_collaboration_settings;
drop policy if exists "Managers manage collaboration settings" on public.trip_collaboration_settings;
drop policy if exists "Members read tasks" on public.trip_tasks;
drop policy if exists "Editors create tasks" on public.trip_tasks;
drop policy if exists "Editors update tasks" on public.trip_tasks;
drop policy if exists "Editors delete tasks" on public.trip_tasks;
drop policy if exists "Members read polls" on public.trip_polls;
drop policy if exists "Editors create polls" on public.trip_polls;
drop policy if exists "Editors update polls" on public.trip_polls;
drop policy if exists "Managers or creators delete polls" on public.trip_polls;
drop policy if exists "Members read poll options" on public.trip_poll_options;
drop policy if exists "Editors manage poll options" on public.trip_poll_options;
drop policy if exists "Editors create poll options" on public.trip_poll_options;
drop policy if exists "Editors update poll options" on public.trip_poll_options;
drop policy if exists "Editors delete unused poll options" on public.trip_poll_options;
drop policy if exists "Members read poll votes" on public.trip_poll_votes;
drop policy if exists "Eligible members create votes" on public.trip_poll_votes;
drop policy if exists "Users delete own votes" on public.trip_poll_votes;
drop policy if exists "Members read comments" on public.trip_comments;
drop policy if exists "Eligible members create comments" on public.trip_comments;
drop policy if exists "Authors or managers update comments" on public.trip_comments;
drop policy if exists "Recipients read notifications" on public.trip_notifications;
drop policy if exists "Recipients update notifications" on public.trip_notifications;
drop policy if exists "Managers manage public shares" on public.trip_public_shares;
drop policy if exists "Managers read public shares" on public.trip_public_shares;
drop policy if exists "Managers create public shares" on public.trip_public_shares;
drop policy if exists "Managers update public shares" on public.trip_public_shares;
drop policy if exists "Managers delete public shares" on public.trip_public_shares;

create policy "Members read collaboration settings" on public.trip_collaboration_settings for select using (public.is_trip_member(trip_id));
create policy "Managers manage collaboration settings" on public.trip_collaboration_settings for all using (public.is_trip_manager(trip_id)) with check (public.is_trip_manager(trip_id));
create policy "Members read tasks" on public.trip_tasks for select using (public.is_trip_member(trip_id));
create policy "Editors create tasks" on public.trip_tasks for insert with check (public.is_trip_editor(trip_id) and created_by = auth.uid());
create policy "Editors update tasks" on public.trip_tasks for update using (public.is_trip_editor(trip_id)) with check (public.is_trip_editor(trip_id));
create policy "Editors delete tasks" on public.trip_tasks for delete using (public.is_trip_editor(trip_id));

create or replace function public.update_own_assigned_task_status(p_task_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare selected_task public.trip_tasks;
begin
  if p_status not in ('todo','in_progress','done') then raise exception 'Invalid task status'; end if;
  select * into selected_task from public.trip_tasks where id = p_task_id;
  if selected_task.assignee_id is distinct from auth.uid() or not public.is_trip_member(selected_task.trip_id) or not exists (select 1 from public.trip_collaboration_settings s where s.trip_id = selected_task.trip_id and s.viewer_can_update_assigned_tasks) then raise exception 'Not allowed'; end if;
  update public.trip_tasks set status = p_status, completed_by = case when p_status = 'done' then auth.uid() else null end, completed_at = case when p_status = 'done' then timezone('utc', now()) else null end where id = p_task_id;
end;
$$;
grant execute on function public.update_own_assigned_task_status(uuid, text) to authenticated;

create policy "Members read polls" on public.trip_polls for select using (public.is_trip_member(trip_id));
create policy "Editors create polls" on public.trip_polls for insert with check (public.is_trip_editor(trip_id) and created_by = auth.uid());
create policy "Editors update polls" on public.trip_polls for update using (public.is_trip_editor(trip_id)) with check (public.is_trip_editor(trip_id));
create policy "Managers or creators delete polls" on public.trip_polls for delete using (public.is_trip_manager(trip_id) or created_by = auth.uid());
create policy "Members read poll options" on public.trip_poll_options for select using (public.is_trip_member(trip_id));
create policy "Editors create poll options" on public.trip_poll_options for insert with check (public.is_trip_editor(trip_id));
create policy "Editors update poll options" on public.trip_poll_options for update using (public.is_trip_editor(trip_id)) with check (public.is_trip_editor(trip_id));
create policy "Editors delete unused poll options" on public.trip_poll_options for delete using (public.is_trip_editor(trip_id) and not exists (select 1 from public.trip_poll_votes vote where vote.option_id = trip_poll_options.id));
create policy "Members read poll votes" on public.trip_poll_votes for select using (public.is_trip_member(trip_id));
create policy "Eligible members create votes" on public.trip_poll_votes for insert with check (user_id = auth.uid() and public.is_trip_member(trip_id) and (public.is_trip_editor(trip_id) or exists (select 1 from public.trip_collaboration_settings s where s.trip_id = trip_poll_votes.trip_id and s.viewer_can_vote)));
create policy "Users delete own votes" on public.trip_poll_votes for delete using (user_id = auth.uid() and public.is_trip_member(trip_id));
create policy "Members read comments" on public.trip_comments for select using (public.is_trip_member(trip_id));
create policy "Eligible members create comments" on public.trip_comments for insert with check (author_id = auth.uid() and public.is_trip_member(trip_id) and (public.is_trip_editor(trip_id) or exists (select 1 from public.trip_collaboration_settings s where s.trip_id = trip_comments.trip_id and s.viewer_can_comment)));
create policy "Authors or managers update comments" on public.trip_comments for update using (author_id = auth.uid() or public.is_trip_manager(trip_id)) with check (author_id = auth.uid() or public.is_trip_manager(trip_id));
create policy "Recipients read notifications" on public.trip_notifications for select using (recipient_id = auth.uid());
create policy "Recipients update notifications" on public.trip_notifications for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy "Managers read public shares" on public.trip_public_shares for select using (public.is_trip_manager(trip_id));
create policy "Managers create public shares" on public.trip_public_shares for insert with check (public.is_trip_manager(trip_id) and created_by = auth.uid());
create policy "Managers update public shares" on public.trip_public_shares for update using (public.is_trip_manager(trip_id)) with check (public.is_trip_manager(trip_id));
create policy "Managers delete public shares" on public.trip_public_shares for delete using (public.is_trip_manager(trip_id));

create or replace function public.get_public_trip_share(p_token text)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare selected_share public.trip_public_shares; result jsonb;
begin
  select * into selected_share from public.trip_public_shares where token_hash = encode(digest(p_token, 'sha256'), 'hex') and revoked_at is null and expires_at > timezone('utc', now());
  if selected_share.id is null then return null; end if;
  select jsonb_build_object(
    'shareId', selected_share.id,
    'expiresAt', selected_share.expires_at,
    'scopes', selected_share.scopes,
    'trip', jsonb_build_object('id', t.id, 'title', t.title, 'location', t.location, 'startDate', t.start_date, 'endDate', t.end_date, 'image', t.image, 'themeColor', t.theme_color),
    'activities', case when 'itinerary' = any(selected_share.scopes) then coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'date', a.date, 'time', a.time, 'title', a.title, 'location', a.location, 'note', a.note, 'type', a.type, 'durationMinutes', a.duration_minutes) order by a.date, a.time) from public.activities a where a.trip_id = t.id), '[]'::jsonb) else '[]'::jsonb end,
    'places', case when 'places' = any(selected_share.scopes) then coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'type', p.type, 'address', p.address, 'rating', p.rating, 'note', p.note) order by p.name) from public.saved_places p where p.trip_id = t.id), '[]'::jsonb) else '[]'::jsonb end,
    'photos', case when 'photos' = any(selected_share.scopes) then coalesce((select jsonb_agg(jsonb_build_object('id', ph.id, 'url', ph.url, 'album', ph.album, 'takenOn', ph.taken_on, 'place', ph.place) order by coalesce(ph.taken_on::timestamptz, ph.created_at) desc) from public.photos ph where ph.trip_id = t.id and coalesce(ph.item_type, 'photo') <> 'journal'), '[]'::jsonb) else '[]'::jsonb end
  ) into result from public.trips t where t.id = selected_share.trip_id;
  return result;
end;
$$;
revoke all on function public.get_public_trip_share(text) from public;
grant execute on function public.get_public_trip_share(text) to anon, authenticated;
