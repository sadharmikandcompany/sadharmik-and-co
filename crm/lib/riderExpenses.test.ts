import { describe, expect, it } from "vitest";
import { periodStartDate } from "./riderExpenses";

describe("periodStartDate", () => {
  const now = new Date("2026-09-10T15:30:00.000Z");

  it("today starts at local midnight of the given day", () => {
    const start = periodStartDate("today", now);
    expect(start.getDate()).toBe(now.getDate());
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
  });

  it("week starts 7 days before now", () => {
    const start = periodStartDate("week", now);
    const diffDays = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(6.9);
    expect(diffDays).toBeLessThanOrEqual(7.1);
  });

  it("month starts on the 1st of the current month", () => {
    const start = periodStartDate("month", now);
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(now.getMonth());
  });
});
