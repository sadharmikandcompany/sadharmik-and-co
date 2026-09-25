-- The 5 buckets the app code references (documents, blog-images, licenses,
-- ticket-attachments, product-images) were just created via the Storage API
-- as public buckets — public makes downloads work without a policy, but
-- INSERT/UPDATE/DELETE (actual uploads from the CRM, done as the logged-in
-- user, not service role) still go through RLS on storage.objects and need
-- an explicit policy. Mirrors the existing lab-test-certificates policies
-- (see migrations/create_lab_tests_table.sql) — any authenticated user can
-- manage files in these buckets, matching how the CRM itself has no
-- per-bucket access control of its own.
do $$
declare
  bucket text;
begin
  foreach bucket in array array['documents', 'blog-images', 'licenses', 'ticket-attachments', 'product-images']
  loop
    execute format('drop policy if exists "Authenticated upload to %s" on storage.objects', bucket);
    execute format(
      'create policy "Authenticated upload to %s" on storage.objects for insert to authenticated with check (bucket_id = %L)',
      bucket, bucket
    );

    execute format('drop policy if exists "Authenticated update in %s" on storage.objects', bucket);
    execute format(
      'create policy "Authenticated update in %s" on storage.objects for update to authenticated using (bucket_id = %L)',
      bucket, bucket
    );

    execute format('drop policy if exists "Authenticated delete in %s" on storage.objects', bucket);
    execute format(
      'create policy "Authenticated delete in %s" on storage.objects for delete to authenticated using (bucket_id = %L)',
      bucket, bucket
    );
  end loop;
end $$;
