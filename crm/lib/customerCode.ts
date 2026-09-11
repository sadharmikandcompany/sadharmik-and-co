export interface CustomerCodeInfo {
  vipNumber?: number | null;
  isMandir?: boolean;
  mandirNumber?: number | null;
  isShop?: boolean;
  shopNumber?: number | null;
}

// A customer's printed/searchable code — Mandir and Shop customers get
// their own numbering (ManXXX / ShopXXX) instead of the generic Sd code
// every customer is otherwise assigned. Mandir takes priority over Shop
// if a customer is somehow flagged as both, matching the same tie-break
// used for price tiers (lib/pricing.ts) — the two aren't expected to
// co-occur. A tier flag with no number set for it falls back to the Sd
// code rather than showing nothing.
export function customerDisplayCode(customer: CustomerCodeInfo): string {
  if (customer.isMandir && customer.mandirNumber != null) return `Man${String(customer.mandirNumber).padStart(3, "0")}`;
  if (customer.isShop && customer.shopNumber != null) return `Shop${String(customer.shopNumber).padStart(3, "0")}`;
  return customer.vipNumber != null ? `Sd ${String(customer.vipNumber).padStart(4, "0")}` : "";
}

// Lowercase, no separators — e.g. "sd0001", "man001", "shop001". Used to
// match a typed search query against a customer's code.
export function customerSearchCode(customer: CustomerCodeInfo): string {
  if (customer.isMandir && customer.mandirNumber != null) return `man${String(customer.mandirNumber).padStart(3, "0")}`;
  if (customer.isShop && customer.shopNumber != null) return `shop${String(customer.shopNumber).padStart(3, "0")}`;
  return customer.vipNumber != null ? `sd${String(customer.vipNumber).padStart(4, "0")}` : "";
}

// What kind of code is being shown — "VIP #", "Mandir #", "Shop #".
export function customerCodeLabel(customer: CustomerCodeInfo): string {
  if (customer.isMandir && customer.mandirNumber != null) return "Mandir #";
  if (customer.isShop && customer.shopNumber != null) return "Shop #";
  return "VIP #";
}
