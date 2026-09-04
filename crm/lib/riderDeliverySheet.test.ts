import { describe, expect, it } from "vitest";
import { summarizeDeliverySheet } from "./riderDeliverySheet";

describe("summarizeDeliverySheet", () => {
  it("sums orders, items, amount, and COD-only amount", () => {
    const result = summarizeDeliverySheet([
      { total: 500, paymentMethod: "CASH", items: [{ quantity: 2 }, { quantity: 1 }] },
      { total: 300, paymentMethod: "UPI", items: [{ quantity: 1 }] },
      { total: 200, paymentMethod: "PENDING", items: [{ quantity: 3 }] },
    ]);
    expect(result).toEqual({ totalOrders: 3, totalItems: 7, totalAmount: 1000, totalCod: 700 });
  });

  it("handles an empty list", () => {
    expect(summarizeDeliverySheet([])).toEqual({ totalOrders: 0, totalItems: 0, totalAmount: 0, totalCod: 0 });
  });
});
