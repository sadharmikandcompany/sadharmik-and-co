"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { logout } from "@/app/(app)/actions";
import LineSidebar from "./LineSidebar";

interface NavLink {
  href: string;
  label: string;
}

interface NavGroup {
  title: string;
  links: NavLink[];
}

// Sectioned nav, matching the reference CRM's "bifurcated" sidebar —
// a collapsible heading per area instead of one long flat list.
const GROUPS: NavGroup[] = [
  { title: "Overview", links: [{ href: "/dashboard", label: "Dashboard" }] },
  {
    title: "Sales & Orders",
    links: [
      { href: "/sales/new", label: "New Order" },
      { href: "/sales", label: "Sales" },
      { href: "/pos", label: "POS" },
      { href: "/route-assignments", label: "Route Assignments" },
    ],
  },
  { title: "Customers", links: [{ href: "/customers", label: "Customers" }] },
  {
    title: "Catalog & Stock",
    links: [
      { href: "/products", label: "Products" },
      { href: "/warehouses", label: "Warehouses" },
    ],
  },
  {
    title: "Operations",
    links: [
      { href: "/purchases", label: "Purchases" },
      { href: "/vendors", label: "Vendors" },
      { href: "/delivery-partners", label: "Deliveries" },
    ],
  },
  { title: "Admin", links: [{ href: "/users", label: "Users" }] },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    GROUPS.forEach((group) => group.links.forEach((link) => router.prefetch(link.href)));
  }, [router]);

  // Longest-matching-prefix wins within a group, so /sales/new (an exact
  // link) beats the broader /sales match when both are prefixes.
  function activeIndexIn(links: NavLink[]) {
    return links.reduce<{ index: number; length: number }>(
      (best, link, index) => {
        if (pathname.startsWith(link.href) && link.href.length > best.length) {
          return { index, length: link.href.length };
        }
        return best;
      },
      { index: -1, length: -1 }
    ).index;
  }

  function toggleGroup(title: string) {
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));
  }

  return (
    <aside className="print:hidden fixed top-0 left-0 flex h-screen w-64 flex-none flex-col justify-between overflow-y-auto border-r border-royal-soft/15 bg-royal-deep px-5 py-8 text-cream z-50">
      <div>
        <p className="font-serif text-xl text-ivory">Sadharmik & Co.</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-gold">CRM</p>

        <div className="mt-8 space-y-5">
          {GROUPS.map((group) => {
            const activeIndex = activeIndexIn(group.links);
            const isCollapsed = collapsed[group.title];
            return (
              <div key={group.title}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.title)}
                  className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-soft/80 hover:text-gold"
                >
                  {group.title}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                </button>
                {!isCollapsed && (
                  <div className="mt-2">
                    {/* Remounting when the active item changes keeps LineSidebar's
                        own highlight state in sync after client-side navigation. */}
                    <LineSidebar
                      key={`${group.title}-${activeIndex}`}
                      items={group.links.map((l) => l.label)}
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
                      onItemClick={(index) => router.push(group.links[index].href)}
                    />
                  </div>
                )}
              </div>
            );
          })}
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
