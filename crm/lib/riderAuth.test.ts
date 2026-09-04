import { beforeEach, describe, expect, it, vi } from "vitest";
import { canLoginAsRider, signRiderToken, verifyRiderToken } from "./riderAuth";

describe("signRiderToken / verifyRiderToken", () => {
  beforeEach(() => {
    process.env.RIDER_TOKEN_SECRET = "test-secret";
  });

  it("verifies a token it just signed, returning the user id", () => {
    const token = signRiderToken("user_123");
    expect(verifyRiderToken(token)).toBe("user_123");
  });

  it("rejects a tampered token", () => {
    const token = signRiderToken("user_123");
    const lastChar = token.slice(-1);
    const replacement = lastChar === "0" ? "1" : "0";
    expect(verifyRiderToken(token.slice(0, -1) + replacement)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = signRiderToken("user_123");
    process.env.RIDER_TOKEN_SECRET = "a-different-secret";
    expect(verifyRiderToken(token)).toBeNull();
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    const token = signRiderToken("user_123");
    vi.advanceTimersByTime(31 * 24 * 60 * 60 * 1000);
    expect(verifyRiderToken(token)).toBeNull();
    vi.useRealTimers();
  });

  it("rejects a malformed token", () => {
    expect(verifyRiderToken("not-a-real-token")).toBeNull();
  });

  it("rejects undefined and null", () => {
    expect(verifyRiderToken(undefined)).toBeNull();
    expect(verifyRiderToken(null)).toBeNull();
  });
});

describe("canLoginAsRider", () => {
  it("allows an active delivery partner with a matching password", () => {
    expect(canLoginAsRider({ isActive: true, role: "DELIVERY_PARTNER" }, true)).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(canLoginAsRider({ isActive: true, role: "DELIVERY_PARTNER" }, false)).toBe(false);
  });

  it("rejects an inactive user", () => {
    expect(canLoginAsRider({ isActive: false, role: "DELIVERY_PARTNER" }, true)).toBe(false);
  });

  it("rejects a non-delivery-partner role", () => {
    expect(canLoginAsRider({ isActive: true, role: "STAFF" }, true)).toBe(false);
  });

  it("rejects a missing user", () => {
    expect(canLoginAsRider(null, true)).toBe(false);
  });
});
