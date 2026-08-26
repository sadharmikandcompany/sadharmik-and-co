import { beforeEach, describe, expect, it } from "vitest";
import { checkCredentials, signSession, verifySession } from "./auth";

describe("checkCredentials", () => {
  beforeEach(() => {
    process.env.CRM_USERNAME = "admin";
    process.env.CRM_PASSWORD = "sadharmik2026";
  });

  it("accepts the correct username and password", () => {
    expect(checkCredentials("admin", "sadharmik2026")).toBe(true);
  });

  it("rejects a correct password with the wrong username", () => {
    expect(checkCredentials("someone-else", "sadharmik2026")).toBe(false);
  });

  it("rejects a correct username with the wrong password", () => {
    expect(checkCredentials("admin", "wrong-password")).toBe(false);
  });

  it("rejects when both are wrong", () => {
    expect(checkCredentials("someone-else", "wrong-password")).toBe(false);
  });

  it("rejects an empty username", () => {
    expect(checkCredentials("", "sadharmik2026")).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(checkCredentials("admin", "")).toBe(false);
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
