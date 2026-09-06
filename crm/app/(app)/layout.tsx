import { Sidebar } from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-ivory">
      <Sidebar />
      {/* min-w-0 stops a wide flex child (e.g. the Orders table) from growing
          this whole panel — and the page around it — instead of scrolling
          inside its own box. */}
      <main className="flex-1 min-w-0 p-10 pl-[calc(16rem+2.5rem)] print:p-0">{children}</main>
    </div>
  );
}
