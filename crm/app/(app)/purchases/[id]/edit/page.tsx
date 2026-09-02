import { prisma } from "@/lib/prisma";
import { PurchaseOrderForm } from "../../PurchaseForm";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EditPurchasePage({ params }: { params: { id: string } }) {
  const [suppliers, purchase] = await Promise.all([
    prisma.supplier.findMany({ 
      where: { isActive: true }, 
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    prisma.purchase.findUnique({
      where: { id: params.id },
      include: { items: true }
    })
  ]);

  if (!purchase) {
    notFound();
  }

  const initialData = {
    supplierId: purchase.supplierId,
    paidStatus: purchase.paidStatus,
    purchaseStatus: purchase.purchaseStatus,
    poNumber: purchase.poNumber || "",
    invoiceNumber: purchase.invoiceNumber || "",
    paymentMethod: purchase.paymentMethod || "",
    batchNumber: purchase.batchNumber || "",
    notes: purchase.notes || "",
    amountPaid: purchase.amountPaid,
    purchaseDate: purchase.purchaseDate.toISOString(),
    lines: purchase.items.map(item => ({
      itemName: item.itemName,
      quantity: item.quantity,
      unit: item.unit,
      rate: item.rate
    }))
  };

  return (
    <div>
      <div className="flex items-center gap-4">
        <Link href="/purchases" className="text-royal-soft hover:text-royal">
          ← Back
        </Link>
        <div>
          <h1 className="font-serif text-3xl text-royal">Edit Purchase Order</h1>
          <p className="mt-1 text-sm text-royal-soft">Update existing purchase order</p>
        </div>
      </div>
      
      <PurchaseOrderForm 
        purchaseId={purchase.id} 
        initialData={initialData} 
        suppliers={suppliers} 
      />
    </div>
  );
}
