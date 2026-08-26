import crypto from "crypto";

export const SESSION_COOKIE_NAME = "sdhmk_crm_session";

const SESSION_VALUE = "authenticated";

function getSecret(): string {
  return process.env.CRM_SESSION_SECRET || "insecure-dev-secret";
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function checkPassword(input: string): boolean {
  const expected = process.env.CRM_PASSWORD || "";
  if (!expected || !input) return false;
  return timingSafeStringEqual(input, expected);
}

export function signSession(): string {
  const hmac = crypto.createHmac("sha256", getSecret()).update(SESSION_VALUE).digest("hex");
  return `${SESSION_VALUE}.${hmac}`;
}

export function verifySession(token: string | undefined): boolean {
  if (!token) return false;
  const [value, hmac] = token.split(".");
  if (!value || !hmac || value !== SESSION_VALUE) return false;
  const expected = crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
  return timingSafeStringEqual(expected, hmac);
}
