import { describe, expect, it } from "vitest";
import { computeDeliveryCharge, computeOrderTotals, computePurchaseTotals, computeSubtotal } from "./money";

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

describe("computePurchaseTotals", () => {
  it("rounds a whole-number line exactly", () => {
    expect(computePurchaseTotals([{ quantity: 10, rate: 180 }])).toEqual({
      rates: [180],
      amounts: [1800],
      total: 1800,
    });
  });

  it("rounds a fractional quantity against a whole rate", () => {
    expect(computePurchaseTotals([{ quantity: 2.5, rate: 33 }])).toEqual({
      rates: [33],
      amounts: [83],
      total: 83,
    });
  });

  it("rounds a fractional rate, then derives amount from the rounded rate", () => {
    expect(computePurchaseTotals([{ quantity: 2, rate: 33.5 }])).toEqual({
      rates: [34],
      amounts: [68],
      total: 68,
    });
  });

  it("keeps total reconciled with the sum of rounded per-line amounts", () => {
    const result = computePurchaseTotals([
      { quantity: 1.5, rate: 1 },
      { quantity: 1.5, rate: 1 },
    ]);
    expect(result).toEqual({ rates: [1, 1], amounts: [2, 2], total: 4 });
    expect(result.total).toBe(result.amounts.reduce((s, a) => s + a, 0));
  });
});
