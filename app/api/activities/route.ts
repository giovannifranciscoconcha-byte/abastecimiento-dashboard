import { getProjectDetail } from "@/lib/foco-client";
import { demoDashboard } from "@/lib/demo-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = Number(searchParams.get("projectId"));
    const advanceId = Number(searchParams.get("advanceId"));
    if (!Number.isFinite(projectId) || projectId <= 0 || !Number.isFinite(advanceId) || advanceId <= 0) {
      return Response.json({ error: "Proyecto o control de avance inválido." }, { status: 400 });
    }
    const requestedActivity = searchParams.get("activity") ?? undefined;
    const detail = process.env.FOCO_DEMO_MODE === "true"
      ? { activities: demoDashboard(projectId).activities, building: null }
      : await getProjectDetail(projectId, advanceId, requestedActivity);
    return Response.json(detail, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado al consultar actividades.";
    return Response.json({ error: message }, { status: 502 });
  }
}
