import { prisma } from "@/lib/prisma";
import { PurchaseOrderForm } from "../PurchaseForm";
import Link from "next/link";

export default async function NewPurchasePage() {
  const suppliers = await prisma.supplier.findMany({ 
    where: { isActive: true }, 
    orderBy: { name: "asc" },
    select: { id: true, name: true }
  });

  return (
    <div>
      <div className="flex items-center gap-4">
        <Link href="/purchases" className="text-royal-soft hover:text-royal">
          ← Back
        </Link>
        <div>
          <h1 className="font-serif text-3xl text-royal">Create Purchase Order</h1>
          <p className="mt-1 text-sm text-royal-soft">Create a new purchase order from supplier</p>
        </div>
      </div>
      
      <PurchaseOrderForm suppliers={suppliers} />
    </div>
  );
}
