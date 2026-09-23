import { getDashboard, getProjectDetail } from "@/lib/foco-client";
import { criticalRouteItems } from "@/lib/internal-report";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const dashboard = await getDashboard();
    const projectsWithControl = dashboard.projects
      .map((project) => ({ project, control: project.timeline.at(-1) }))
      .filter((item) => item.control);

    const refreshed = await Promise.allSettled(
      projectsWithControl.map(async ({ project, control }) => {
        const detail = await getProjectDetail(project.id, control!.id);
        return {
          id: project.id,
          name: project.name,
          controlDate: project.controlDate,
          deviationDays: project.deviationDays,
          deviationStatus: project.deviationDays === null
            ? "sin_dato"
            : project.deviationDays < 0
              ? "atraso"
              : "en_plazo",
          deviationSource: project.deviationDays === null ? null : "curva-avance-foco",
          programProgress: project.programProgress,
          criticalRouteAlerts: criticalRouteItems[project.id]?.length ?? 0,
          criticalRouteSource: criticalRouteItems[project.id]?.length ? "ruta-critica-foco" : null,
          activities: detail.activities.length,
          towers: detail.building?.towers.length ?? 0,
        };
      }),
    );

    const projects = refreshed.map((result, index) => result.status === "fulfilled"
      ? { ...result.value, status: "ok" }
      : {
          id: projectsWithControl[index].project.id,
          name: projectsWithControl[index].project.name,
          status: "error",
          error: result.reason instanceof Error ? result.reason.message : "Error de actualización",
        });
    const failed = projects.filter((project) => project.status === "error").length;

    return Response.json({
      updatedAt: new Date().toISOString(),
      status: failed ? "partial" : "ok",
      totalProjects: dashboard.projects.length,
      refreshedProjects: projects.length - failed,
      projects,
    }, {
      status: failed === projects.length && projects.length > 0 ? 502 : 200,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "No fue posible ejecutar la actualización semanal.",
      updatedAt: new Date().toISOString(),
    }, { status: 502 });
  }
}
