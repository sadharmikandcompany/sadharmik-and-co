import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { canLoginAsRider, signRiderToken } from "@/lib/riderAuth";

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  let body: { phone?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const phone = String(body.phone ?? "").trim();
  const password = String(body.password ?? "");
  if (!phone || !password) {
    return jsonError("Phone and password are required.", 400);
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  const passwordMatches = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!canLoginAsRider(user, passwordMatches)) {
    return jsonError("Invalid phone or password.", 401);
  }

  const token = signRiderToken(user!.id);
  return NextResponse.json({ ok: true, token });
}
