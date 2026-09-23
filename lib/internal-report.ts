export type InternalProgramProgress = {
  reportDate: string;
  weeklyActual: number;
  weeklyPlanned: number;
  weeklyDeviation: number;
};

export type CriticalRouteItem = {
  chapter: string;
  activity: string;
  planned: number;
  actual: number;
  deviation: number;
  balanceStart: string;
};

// Valores leídos de Foco en Obra > Avance > Control Interno - Reportes.
// La API pública de avance no expone la curva programada ni la Ruta Crítica.
// Cuando esos campos lleguen por API, deben prevalecer sobre este respaldo.
export const internalProgramProgress: Record<number, InternalProgramProgress> = {
  68: { reportDate: "2026-09-20", weeklyActual: 0.65, weeklyPlanned: 0.76, weeklyDeviation: -0.11 },
  69: { reportDate: "2026-09-20", weeklyActual: 0.40, weeklyPlanned: 0.92, weeklyDeviation: -0.52 },
  70: { reportDate: "2026-09-06", weeklyActual: 0.10, weeklyPlanned: 0.12, weeklyDeviation: -0.01 },
};

export const criticalRouteItems: Record<number, CriticalRouteItem[]> = {
  68: [
    { chapter: "Terminaciones departamentos / Piso 2", activity: "Grada buque", planned: 100, actual: 0, deviation: -100, balanceStart: "2026-09-21" },
    { chapter: "Terminaciones departamentos / Piso 2", activity: "Protocolo cierre de fase 1 y 2", planned: 100, actual: 0, deviation: -100, balanceStart: "2026-09-21" },
    { chapter: "Terminaciones departamentos / Piso 2", activity: "Yeso muro y losa, incluso cuadratura de cajas", planned: 100, actual: 0, deviation: -100, balanceStart: "2026-09-21" },
    { chapter: "Terminaciones departamentos / Piso 2", activity: "Faldón y zócalo", planned: 100, actual: 0, deviation: -100, balanceStart: "2026-09-21" },
    { chapter: "Terminaciones departamentos / Piso 2", activity: "Impermeabilización final", planned: 100, actual: 0, deviation: -100, balanceStart: "2026-09-22" },
  ],
  69: [
    { chapter: "Eléctrico", activity: "Tableros", planned: 21.5, actual: 0, deviation: -21.5, balanceStart: "2026-09-21" },
    { chapter: "Eléctrico", activity: "Canalizaciones", planned: 54.8, actual: 48, deviation: -6.9, balanceStart: "2026-09-21" },
    { chapter: "Eléctrico", activity: "Alambrado", planned: 4.7, actual: 0, deviation: -4.7, balanceStart: "2026-10-02" },
  ],
  70: [
    { chapter: "Torre A / Obra gruesa / Fundaciones", activity: "Excavación de fundaciones", planned: 66.7, actual: 0, deviation: -66.7, balanceStart: "2026-09-07" },
  ],
};
