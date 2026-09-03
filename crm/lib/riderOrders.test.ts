import { describe, expect, it } from "vitest";
import { canTransitionOrder, mapRiderStatusParam } from "./riderOrders";

describe("mapRiderStatusParam", () => {
  it("maps pending to OUT_FOR_DELIVERY", () => {
    expect(mapRiderStatusParam("pending")).toBe("OUT_FOR_DELIVERY");
  });

  it("maps complete to DELIVERED", () => {
    expect(mapRiderStatusParam("complete")).toBe("DELIVERED");
  });

  it("maps failed to FAILED", () => {
    expect(mapRiderStatusParam("failed")).toBe("FAILED");
  });

  it("returns null for an unknown value", () => {
    expect(mapRiderStatusParam("bogus")).toBeNull();
  });

  it("returns null for null", () => {
    expect(mapRiderStatusParam(null)).toBeNull();
  });
});

describe("canTransitionOrder", () => {
  it("allows a rider to transition their own out-for-delivery order", () => {
    const result = canTransitionOrder({ deliveryPartnerId: "rider_1", status: "OUT_FOR_DELIVERY" }, "rider_1");
    expect(result.ok).toBe(true);
  });

  it("rejects an order assigned to someone else", () => {
    const result = canTransitionOrder({ deliveryPartnerId: "rider_2", status: "OUT_FOR_DELIVERY" }, "rider_1");
    expect(result.ok).toBe(false);
  });

  it("rejects an order that isn't out for delivery", () => {
    const result = canTransitionOrder({ deliveryPartnerId: "rider_1", status: "DELIVERED" }, "rider_1");
    expect(result.ok).toBe(false);
  });

  it("rejects a missing order", () => {
    const result = canTransitionOrder(null, "rider_1");
    expect(result.ok).toBe(false);
  });
});
