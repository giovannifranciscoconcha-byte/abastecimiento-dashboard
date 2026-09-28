import { getDashboard } from "@/lib/foco-client";
import { demoDashboard } from "@/lib/demo-data";
import { internalProgramProgress } from "@/lib/internal-report";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function applyInternalProgress(payload: Awaited<ReturnType<typeof getDashboard>>) {
  const projects = payload.projects.map((project) => {
    const snapshot = internalProgramProgress[project.id];
    if (!snapshot || snapshot.cumulativeActual === undefined) return project;
    return {
      ...project,
      cumulative: snapshot.cumulativeActual,
      controlDate: snapshot.reportDate,
      trend: snapshot.weeklyActual,
      deviationDays: snapshot.deviationDays ?? project.deviationDays,
      programProgress: snapshot,
    };
  });
  return { ...payload, projects: projects.toSorted((a, b) => b.cumulative - a.cumulative) };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedId = Number(searchParams.get("projectId"));
    const selectedId = Number.isFinite(requestedId) && requestedId > 0 ? requestedId : undefined;
    const source = process.env.FOCO_DEMO_MODE === "true"
      ? demoDashboard(selectedId)
      : await getDashboard(selectedId);
    const payload = process.env.FOCO_DEMO_MODE === "true" ? source : applyInternalProgress(source);
    return Response.json(payload, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado al consultar el avance.";
    return Response.json({ error: message }, { status: 502 });
  }
}
