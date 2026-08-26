import { describe, expect, it } from "vitest";
import { generateOrderNumber } from "./order-number";

describe("generateOrderNumber", () => {
  it("formats as SDK + YYMMDD + 3-digit sequence", () => {
    expect(generateOrderNumber(new Date(2026, 7, 26), 1)).toBe("SDK260826001");
  });

  it("pads sequence numbers past 9", () => {
    expect(generateOrderNumber(new Date(2026, 7, 26), 42)).toBe("SDK260826042");
  });

  it("pads single-digit months and days", () => {
    expect(generateOrderNumber(new Date(2026, 0, 5), 1)).toBe("SDK260105001");
  });
});
