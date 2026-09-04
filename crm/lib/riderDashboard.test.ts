import { describe, expect, it } from "vitest";
import { buildDashboardSummary } from "./riderDashboard";

describe("buildDashboardSummary", () => {
  it("assembles the summary from raw counts", () => {
    const result = buildDashboardSummary(
      { assigned: 2, pickedUp: 1, delivered: 5, failed: 1 },
      3150,
      656,
      4.8
    );
    expect(result).toEqual({
      totalAssigned: 2,
      pickedUp: 1,
      delivered: 5,
      failed: 1,
      todaysCollectionsTotal: 3150,
      totalDeliveries: 656,
      rating: 4.8,
    });
  });

  it("passes through a null rating unchanged", () => {
    const result = buildDashboardSummary({ assigned: 0, pickedUp: 0, delivered: 0, failed: 0 }, 0, 0, null);
    expect(result.rating).toBeNull();
  });
});
