import { getDashboard } from "@/lib/foco-client";
import { demoDashboard } from "@/lib/demo-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedId = Number(searchParams.get("projectId"));
    const selectedId = Number.isFinite(requestedId) && requestedId > 0 ? requestedId : undefined;
    const payload = process.env.FOCO_DEMO_MODE === "true"
      ? demoDashboard(selectedId)
      : await getDashboard(selectedId);
    return Response.json(payload, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado al consultar el avance.";
    return Response.json({ error: message }, { status: 502 });
  }
}
