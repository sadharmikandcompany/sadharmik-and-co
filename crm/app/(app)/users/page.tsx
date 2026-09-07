import { prisma } from "@/lib/prisma";
import { Input, Table } from "@/components/ui";
import { AddUserButton } from "./AddUserButton";

// Always render fresh — this is live business data, never a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const users = await prisma.user.findMany({
    where: q
      ? { isActive: true, OR: [{ name: { contains: q } }, { phone: { contains: q } }] }
      : { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl text-royal">Users</h1>
        <AddUserButton />
      </div>

      <form className="mt-6 max-w-sm" action="/users">
        <Input name="q" placeholder="Search by name or phone" defaultValue={q ?? ""} />
      </form>

      <Table>
        <thead>
          <tr className="border-b border-royal-soft/15 text-xs uppercase tracking-wider text-royal-soft">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Phone</th>
            <th className="px-4 py-3">Email</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-royal-soft/10 last:border-0">
              <td className="px-4 py-3 font-semibold text-royal">
                {u.name}
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gold-soft/20 text-royal-deep">
                  {u.role.replace(/_/g, " ")}
                </span>
              </td>
              <td className="px-4 py-3">{u.phone}</td>
              <td className="px-4 py-3">{u.email || "-"}</td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-sm text-royal-soft">No users found.</td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
