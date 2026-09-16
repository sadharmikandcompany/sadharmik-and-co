-- Remembers which catalog product a given Tally invoice line description
-- refers to, so the "Order from Factory" Tally-PDF auto-fill can resolve
-- items exactly instead of re-guessing every time (Tally's short codes like
-- "08 COW GHEE 15 LTR BUK" are ambiguous against multiple catalog SKUs that
-- share the same type + size, e.g. Bottle vs Tin vs Bottle Mandir).
create table if not exists public.tally_product_mappings (
  id uuid primary key default gen_random_uuid(),
  tally_description text not null unique, -- normalized: trimmed, collapsed whitespace, uppercased
  product_id uuid not null references public.products(id) on delete cascade,
  hsn_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tally_product_mappings_product_id
  on public.tally_product_mappings(product_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tally_product_mappings_updated_at on public.tally_product_mappings;
create trigger trg_tally_product_mappings_updated_at
before update on public.tally_product_mappings
for each row execute function public.set_updated_at();

comment on table public.tally_product_mappings is
  'Learned mapping from a Tally sales-invoice line description to the catalog product it refers to, used by the Order from Factory Tally-PDF auto-fill feature';
comment on column public.tally_product_mappings.tally_description is
  'Normalized (trim + collapse whitespace + uppercase) Tally item description, used as the lookup key';

alter table public.tally_product_mappings disable row level security;
