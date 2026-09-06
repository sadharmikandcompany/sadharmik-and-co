import { notFound } from "next/navigation";
import { getRouteManifest } from "@/lib/routeAssignments";
import { RouteSheetCapture } from "./RouteSheetCapture";

export default async function RouteSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const manifest = await getRouteManifest(id);
  if (!manifest) notFound();

  return <RouteSheetCapture manifest={manifest} />;
}
