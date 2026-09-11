import { describe, expect, it } from "vitest";
import { effectivePrice } from "./pricing";

const product = { price: 160, mandirPrice: null as number | null, shopPrice: null as number | null };

describe("effectivePrice", () => {
  it("uses the regular price when there is no customer", () => {
    expect(effectivePrice(product, null)).toBe(160);
    expect(effectivePrice(product, undefined)).toBe(160);
  });

  it("uses the regular price for a non-tier customer", () => {
    expect(effectivePrice(product, { isMandir: false, isShop: false })).toBe(160);
  });

  it("uses mandirPrice for a Mandir customer when it's set", () => {
    const p = { ...product, mandirPrice: 140 };
    expect(effectivePrice(p, { isMandir: true, isShop: false })).toBe(140);
  });

  it("falls back to the regular price for a Mandir customer when mandirPrice isn't set", () => {
    expect(effectivePrice(product, { isMandir: true, isShop: false })).toBe(160);
  });

  it("uses shopPrice for a Shop customer when it's set", () => {
    const p = { ...product, shopPrice: 130 };
    expect(effectivePrice(p, { isMandir: false, isShop: true })).toBe(130);
  });

  it("falls back to the regular price for a Shop customer when shopPrice isn't set", () => {
    expect(effectivePrice(product, { isMandir: false, isShop: true })).toBe(160);
  });

  it("prefers mandirPrice when a customer is flagged as both Mandir and Shop", () => {
    const p = { ...product, mandirPrice: 140, shopPrice: 130 };
    expect(effectivePrice(p, { isMandir: true, isShop: true })).toBe(140);
  });
});
