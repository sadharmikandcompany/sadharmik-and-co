import { describe, expect, it } from "vitest";
import { canTransitionOrder, mapRiderStatusParam } from "./riderOrders";

describe("mapRiderStatusParam", () => {
  it("maps pending to OUT_FOR_DELIVERY", () => {
    expect(mapRiderStatusParam("pending")).toBe("OUT_FOR_DELIVERY");
  });

  it("maps in_progress to PICKED_UP", () => {
    expect(mapRiderStatusParam("in_progress")).toBe("PICKED_UP");
  });

  it("maps complete to DELIVERED", () => {
    expect(mapRiderStatusParam("complete")).toBe("DELIVERED");
  });

  it("maps failed to FAILED", () => {
    expect(mapRiderStatusParam("failed")).toBe("FAILED");
  });

  it("maps rescheduled to RESCHEDULED", () => {
    expect(mapRiderStatusParam("rescheduled")).toBe("RESCHEDULED");
  });

  it("returns null for an unknown value", () => {
    expect(mapRiderStatusParam("bogus")).toBeNull();
  });

  it("returns null for null", () => {
    expect(mapRiderStatusParam(null)).toBeNull();
  });
});

describe("canTransitionOrder", () => {
  it("allows a rider to transition their own order that's in the required status", () => {
    const result = canTransitionOrder(
      { deliveryPartnerId: "rider_1", status: "OUT_FOR_DELIVERY" },
      "rider_1",
      "OUT_FOR_DELIVERY"
    );
    expect(result.ok).toBe(true);
  });

  it("rejects an order assigned to someone else", () => {
    const result = canTransitionOrder(
      { deliveryPartnerId: "rider_2", status: "OUT_FOR_DELIVERY" },
      "rider_1",
      "OUT_FOR_DELIVERY"
    );
    expect(result.ok).toBe(false);
  });

  it("rejects an order that isn't in the required status", () => {
    const result = canTransitionOrder(
      { deliveryPartnerId: "rider_1", status: "DELIVERED" },
      "rider_1",
      "OUT_FOR_DELIVERY"
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a missing order", () => {
    const result = canTransitionOrder(null, "rider_1", "OUT_FOR_DELIVERY");
    expect(result.ok).toBe(false);
  });

  it("requires PICKED_UP (not OUT_FOR_DELIVERY) when that's the required status", () => {
    const pickedUp = canTransitionOrder({ deliveryPartnerId: "rider_1", status: "PICKED_UP" }, "rider_1", "PICKED_UP");
    expect(pickedUp.ok).toBe(true);
    const stillAssigned = canTransitionOrder(
      { deliveryPartnerId: "rider_1", status: "OUT_FOR_DELIVERY" },
      "rider_1",
      "PICKED_UP"
    );
    expect(stillAssigned.ok).toBe(false);
  });
});
