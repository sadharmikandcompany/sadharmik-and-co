-- Optional free-text note per order line item (e.g. batch/packaging detail,
-- special instructions) shown as a small description box under the product
-- name on the order creation pages.
alter table public.order_items
  add column if not exists item_description text;

comment on column public.order_items.item_description is
  'Optional free-text note for this line item, entered on the order creation page';
