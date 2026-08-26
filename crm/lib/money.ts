export const PACK_WEIGHT_GRAMS = 500;
export const FREE_DELIVERY_WEIGHT_GRAMS = 1000;
export const DELIVERY_CHARGE_RUPEES = 70;

export interface BillLine {
  quantity: number;
  unitPrice: number;
}

export interface OrderTotals {
  packs: number;
  subtotal: number;
  delivery: number;
  total: number;
}

export function totalPacks(lines: BillLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function computeDeliveryCharge(packCount: number): number {
  return packCount * PACK_WEIGHT_GRAMS >= FREE_DELIVERY_WEIGHT_GRAMS ? 0 : DELIVERY_CHARGE_RUPEES;
}

export function computeSubtotal(lines: BillLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
}

export function computeOrderTotals(lines: BillLine[]): OrderTotals {
  const packs = totalPacks(lines);
  const subtotal = computeSubtotal(lines);
  const delivery = computeDeliveryCharge(packs);
  return { packs, subtotal, delivery, total: subtotal + delivery };
}

export function computePurchaseTotal(lines: { quantity: number; rate: number }[]): number {
  return lines.reduce((sum, line) => sum + line.quantity * line.rate, 0);
}
