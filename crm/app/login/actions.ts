"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, signSession, SESSION_COOKIE_NAME } from "@/lib/auth";

export interface LoginState {
  error: string;
}

export async function login(_prevState: LoginState | null, formData: FormData): Promise<LoginState | null> {
  const password = String(formData.get("password") ?? "");

  if (!checkPassword(password)) {
    return { error: "Incorrect password." };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, signSession(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect("/dashboard");
}
