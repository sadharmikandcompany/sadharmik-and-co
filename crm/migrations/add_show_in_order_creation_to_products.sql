-- Same idea as show_on_website (add_show_on_website_to_products.sql), but
-- controls the internal order-creation product picker instead of the
-- public site. A product can be active (orderable/visible generally) but
-- deliberately hidden from the "Add Product" list when creating an order —
-- e.g. a discontinued flavor still needed for historical reporting, or a
-- factory-only SKU staff shouldn't be picking for a normal customer order.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS show_in_order_creation boolean NOT NULL DEFAULT true;
