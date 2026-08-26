"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkCredentials, signSession, SESSION_COOKIE_NAME } from "@/lib/auth";

export interface LoginState {
  error: string;
}

export async function login(_prevState: LoginState | null, formData: FormData): Promise<LoginState | null> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!checkCredentials(username, password)) {
    return { error: "Incorrect username or password." };
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
