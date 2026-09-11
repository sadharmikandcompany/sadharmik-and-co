export interface PriceTiers {
  price: number;
  mandirPrice: number | null;
  shopPrice: number | null;
}

export interface CustomerTierFlags {
  isMandir: boolean;
  isShop: boolean;
}

// Picks which of a product's prices applies to a given customer. Mandir
// takes priority over Shop if a customer is somehow flagged as both — the
// two aren't expected to co-occur in practice, but the tie-break has to be
// deterministic. A tier whose price hasn't been set for this product (null)
// falls back to the regular price rather than charging nothing.
export function effectivePrice(product: PriceTiers, customer: CustomerTierFlags | null | undefined): number {
  if (customer?.isMandir && product.mandirPrice != null) return product.mandirPrice;
  if (customer?.isShop && product.shopPrice != null) return product.shopPrice;
  return product.price;
}
