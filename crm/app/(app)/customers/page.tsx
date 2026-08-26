import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button, Card, Input, Table } from "@/components/ui";
import { createCustomer } from "./actions";

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
      <h1 className="font-serif text-3xl text-royal">Customers</h1>

      <Card className="mt-6">
        <h2 className="font-serif text-lg text-royal">Add customer</h2>
        <form action={createCustomer} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input name="name" placeholder="Name" required />
          <Input name="phone" placeholder="Phone" required />
          <Input name="address" placeholder="Address" required className="sm:col-span-2" />
          <Input name="notes" placeholder="Notes (optional)" className="sm:col-span-2" />
          <Button type="submit" className="justify-center sm:col-span-2">Add customer</Button>
        </form>
      </Card>

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
