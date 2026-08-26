import { prisma } from "@/lib/prisma";
import { Button, Card, Input, Table } from "@/components/ui";
import { createSupplier } from "./actions";
import { PurchaseForm } from "./PurchaseForm";

export default async function PurchasesPage() {
  const [suppliers, purchases] = await Promise.all([
    prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.purchase.findMany({ orderBy: { purchaseDate: "desc" }, include: { supplier: true, items: true } }),
  ]);

  return (
    <div>
      <h1 className="font-serif text-3xl text-royal">Purchases</h1>

      <Card className="mt-6">
        <h2 className="font-serif text-lg text-royal">Add supplier</h2>
        <form action={createSupplier} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input name="name" placeholder="Supplier name" required />
          <Input name="phone" placeholder="Phone" required />
          <Input name="itemsSupplied" placeholder="Items supplied (optional)" />
          <Button type="submit" className="justify-center sm:col-span-3">Add supplier</Button>
        </form>
      </Card>

      <Card className="mt-6">
        <h2 className="font-serif text-lg text-royal">Log purchase</h2>
        <PurchaseForm suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} />
      </Card>

      <h2 className="mt-8 font-serif text-xl text-royal">Purchase register</h2>
      <Table>
        <thead>
          <tr className="border-b border-royal-soft/15 text-xs uppercase tracking-wider text-royal-soft">
            <th className="px-4 py-3">Supplier</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Items</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {purchases.map((p) => (
            <tr key={p.id} className="border-b border-royal-soft/10 last:border-0">
              <td className="px-4 py-3">{p.supplier.name}</td>
              <td className="px-4 py-3">{p.purchaseDate.toLocaleDateString("en-IN")}</td>
              <td className="px-4 py-3">{p.items.map((i) => i.itemName).join(", ")}</td>
              <td className="px-4 py-3">₹{p.total}</td>
              <td className="px-4 py-3">{p.paidStatus}</td>
            </tr>
          ))}
          {purchases.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-sm text-royal-soft">No purchases logged yet.</td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
