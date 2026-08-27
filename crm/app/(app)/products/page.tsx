import { prisma } from "@/lib/prisma";
import { Button, Card, Input, Table } from "@/components/ui";
import { createProduct, updateProduct } from "./actions";

export default async function ProductsPage() {
  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <h1 className="font-serif text-3xl text-royal">Products</h1>

      <Card className="mt-6">
        <h2 className="font-serif text-lg text-royal">Add product</h2>
        <form action={createProduct} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-5">
          <Input name="name" placeholder="Flavour name" required />
          <Input name="packSize" placeholder="Pack size (e.g. 500g)" required />
          <Input name="price" type="number" min="0" placeholder="Price (₹)" required />
          <Input name="stock" type="number" min="0" placeholder="Stock" required />
          <Input name="gstPercentage" type="number" min="0" placeholder="GST % (default 0)" />
          <Button type="submit" className="justify-center sm:col-span-5">Add product</Button>
        </form>
      </Card>

      <Table>
        <thead>
          <tr className="border-b border-royal-soft/15 text-xs uppercase tracking-wider text-royal-soft">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Pack</th>
            <th className="px-4 py-3">Price</th>
            <th className="px-4 py-3">GST %</th>
            <th className="px-4 py-3">Stock</th>
            <th className="px-4 py-3">Active</th>
            <th className="px-4 py-3">Save</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-b border-royal-soft/10 last:border-0">
              <form action={updateProduct} className="contents">
                <td className="px-4 py-3">
                  {p.name}
                  <input type="hidden" name="id" value={p.id} />
                </td>
                <td className="px-4 py-3">{p.packSize}</td>
                <td className="px-4 py-3">
                  <Input name="price" type="number" min="0" defaultValue={p.price} className="w-24" />
                </td>
                <td className="px-4 py-3">
                  <Input name="gstPercentage" type="number" min="0" defaultValue={p.gstPercentage} className="w-20" />
                </td>
                <td className="px-4 py-3">
                  <Input name="stock" type="number" min="0" defaultValue={p.stock} className="w-20" />
                </td>
                <td className="px-4 py-3">
                  <input type="checkbox" name="isActive" defaultChecked={p.isActive} />
                </td>
                <td className="px-4 py-3">
                  <Button type="submit" variant="ghost">Save</Button>
                </td>
              </form>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
