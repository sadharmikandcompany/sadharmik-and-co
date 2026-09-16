-- The `documents` and `ticket-attachments` storage buckets were missing
-- entirely (created directly via the Storage API on 2026-08-25, not
-- through a migration, since bucket creation isn't DDL) — every upload to
-- either one failed instantly with "Bucket not found" (distributor/
-- delivery-partner document uploads, support ticket attachments).
--
-- Creating the buckets fixed that, but Supabase Storage has its own RLS
-- layer on storage.objects independent of any table-level RLS elsewhere in
-- this app — with no policy granting insert/select/update/delete for these
-- two buckets, every upload now fails one step later with "new row
-- violates row-level security policy" instead. Mirrors the exact policy
-- shape already working for lab-test-certificates (see
-- migrations/create_lab_tests_table.sql): public read, authenticated
-- write/update/delete.

insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('ticket-attachments', 'ticket-attachments', true)
on conflict (id) do nothing;

drop policy if exists "Public read access to documents" on storage.objects;
create policy "Public read access to documents"
on storage.objects for select
using (bucket_id = 'documents');

drop policy if exists "Authenticated upload to documents" on storage.objects;
create policy "Authenticated upload to documents"
on storage.objects for insert
to authenticated
with check (bucket_id = 'documents');

drop policy if exists "Authenticated update documents" on storage.objects;
create policy "Authenticated update documents"
on storage.objects for update
to authenticated
using (bucket_id = 'documents');

drop policy if exists "Authenticated delete documents" on storage.objects;
create policy "Authenticated delete documents"
on storage.objects for delete
to authenticated
using (bucket_id = 'documents');

drop policy if exists "Public read access to ticket-attachments" on storage.objects;
create policy "Public read access to ticket-attachments"
on storage.objects for select
using (bucket_id = 'ticket-attachments');

drop policy if exists "Authenticated upload to ticket-attachments" on storage.objects;
create policy "Authenticated upload to ticket-attachments"
on storage.objects for insert
to authenticated
with check (bucket_id = 'ticket-attachments');

drop policy if exists "Authenticated update ticket-attachments" on storage.objects;
create policy "Authenticated update ticket-attachments"
on storage.objects for update
to authenticated
using (bucket_id = 'ticket-attachments');

drop policy if exists "Authenticated delete ticket-attachments" on storage.objects;
create policy "Authenticated delete ticket-attachments"
on storage.objects for delete
to authenticated
using (bucket_id = 'ticket-attachments');
