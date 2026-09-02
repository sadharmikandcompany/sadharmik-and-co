import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button, Card, StatCard, Table, Badge } from "@/components/ui";
import { DeleteForm } from "@/components/DeleteForm";
import { deletePurchase } from "./actions";

export default async function PurchasesPage() {
  const [purchases, pendingCount, receivedCount, totalValue] = await Promise.all([
    prisma.purchase.findMany({ orderBy: { purchaseDate: "desc" }, include: { supplier: true, items: true } }),
    prisma.purchase.count({ where: { purchaseStatus: "PENDING" } }),
    prisma.purchase.count({ where: { purchaseStatus: "RECEIVED" } }),
    prisma.purchase.aggregate({ _sum: { total: true } }),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-royal">Purchases</h1>
          <p className="mt-1 text-sm text-royal-soft">Manage purchases from suppliers and track inventory</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/purchases/new"
            className="inline-flex items-center gap-2 rounded-full bg-royal text-white px-5 py-2.5 text-sm font-semibold shadow-md transition-transform hover:-translate-y-0.5"
          >
            + Create Purchase Order
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-4">
        <StatCard label="Total Purchases" value={purchases.length.toString()} hint="All purchase orders" />
        <StatCard label="Pending" value={pendingCount.toString()} hint="Awaiting receipt" />
        <StatCard label="Received" value={receivedCount.toString()} hint="Goods received" />
        <StatCard label="Total Value" value={`₹${(totalValue._sum.total || 0).toLocaleString()}`} hint="Sum of purchases" />
      </div>

      <div className="mt-8">
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-royal-soft/15 flex justify-between items-center">
            <h2 className="font-serif text-lg text-royal">Purchase Orders</h2>
            <div className="text-sm text-royal-soft bg-royal-soft/10 px-3 py-1 rounded-full">{purchases.length} orders</div>
          </div>
          <Table>
            <thead>
              <tr className="border-b border-royal-soft/15 text-xs uppercase tracking-wider text-royal-soft text-left bg-gray-50/50">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">PO Number</th>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Supplier/Distributor</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Purchase Status</th>
                <th className="px-4 py-3">Payment Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} className="border-b border-royal-soft/10 last:border-0 hover:bg-royal-soft/5">
                  <td className="px-4 py-3 text-sm">{p.purchaseDate.toLocaleDateString("en-US")}</td>
                  <td className="px-4 py-3 text-sm font-medium">
                    <Link href={`/purchases/${p.id}/edit`} className="hover:text-gold">{p.poNumber || "N/A"}</Link>
                  </td>
                  <td className="px-4 py-3 text-sm">{p.invoiceNumber || "-"}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-royal">{p.supplier.name}</div>
                    <div className="text-xs text-royal-soft truncate max-w-[200px]">{p.items.map(i => i.itemName).join(", ")}</div>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold">₹{p.total.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${p.purchaseStatus === "RECEIVED" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                      {p.purchaseStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${p.paidStatus === "PAID" ? "bg-blue-100 text-blue-800" : p.paidStatus === "PARTIAL" ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-800"}`}>
                      {p.paidStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/purchases/${p.id}/edit`} className="text-blue-500 hover:text-blue-700 text-sm font-medium">Edit</Link>
                      <DeleteForm 
                        action={async () => {
                          "use server";
                          await deletePurchase(p.id);
                        }}
                        confirmMessage="Are you sure you want to delete this purchase order?"
                      >
                        <button type="submit" className="text-red-500 hover:text-red-700 text-sm font-medium">Delete</button>
                      </DeleteForm>
                    </div>
                  </td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-royal-soft">No purchases logged yet.</td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
