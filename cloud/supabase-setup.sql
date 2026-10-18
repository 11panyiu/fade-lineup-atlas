-- Run once in your Supabase SQL Editor. No service_role key belongs in this website.
-- Private snapshots are stored in Supabase Storage, not in GitHub or public URLs.
create table if not exists public.fade_cloud_maps (
  user_id uuid not null references auth.users(id) on delete cascade,
  map_id text not null check (map_id ~ '^[a-z0-9_-]{1,60}$'),
  revision uuid not null,
  object_path text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, map_id)
);
alter table public.fade_cloud_maps enable row level security;
drop policy if exists "fade_maps_read_own" on public.fade_cloud_maps;
create policy "fade_maps_read_own" on public.fade_cloud_maps for select
  to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "fade_maps_insert_own" on public.fade_cloud_maps;
create policy "fade_maps_insert_own" on public.fade_cloud_maps for insert
  to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "fade_maps_update_own" on public.fade_cloud_maps;
create policy "fade_maps_update_own" on public.fade_cloud_maps for update
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
-- Deletion is intentionally not exposed through the web client.
grant select, insert, update on public.fade_cloud_maps to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fade-lineups-private','fade-lineups-private',false,52428800,ARRAY['application/json'])
on conflict (id) do update set
  public=false, file_size_limit=52428800, allowed_mime_types=ARRAY['application/json'];

drop policy if exists "fade_storage_read_own" on storage.objects;
create policy "fade_storage_read_own" on storage.objects for select
  to authenticated
  using (bucket_id='fade-lineups-private'
    and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "fade_storage_upload_own" on storage.objects;
create policy "fade_storage_upload_own" on storage.objects for insert
  to authenticated
  with check (bucket_id='fade-lineups-private'
    and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Snapshot filenames are unique. Updates and deletes are intentionally forbidden.

drop policy if exists "fade_storage_delete_own" on storage.objects;
create policy "fade_storage_delete_own" on storage.objects for delete
  to authenticated
  using (bucket_id='fade-lineups-private'
    and (storage.foldername(name))[1] = (select auth.uid())::text);
