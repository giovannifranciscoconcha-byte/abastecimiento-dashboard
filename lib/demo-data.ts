import type { DashboardPayload, TimelinePoint } from "./types";

const projectSeeds = [
  [101, "Yungay", 67.4, 4.8],
  [102, "Fuchslocher Oriente", 82.1, 3.2],
  [103, "Puerto Varas", 54.7, 6.1],
  [104, "La Granja", 38.5, 5.4],
  [105, "PCLR Santiago", 23.8, 2.9],
  [106, "Osorno", 15.3, 3.7],
] as const;

function timeline(projectId: number, finalValue: number): TimelinePoint[] {
  const points = 7;
  return Array.from({ length: points }, (_, index) => {
    const cumulative = Number(Math.max(0, finalValue - (points - index - 1) * (finalValue / 8)).toFixed(1));
    const date = new Date(Date.UTC(2026, 2 + index, 30)).toISOString();
    return { id: projectId * 100 + index, date, status: "Cerrado", cumulative, period: Number((finalValue / 8).toFixed(1)) };
  });
}

export function demoDashboard(selectedId?: number): DashboardPayload {
  const projects = projectSeeds.map(([id, name, cumulative, period], index) => ({
    id,
    name,
    status: 1,
    cumulative,
    period,
    controlDate: "2026-09-15T12:00:00.000Z",
    trend: period,
    deviationDays: index % 3 === 0 ? -12 : index % 3 === 1 ? 0 : 7,
    controlCount: 7,
    timeline: timeline(id, cumulative),
  })).sort((a, b) => b.cumulative - a.cumulative);
  const selectedProjectId = selectedId && projects.some((project) => project.id === selectedId) ? selectedId : projects[0].id;
  const activityNames = ["Fundaciones", "Estructura de hormigón", "Tabiquería interior", "Instalación eléctrica", "Red sanitaria", "Revestimientos", "Pintura interior", "Terminaciones"];
  const activities = activityNames.flatMap((name, index) => [0, 1].map((room) => ({
    id: index * 10 + room,
    code: `P-${String(index + 1).padStart(2, "0")}`,
    name,
    unit: "%",
    chapter: room === 0,
    level: room === 0 ? 1 : 2,
    cumulative: Math.min(100, 24 + index * 9 + room * 6),
    previous: Math.max(0, 19 + index * 8),
    variation: 3 + (index % 4),
    room: room === 0 ? "" : `Piso ${index + 2}`,
    location: `Edificio / Nivel ${index + 1}`,
  })));
  return { generatedAt: new Date().toISOString(), projects, selectedProjectId, activities, building: null };
}
