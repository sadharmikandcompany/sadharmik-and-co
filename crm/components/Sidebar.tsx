import Link from "next/link";
import { logout } from "@/app/(app)/actions";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/customers", label: "Customers" },
  { href: "/products", label: "Products" },
  { href: "/pos", label: "POS" },
  { href: "/sales/new", label: "New Order" },
  { href: "/sales", label: "Sales" },
  { href: "/purchases", label: "Purchases" },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-60 flex-none flex-col justify-between border-r border-royal-soft/15 bg-royal-deep px-5 py-8 text-cream">
      <div>
        <p className="font-serif text-xl text-ivory">Sadharmik & Co.</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-gold">CRM</p>
        <nav className="mt-10 flex flex-col gap-1">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm text-cream/80 transition-colors hover:bg-white/5 hover:text-gold-2"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <form action={logout}>
        <button
          type="submit"
          className="w-full rounded-lg border border-royal-soft/40 px-3 py-2 text-left text-sm text-cream/70 hover:border-gold hover:text-gold-2"
        >
          Log out
        </button>
      </form>
    </aside>
  );
}
