import { prisma } from "@/lib/prisma";
import { Button, Card, Input, Table } from "@/components/ui";
import { DeleteForm } from "@/components/DeleteForm";
import { createSupplier, deleteSupplier } from "./actions";

// Always render fresh — this is live business data, never a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const vendors = await prisma.supplier.findMany({ 
    where: { isActive: true }, 
    orderBy: { name: "asc" },
    include: { _count: { select: { purchases: true } } }
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-royal">Vendors</h1>
          <p className="mt-1 text-sm text-royal-soft">Manage your supplier and vendor database</p>
        </div>
        {/* We would typically use a modal for Add Vendor, but for simplicity we keep it inline or on the page */}
      </div>

      <Card className="mt-6">
        <h2 className="font-serif text-lg text-royal">Add New Vendor</h2>
        <form action={createSupplier} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Input name="name" placeholder="Vendor/Business Name *" required />
          <Input name="contactPerson" placeholder="Contact Person" />
          <Input name="phone" placeholder="Mobile Primary *" required />
          <Input name="email" placeholder="Email (Optional)" type="email" />
          <Input name="itemsSupplied" placeholder="Items Supplied (e.g. 5 items)" />
          <Button type="submit" className="justify-center sm:col-span-4">Add Vendor</Button>
        </form>
      </Card>

      <div className="mt-8">
        <Table>
          <thead>
            <tr className="border-b border-royal-soft/15 text-xs uppercase tracking-wider text-royal-soft text-left">
              <th className="px-4 py-3">Vendor Name</th>
              <th className="px-4 py-3">Contact Person</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Mobile</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Purchases</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => {
              // Parse out our hacky notes field to extract email and contact person if possible
              let email = "-";
              let contact = "-";
              if (v.notes && v.notes.startsWith("Email: ")) {
                const parts = v.notes.split(", Contact: ");
                email = parts[0].replace("Email: ", "") || "-";
                if (parts[1]) contact = parts[1] || "-";
              }

              return (
                <tr key={v.id} className="border-b border-royal-soft/10 last:border-0 hover:bg-royal-soft/5">
                  <td className="px-4 py-3 font-medium text-royal">{v.name}</td>
                  <td className="px-4 py-3 text-sm text-royal-soft">{contact}</td>
                  <td className="px-4 py-3 text-sm text-royal-soft">{email}</td>
                  <td className="px-4 py-3 text-sm text-royal-soft">{v.phone}</td>
                  <td className="px-4 py-3 text-sm text-royal-soft">
                    <span className="inline-block rounded-full border border-royal-soft/30 px-3 py-1 text-xs">Supplier</span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-royal">{v._count.purchases} orders</td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-full bg-royal-soft/10 px-3 py-1 text-xs font-semibold text-royal">Active</span>
                  </td>
                  <td className="px-4 py-3">
                    <DeleteForm 
                      action={async () => {
                        "use server";
                        await deleteSupplier(v.id);
                      }}
                      confirmMessage={`Are you sure you want to delete vendor "${v.name}"?`}
                    >
                      <button type="submit" className="text-red-500 hover:text-red-700 text-sm font-medium">Delete</button>
                    </DeleteForm>
                  </td>
                </tr>
              );
            })}
            {vendors.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-royal-soft">No vendors found.</td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
