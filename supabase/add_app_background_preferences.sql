alter table public.user_preferences
  add column if not exists background_source text not null default 'none',
  add column if not exists background_photo_id uuid references public.photos (id) on delete set null,
  add column if not exists background_image_url text,
  add column if not exists background_provider_public_id text;

update public.user_preferences
set background_source = 'none'
where background_source not in ('none', 'library', 'upload');

do $$
begin
  alter table public.user_preferences
    add constraint user_preferences_background_source_check
    check (background_source in ('none', 'library', 'upload'));
exception
  when duplicate_object then null;
end $$;
