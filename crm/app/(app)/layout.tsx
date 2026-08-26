import { Sidebar } from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-ivory">
      <Sidebar />
      <main className="flex-1 p-10">{children}</main>
    </div>
  );
}
