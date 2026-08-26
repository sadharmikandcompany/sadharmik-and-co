import crypto from "crypto";

export const SESSION_COOKIE_NAME = "sdhmk_crm_session";

const SESSION_VALUE = "authenticated";

function getSecret(): string {
  const secret = process.env.CRM_SESSION_SECRET;
  if (!secret) {
    throw new Error("CRM_SESSION_SECRET environment variable is not set.");
  }
  return secret;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function checkCredentials(username: string, password: string): boolean {
  const expectedUsername = process.env.CRM_USERNAME || "";
  const expectedPassword = process.env.CRM_PASSWORD || "";
  if (!expectedUsername || !expectedPassword || !username || !password) return false;
  const usernameOk = timingSafeStringEqual(username, expectedUsername);
  const passwordOk = timingSafeStringEqual(password, expectedPassword);
  return usernameOk && passwordOk;
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
