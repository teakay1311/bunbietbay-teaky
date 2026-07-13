-- Additive migration for the unified trip workspace. Back up the database first.

alter table public.saved_places add column if not exists source_notebook_place_id uuid;
alter table public.activities add column if not exists place_id uuid;
alter table public.expenses add column if not exists activity_id uuid;
alter table public.expenses add column if not exists place_id uuid;
alter table public.photos add column if not exists activity_id uuid;
alter table public.photos add column if not exists place_id uuid;

do $migration$
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
$migration$;

create index if not exists activities_place_id_idx on public.activities (place_id);
create index if not exists expenses_activity_id_idx on public.expenses (activity_id);
create index if not exists expenses_place_id_idx on public.expenses (place_id);
create index if not exists saved_places_source_notebook_place_id_idx on public.saved_places (source_notebook_place_id);
create index if not exists photos_activity_id_idx on public.photos (activity_id);
create index if not exists photos_place_id_idx on public.photos (place_id);

create or replace function public.validate_trip_entity_links()
returns trigger
language plpgsql
set search_path = public
as $validate_links$
declare
  linked_place_id uuid := nullif(to_jsonb(new) ->> 'place_id', '')::uuid;
  linked_activity_id uuid := nullif(to_jsonb(new) ->> 'activity_id', '')::uuid;
begin
  if linked_place_id is not null and not exists (
    select 1 from public.saved_places place where place.id = linked_place_id and place.trip_id = new.trip_id
  ) then
    raise exception 'Linked place must belong to the same trip' using errcode = '23514';
  end if;
  if linked_activity_id is not null and not exists (
    select 1 from public.activities activity where activity.id = linked_activity_id and activity.trip_id = new.trip_id
  ) then
    raise exception 'Linked activity must belong to the same trip' using errcode = '23514';
  end if;
  return new;
end;
$validate_links$;

drop trigger if exists activities_validate_trip_links on public.activities;
create trigger activities_validate_trip_links before insert or update on public.activities
for each row execute procedure public.validate_trip_entity_links();

drop trigger if exists expenses_validate_trip_links on public.expenses;
create trigger expenses_validate_trip_links before insert or update on public.expenses
for each row execute procedure public.validate_trip_entity_links();

drop trigger if exists photos_validate_trip_links on public.photos;
create trigger photos_validate_trip_links before insert or update on public.photos
for each row execute procedure public.validate_trip_entity_links();

create or replace function public.add_library_place_to_trip(
  p_notebook_place_id uuid,
  p_trip_id uuid,
  p_create_activity boolean default false,
  p_date date default null,
  p_time text default '09:00'
)
returns table(saved_place_id uuid, activity_id uuid)
language plpgsql
set search_path = public
as $add_place$
declare
  source_place public.notebook_places%rowtype;
  mapped_type text;
  new_place_id uuid;
  new_activity_id uuid;
begin
  if not public.is_trip_editor(p_trip_id) then
    raise exception 'Insufficient trip permissions' using errcode = '42501';
  end if;

  select * into source_place
  from public.notebook_places
  where id = p_notebook_place_id;

  if not found then
    raise exception 'Notebook place not found or inaccessible' using errcode = 'P0002';
  end if;

  mapped_type := case
    when source_place.type = 'hotel' then 'hotel'
    when source_place.type in ('restaurant', 'cafe') then 'restaurant'
    else 'other'
  end;

  insert into public.saved_places (trip_id, name, type, phone, address, rating, note, source_notebook_place_id)
  values (p_trip_id, source_place.name, mapped_type, source_place.phone, source_place.address, source_place.rating, source_place.note, source_place.id)
  returning id into new_place_id;

  if p_create_activity then
    if p_date is null then
      raise exception 'Activity date is required' using errcode = '22023';
    end if;
    insert into public.activities (trip_id, date, time, title, location, note, type, place_id)
    values (p_trip_id, p_date, p_time, source_place.name, coalesce(source_place.address, source_place.name), coalesce(source_place.note, ''), mapped_type, new_place_id)
    returning id into new_activity_id;
  end if;

  return query select new_place_id, new_activity_id;
end;
$add_place$;

grant execute on function public.add_library_place_to_trip(uuid, uuid, boolean, date, text) to authenticated;
