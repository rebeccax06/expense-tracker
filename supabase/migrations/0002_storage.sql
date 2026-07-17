-- Private storage bucket for retained import files.
-- Files are stored under a per-user prefix: {user_id}/{batch_id}/{filename}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'imports',
  'imports',
  false,
  10485760, -- 10 MB
  array[
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- RLS on storage.objects: users may only touch files under their own uid prefix.
create policy "imports_select_own"
  on storage.objects for select
  using (bucket_id = 'imports' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "imports_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'imports' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "imports_update_own"
  on storage.objects for update
  using (bucket_id = 'imports' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "imports_delete_own"
  on storage.objects for delete
  using (bucket_id = 'imports' and (storage.foldername(name))[1] = auth.uid()::text);
