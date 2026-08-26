import { beforeEach, describe, expect, it } from "vitest";
import { checkPassword, signSession, verifySession } from "./auth";

describe("checkPassword", () => {
  beforeEach(() => {
    process.env.CRM_PASSWORD = "sadharmik2026";
  });

  it("accepts the correct password", () => {
    expect(checkPassword("sadharmik2026")).toBe(true);
  });

  it("rejects an incorrect password", () => {
    expect(checkPassword("wrong-password")).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(checkPassword("")).toBe(false);
  });
});

describe("signSession / verifySession", () => {
  beforeEach(() => {
    process.env.CRM_SESSION_SECRET = "test-secret";
  });

  it("verifies a token it just signed", () => {
    const token = signSession();
    expect(verifySession(token)).toBe(true);
  });

  it("rejects a tampered token", () => {
    const token = signSession();
    expect(verifySession(token + "x")).toBe(false);
  });

  it("rejects an undefined token", () => {
    expect(verifySession(undefined)).toBe(false);
  });

  it("rejects a token signed with a different secret", () => {
    const token = signSession();
    process.env.CRM_SESSION_SECRET = "a-different-secret";
    expect(verifySession(token)).toBe(false);
  });
});
