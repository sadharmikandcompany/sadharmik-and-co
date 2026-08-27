export const PACK_WEIGHT_GRAMS = 500;
export const FREE_DELIVERY_WEIGHT_GRAMS = 1000;
export const DELIVERY_CHARGE_RUPEES = 70;

export interface BillLine {
  quantity: number;
  unitPrice: number;
  gstPercentage?: number;
}

export interface OrderTotals {
  packs: number;
  subtotal: number;
  gst: number;
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

export function computeGstAmount(lines: BillLine[]): number {
  return lines.reduce((sum, line) => {
    const lineGst = Math.round((line.quantity * line.unitPrice * (line.gstPercentage ?? 0)) / 100);
    return sum + lineGst;
  }, 0);
}

export function computeOrderTotals(lines: BillLine[]): OrderTotals {
  const packs = totalPacks(lines);
  const subtotal = computeSubtotal(lines);
  const gst = computeGstAmount(lines);
  const delivery = computeDeliveryCharge(packs);
  return { packs, subtotal, gst, delivery, total: subtotal + gst + delivery };
}

export interface PurchaseLine {
  quantity: number;
  rate: number;
}

export interface PurchaseTotals {
  rates: number[];
  amounts: number[];
  total: number;
}

export function computePurchaseTotals(lines: PurchaseLine[]): PurchaseTotals {
  const rates = lines.map((line) => Math.round(line.rate));
  const amounts = lines.map((line, i) => Math.round(line.quantity * rates[i]));
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  return { rates, amounts, total };
}
