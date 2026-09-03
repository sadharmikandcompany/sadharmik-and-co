import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret(): string {
  const secret = process.env.RIDER_TOKEN_SECRET;
  if (!secret) {
    throw new Error("RIDER_TOKEN_SECRET environment variable is not set.");
  }
  return secret;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function signRiderToken(userId: string): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyRiderToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresAtRaw, hmac] = parts;
  const payload = `${userId}.${expiresAtRaw}`;
  const expected = sign(payload);
  if (expected.length !== hmac.length || !timingSafeStringEqual(expected, hmac)) return null;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;
  return userId;
}

export function canLoginAsRider(
  user: { isActive: boolean; role: string } | null,
  passwordMatches: boolean
): boolean {
  return !!user && user.isActive && user.role === "DELIVERY_PARTNER" && passwordMatches;
}

export async function getAuthenticatedRider(request: Request): Promise<User | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  const userId = verifyRiderToken(token);
  if (!userId) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive || user.role !== "DELIVERY_PARTNER") return null;
  return user;
}
