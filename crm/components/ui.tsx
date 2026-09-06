import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Button({
  className = "",
  variant = "gold",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "gold" | "ghost" | "outline" }) {
  const base =
    "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed";
  const variants: Record<string, string> = {
    gold: "bg-gold text-royal-deep shadow-[0_10px_24px_-10px_rgba(201,162,75,.6)]",
    ghost: "border border-royal-soft/40 text-royal bg-transparent",
    outline: "border border-royal-soft/40 text-royal bg-white hover:bg-slate-50",
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm text-ink outline-none focus:border-gold ${className}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-royal-soft/15 bg-white p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "gold" | "warning";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-royal-soft/10 text-royal",
    gold: "bg-gold/20 text-gold-soft",
    warning: "bg-red-100 text-red-700",
  };
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-2xl border border-royal-soft/15 bg-white">
      <table className="w-full min-w-[560px] text-left text-sm">{children}</table>
    </div>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-royal-deep/60 p-4">
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-royal-soft/15 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-serif text-xl text-royal">{title}</p>
            {subtitle && <p className="mt-1 text-sm text-royal-soft">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full border border-royal-soft/30 px-2.5 py-1 text-sm text-royal-soft hover:border-gold hover:text-gold-soft"
          >
            ✕
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-widest text-gold-soft">{label}</p>
      <p className="mt-2 font-serif text-3xl text-royal">{value}</p>
      {hint && <p className="mt-1 text-xs text-royal-soft">{hint}</p>}
    </Card>
  );
}
