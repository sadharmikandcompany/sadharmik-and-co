-- Lab tests for products (one row per batch test)
create table if not exists public.lab_tests (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  product_name text, -- snapshot in case product is deleted or name changes
  batch_number text not null,
  sample_code text,
  test_type text not null default 'general' check (
    test_type in ('general','microbial','chemical','nutritional','heavy_metals','physical','shelf_life','other')
  ),
  lab_name text not null,
  lab_reference_no text,
  test_date date not null default current_date,
  report_date date,
  manufacturing_date date,
  expiry_date date,
  sample_quantity text,
  status text not null default 'pending' check (
    status in ('pending','in_progress','passed','failed','conditional')
  ),
  overall_result text,
  tested_by text,
  certificate_url text,
  results jsonb not null default '[]'::jsonb,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lab_tests_product_id on public.lab_tests(product_id);
create index if not exists idx_lab_tests_batch_number on public.lab_tests(batch_number);
create index if not exists idx_lab_tests_test_date on public.lab_tests(test_date desc);
create index if not exists idx_lab_tests_status on public.lab_tests(status);
create index if not exists idx_lab_tests_lab_name on public.lab_tests(lab_name);
create index if not exists idx_lab_tests_created_at on public.lab_tests(created_at desc);
create index if not exists idx_lab_tests_expiry_date on public.lab_tests(expiry_date);

-- Reuse set_updated_at() function (created with blogs migration)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_lab_tests_updated_at on public.lab_tests;
create trigger trg_lab_tests_updated_at
before update on public.lab_tests
for each row execute function public.set_updated_at();

comment on table public.lab_tests is 'Lab tests performed on product batches';
comment on column public.lab_tests.results is 'Array of {parameter, value, unit, spec_limit, status} objects';
comment on column public.lab_tests.product_name is 'Snapshot of product name at test time';

-- Storage bucket for lab test certificates
insert into storage.buckets (id, name, public)
values ('lab-test-certificates', 'lab-test-certificates', true)
on conflict (id) do nothing;

drop policy if exists "Public read access to lab-test-certificates" on storage.objects;
create policy "Public read access to lab-test-certificates"
on storage.objects for select
using (bucket_id = 'lab-test-certificates');

drop policy if exists "Authenticated upload to lab-test-certificates" on storage.objects;
create policy "Authenticated upload to lab-test-certificates"
on storage.objects for insert
to authenticated
with check (bucket_id = 'lab-test-certificates');

drop policy if exists "Authenticated update lab-test-certificates" on storage.objects;
create policy "Authenticated update lab-test-certificates"
on storage.objects for update
to authenticated
using (bucket_id = 'lab-test-certificates');

drop policy if exists "Authenticated delete lab-test-certificates" on storage.objects;
create policy "Authenticated delete lab-test-certificates"
on storage.objects for delete
to authenticated
using (bucket_id = 'lab-test-certificates');
