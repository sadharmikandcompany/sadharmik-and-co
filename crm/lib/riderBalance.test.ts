import { describe, expect, it } from "vitest";
import { isUnsettled } from "./riderBalance";

describe("isUnsettled", () => {
  it("counts a delivered, unsettled cash order", () => {
    expect(isUnsettled({ status: "DELIVERED", paymentMethod: "CASH", settledAt: null })).toBe(true);
  });

  it("counts a delivered, unsettled pending-payment order", () => {
    expect(isUnsettled({ status: "DELIVERED", paymentMethod: "PENDING", settledAt: null })).toBe(true);
  });

  it("excludes an order already settled", () => {
    expect(isUnsettled({ status: "DELIVERED", paymentMethod: "CASH", settledAt: new Date() })).toBe(false);
  });

  it("excludes an order that isn't delivered yet", () => {
    expect(isUnsettled({ status: "PICKED_UP", paymentMethod: "CASH", settledAt: null })).toBe(false);
  });

  it("excludes a delivered order paid by UPI/card (already reconciled electronically)", () => {
    expect(isUnsettled({ status: "DELIVERED", paymentMethod: "UPI", settledAt: null })).toBe(false);
    expect(isUnsettled({ status: "DELIVERED", paymentMethod: "CARD", settledAt: null })).toBe(false);
  });
});
