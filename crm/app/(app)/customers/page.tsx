import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Input, Table } from "@/components/ui";
import { AddCustomerButton } from "./AddCustomerButton";

import { CustomerRowActions } from "./CustomerRowActions";

// Always render fresh — this is live business data, never a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  // Let staff also search by the "Sd 0001"-style customer code — pull out
  // any digits typed (from "Sd0001", "0001", or just "1") and match that
  // against vipNumber alongside the usual name/phone search.
  const vipDigits = q?.replace(/\D/g, "") ?? "";
  const vipNumberQuery = vipDigits ? parseInt(vipDigits, 10) : undefined;

  const [customers, maxVipCustomer] = await Promise.all([
    prisma.customer.findMany({
      where: q
        ? {
            isActive: true,
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { mobilePrimary: { contains: q } },
              ...(vipNumberQuery !== undefined && !Number.isNaN(vipNumberQuery) ? [{ vipNumber: vipNumberQuery }] : []),
            ],
          }
        : { isActive: true },
      orderBy: { firstName: "asc" },
    }),
    prisma.customer.findFirst({
      orderBy: { vipNumber: "desc" },
      select: { vipNumber: true },
    }),
  ]);
  const nextVipNumber = (maxVipCustomer?.vipNumber ?? 0) + 1;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl text-royal">Customers</h1>
        <AddCustomerButton nextVipNumber={nextVipNumber} />
      </div>

      <form className="mt-6 max-w-sm" action="/customers">
        <Input name="q" placeholder="Search by name, phone, or Sd code (e.g. Sd0001)" defaultValue={q ?? ""} />
      </form>

      <Table>
        <thead>
          <tr className="border-b border-royal-soft/15 text-xs uppercase tracking-wider text-royal-soft">
            <th className="px-4 py-3">VIP #</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Phone</th>
            <th className="px-4 py-3">Address</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id} className="border-b border-royal-soft/10 last:border-0">
              <td className="px-4 py-3 text-gold-soft font-mono font-bold">
                Sd {String(c.vipNumber).padStart(4, '0')}
              </td>
              <td className="px-4 py-3">
                <Link href={`/customers/${c.id}`} className="font-semibold text-royal hover:text-gold-soft">
                  {c.firstName} {c.lastName}
                </Link>
              </td>
              <td className="px-4 py-3">{c.mobilePrimary}</td>
              <td className="px-4 py-3">{c.shippingAddress}</td>
              <td className="px-4 py-3">
                <CustomerRowActions customer={{
                  id: c.id,
                  firstName: c.firstName,
                  lastName: c.lastName,
                  email: c.email,
                  mobilePrimary: c.mobilePrimary,
                  whatsapp: c.whatsapp,
                  mobileSecondary1: c.mobileSecondary1,
                  mobileSecondary2: c.mobileSecondary2,
                  companyName: c.companyName,
                  gstNumber: c.gstNumber,
                  panNumber: c.panNumber,
                  shippingAddress: c.shippingAddress,
                  billingAddress: c.billingAddress,
                  isVip: c.isVip,
                  isMandir: c.isMandir,
                  isDefaulter: c.isDefaulter,
                  isActive: c.isActive,
                  notes: c.notes,
                }} />
              </td>
            </tr>
          ))}
          {customers.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-sm text-royal-soft">No customers found.</td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
