-- Allow trip-specific custom categories/types entered from the app.
alter table public.activities drop constraint if exists activities_type_check;
alter table public.saved_places drop constraint if exists saved_places_type_check;
alter table public.packing_items drop constraint if exists packing_items_category_check;
