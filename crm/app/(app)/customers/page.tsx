import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Input, Table } from "@/components/ui";
import { AddCustomerButton } from "./AddCustomerButton";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const customers = await prisma.customer.findMany({
    where: q
      ? { isActive: true, OR: [{ name: { contains: q } }, { phone: { contains: q } }] }
      : { isActive: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl text-royal">Customers</h1>
        <AddCustomerButton />
      </div>

      <form className="mt-6 max-w-sm" action="/customers">
        <Input name="q" placeholder="Search by name or phone" defaultValue={q ?? ""} />
      </form>

      <Table>
        <thead>
          <tr className="border-b border-royal-soft/15 text-xs uppercase tracking-wider text-royal-soft">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Phone</th>
            <th className="px-4 py-3">Address</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id} className="border-b border-royal-soft/10 last:border-0">
              <td className="px-4 py-3">
                <Link href={`/customers/${c.id}`} className="font-semibold text-royal hover:text-gold-soft">
                  {c.name}
                </Link>
              </td>
              <td className="px-4 py-3">{c.phone}</td>
              <td className="px-4 py-3">{c.address}</td>
            </tr>
          ))}
          {customers.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-sm text-royal-soft">No customers found.</td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
