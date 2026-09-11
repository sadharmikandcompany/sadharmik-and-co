import { describe, expect, it } from "vitest";
import { computeDeliveryCharge, computeGstAmount, computeOrderTotals, computePurchaseTotals, computeSubtotal } from "./money";

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

describe("computeGstAmount", () => {
  it("is 0 when a line has no gstPercentage", () => {
    expect(computeGstAmount([{ quantity: 2, unitPrice: 160 }])).toBe(0);
  });

  it("is 0 when gstPercentage is explicitly 0", () => {
    expect(computeGstAmount([{ quantity: 2, unitPrice: 160, gstPercentage: 0 }])).toBe(0);
  });

  it("computes and rounds GST for a taxed line", () => {
    // 2 × ₹160 = ₹320 subtotal, 5% GST = ₹16
    expect(computeGstAmount([{ quantity: 2, unitPrice: 160, gstPercentage: 5 }])).toBe(16);
  });

  it("sums GST across multiple lines independently", () => {
    const lines = [
      { quantity: 2, unitPrice: 160, gstPercentage: 5 }, // ₹16
      { quantity: 1, unitPrice: 100, gstPercentage: 0 }, // ₹0
    ];
    expect(computeGstAmount(lines)).toBe(16);
  });
});

describe("computeOrderTotals", () => {
  it("combines packs, subtotal, gst, delivery and total", () => {
    const result = computeOrderTotals([{ quantity: 1, unitPrice: 160 }]);
    expect(result).toEqual({ packs: 1, subtotal: 160, gst: 0, delivery: 70, total: 230 });
  });

  it("gives free delivery at 2 packs", () => {
    const result = computeOrderTotals([{ quantity: 2, unitPrice: 160 }]);
    expect(result).toEqual({ packs: 2, subtotal: 320, gst: 0, delivery: 0, total: 320 });
  });

  it("adds GST into the total when a line is taxed", () => {
    const result = computeOrderTotals([{ quantity: 2, unitPrice: 160, gstPercentage: 5 }]);
    expect(result).toEqual({ packs: 2, subtotal: 320, gst: 16, delivery: 0, total: 336 });
  });

  it("uses the delivery override instead of the auto-computed charge when provided", () => {
    const result = computeOrderTotals([{ quantity: 1, unitPrice: 160 }], 25);
    expect(result).toEqual({ packs: 1, subtotal: 160, gst: 0, delivery: 25, total: 185 });
  });

  it("clamps a negative delivery override to 0", () => {
    const result = computeOrderTotals([{ quantity: 1, unitPrice: 160 }], -10);
    expect(result).toEqual({ packs: 1, subtotal: 160, gst: 0, delivery: 0, total: 160 });
  });

  it("rounds a fractional delivery override", () => {
    const result = computeOrderTotals([{ quantity: 1, unitPrice: 160 }], 25.6);
    expect(result).toEqual({ packs: 1, subtotal: 160, gst: 0, delivery: 26, total: 186 });
  });

  it("falls back to the auto-computed charge when no override is given", () => {
    const result = computeOrderTotals([{ quantity: 1, unitPrice: 160 }]);
    expect(result).toEqual({ packs: 1, subtotal: 160, gst: 0, delivery: 70, total: 230 });
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
