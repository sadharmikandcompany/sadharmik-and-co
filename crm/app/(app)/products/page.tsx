import { prisma } from "@/lib/prisma";
import { AddProductButton } from "./AddProductButton";
import { ProductsTable } from "./ProductsTable";

export default async function ProductsPage() {
  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl text-royal">Products</h1>
        <AddProductButton />
      </div>

      <div className="mt-6">
        <ProductsTable
          products={products.map((p) => ({
            id: p.id,
            name: p.name,
            packSize: p.packSize,
            price: p.price,
            gstPercentage: p.gstPercentage,
            stock: p.stock,
            isActive: p.isActive,
            showOnWebsite: p.showOnWebsite,
            imageUrl: p.imageUrl,
            description: p.description,
          }))}
        />
      </div>
    </div>
  );
}
