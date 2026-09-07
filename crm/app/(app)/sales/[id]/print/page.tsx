import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PrintCapture } from "./PrintCapture";

// Always render fresh — this is live business data, never a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type = "a4" } = await searchParams;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { customer: true, items: { include: { product: true } } },
  });

  if (!order) notFound();

  return <PrintCapture order={order} type={type === "thermal" ? "thermal" : "a4"} />;
}
