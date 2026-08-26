"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState | null, FormData>(login, null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-royal-deep px-4">
      <form action={formAction} className="w-full max-w-sm rounded-2xl border border-royal-soft/30 bg-royal p-8">
        <p className="font-serif text-2xl text-ivory">Sadharmik & Co.</p>
        <p className="mt-1 text-xs uppercase tracking-[0.3em] text-gold">CRM login</p>
        <input
          type="password"
          name="password"
          placeholder="Password"
          required
          className="mt-8 w-full rounded-xl border border-royal-soft/40 bg-white/5 px-4 py-2.5 text-sm text-cream outline-none focus:border-gold"
        />
        {state?.error && <p className="mt-3 text-sm text-red-300">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-5 w-full rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-royal-deep disabled:opacity-60"
        >
          {pending ? "Checking…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
