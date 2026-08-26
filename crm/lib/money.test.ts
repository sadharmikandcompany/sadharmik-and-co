import { describe, expect, it } from "vitest";
import { computeDeliveryCharge, computeOrderTotals, computePurchaseTotal, computeSubtotal } from "./money";

describe("computeDeliveryCharge", () => {
  it("charges ₹70 for 1 pack (500g)", () => {
    expect(computeDeliveryCharge(1)).toBe(70);
  });

  it("is free at exactly 2 packs (1000g)", () => {
    expect(computeDeliveryCharge(2)).toBe(0);
  });

  it("is free above 2 packs", () => {
    expect(computeDeliveryCharge(5)).toBe(0);
  });

  it("charges ₹70 for 0 packs", () => {
    expect(computeDeliveryCharge(0)).toBe(70);
  });
});

describe("computeSubtotal", () => {
  it("sums quantity × unitPrice across lines", () => {
    expect(
      computeSubtotal([
        { quantity: 2, unitPrice: 160 },
        { quantity: 1, unitPrice: 160 },
      ])
    ).toBe(480);
  });

  it("is 0 for no lines", () => {
    expect(computeSubtotal([])).toBe(0);
  });
});

describe("computeOrderTotals", () => {
  it("combines packs, subtotal, delivery and total", () => {
    const result = computeOrderTotals([{ quantity: 1, unitPrice: 160 }]);
    expect(result).toEqual({ packs: 1, subtotal: 160, delivery: 70, total: 230 });
  });

  it("gives free delivery at 2 packs", () => {
    const result = computeOrderTotals([{ quantity: 2, unitPrice: 160 }]);
    expect(result).toEqual({ packs: 2, subtotal: 320, delivery: 0, total: 320 });
  });
});

describe("computePurchaseTotal", () => {
  it("sums quantity × rate across purchase lines", () => {
    expect(
      computePurchaseTotal([
        { quantity: 25, rate: 40 },
        { quantity: 5, rate: 300 },
      ])
    ).toBe(2500);
  });
});
