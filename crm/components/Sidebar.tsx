"use client";

import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/app/(app)/actions";
import LineSidebar from "./LineSidebar";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/customers", label: "Customers" },
  { href: "/products", label: "Products" },
  { href: "/pos", label: "POS" },
  { href: "/sales/new", label: "New Order" },
  { href: "/sales", label: "Sales" },
  { href: "/purchases", label: "Purchases" },
  { href: "/vendors", label: "Vendors" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  // Longest-matching-prefix wins, so /sales/new (an exact link) beats the
  // broader /sales match when both are prefixes of the current path.
  const activeIndex = LINKS.reduce<{ index: number; length: number }>(
    (best, link, index) => {
      if (pathname.startsWith(link.href) && link.href.length > best.length) {
        return { index, length: link.href.length };
      }
      return best;
    },
    { index: -1, length: -1 }
  ).index;

  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-none flex-col justify-between border-r border-royal-soft/15 bg-royal-deep px-5 py-8 text-cream">
      <div>
        <p className="font-serif text-xl text-ivory">Sadharmik & Co.</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-gold">CRM</p>
        <div className="mt-10">
          <LineSidebar
            items={LINKS.map((l) => l.label)}
            accentColor="#E7CB84"
            textColor="#cfc7ab"
            markerColor="#3f5580"
            showIndex
            showMarker
            proximityRadius={90}
            maxShift={18}
            falloff="smooth"
            markerLength={28}
            markerGap={8}
            tickScale={0.5}
            scaleTick
            itemGap={16}
            fontSize={0.95}
            smoothing={100}
            defaultActive={activeIndex === -1 ? null : activeIndex}
            onItemClick={(index) => router.push(LINKS[index].href)}
          />
        </div>
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
