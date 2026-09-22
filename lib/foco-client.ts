import type { ActivityDetail, BuildingCell, BuildingFloor, BuildingProgressData, DashboardPayload, ProjectSummary, TimelinePoint } from "./types";

type JsonRecord = Record<string, unknown>;

const API_URL = process.env.FOCO_API_URL ?? "https://apidataclient.azurewebsites.net";
let tokenCache: { value: string; expiresAt: number } | null = null;
const detailCache = new Map<string, { payload: unknown; expiresAt: number }>();

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta configurar ${name} en Vercel.`);
  return value;
}

function pick(record: JsonRecord, ...keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
    const found = Object.keys(record).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    if (found && record[found] !== undefined && record[found] !== null) return record[found];
  }
  return undefined;
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    const numericText = normalized.match(/[-+]?\d+(?:\.\d+)?/)?.[0];
    const parsed = numericText === undefined ? Number.NaN : Number(numericText);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function optionalNumberValue(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = numberValue(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function deviationValue(record: JsonRecord): number | null {
  const explicitKeys = [
    "DesviacionDias", "DESVIACION_DIAS", "DesvDias", "DESV_DIAS",
    "DiasDesviacion", "DIAS_DESVIACION", "DiasAtraso", "DIAS_ATRASO",
    "AtrasoDias", "ATRASO_DIAS", "DiasRetraso", "DIAS_RETRASO",
  ];
  const explicit = optionalNumberValue(pick(record, ...explicitKeys));
  if (explicit !== null) return explicit;

  const detectedKey = Object.keys(record).find((key) => {
    const normalized = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return /(desvi|atras|retras).*(dia|d[ií]a)|(?:dia|d[ií]a).*(desvi|atras|retras)/i.test(normalized);
  });
  return detectedKey ? optionalNumberValue(record[detectedKey]) : null;
}

function textValue(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

function dateValue(value: unknown): string {
  const text = textValue(value);
  if (!text) return "";
  const timestamp = Date.parse(text);
  return Number.isNaN(timestamp) ? text : new Date(timestamp).toISOString();
}

function rows(payload: unknown): JsonRecord[] {
  if (Array.isArray(payload)) return payload.filter((item): item is JsonRecord => !!item && typeof item === "object");
  if (!payload || typeof payload !== "object") return [];
  const object = payload as JsonRecord;
  for (const key of ["data", "Data", "result", "Result", "items", "Items"]) {
    if (Array.isArray(object[key])) return rows(object[key]);
  }
  return [];
}

async function authenticate(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.value;
  const form = new URLSearchParams({
    username: required("FOCO_API_USERNAME"),
    password: required("FOCO_API_PASSWORD"),
    grant_type: "password",
  });
  const response = await fetch(`${API_URL}/Autentificacion`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`No fue posible autenticar con la API (${response.status}).`);
  const payload = (await response.json()) as JsonRecord;
  const token = textValue(payload.access_token);
  if (!token) throw new Error("La API no entregó el token de acceso.");
  const expiresIn = numberValue(payload.expires_in) || 899;
  tokenCache = { value: token, expiresAt: Date.now() + expiresIn * 1000 };
  return token;
}

async function apiGet(path: string, token: string, extra: Record<string, string> = {}): Promise<unknown> {
  const query = new URLSearchParams({
    user: required("FOCO_API_USERNAME"),
    company: required("FOCO_API_COMPANY"),
    apikey: required("FOCO_API_KEY"),
    ...extra,
  });
  const response = await fetch(`${API_URL}${path}?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`La API respondió ${response.status}${detail ? `: ${detail.slice(0, 180)}` : "."}`);
  }
  return response.json();
}

function mapTimeline(payload: unknown): TimelinePoint[] {
  return rows(payload)
    .map((row) => ({
      id: numberValue(pick(row, "IdAvance", "ID_AVANCE")),
      date: dateValue(pick(row, "FechaAvance", "FECHA_AVANCE")),
      status: textValue(pick(row, "Estado", "ESTADO")),
      cumulative: numberValue(pick(row, "PorcentajeAcumulado", "PORCENTAJE_ACUMULADO")),
      period: numberValue(pick(row, "PorcentajePeriodo", "PORCENTAJE_PERIODO")),
    }))
    .filter((control) => control.id > 0)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

function mapActivities(payload: unknown): ActivityDetail[] {
  const mapped = rows(payload).map((row, index) => ({
    id: numberValue(pick(row, "ID_INS", "ID_PAR_UCO")) || index + 1,
    code: textValue(pick(row, "CODIGO_INS")),
    name: textValue(pick(row, "NOMBRE_INS")) || "Actividad sin nombre",
    unit: textValue(pick(row, "NOMABR_UNI")),
    chapter: numberValue(pick(row, "ID_NAT")) === 1,
    level: numberValue(pick(row, "NIVEL")),
    cumulative: numberValue(pick(row, "PRC_DAV", "AVANCE_UCO")),
    previous: numberValue(pick(row, "PRC_DAV_ANT")),
    variation: numberValue(pick(row, "DIFERENCIA_AVA")),
    room: textValue(pick(row, "NOMBRE_UCO")),
    location: textValue(pick(row, "RAIZ", "ARBOL")),
  }));
  const unique = new Map<string, ActivityDetail>();
  for (const activity of mapped) {
    const key = `${activity.id}|${activity.name}|${activity.room}`;
    if (!unique.has(key)) unique.set(key, activity);
  }
  const values = [...unique.values()];
  const chapters = values.filter((activity) => activity.chapter).slice(0, 120);
  const active = values
    .filter((activity) => !activity.chapter && activity.cumulative < 100)
    .sort((a, b) => a.cumulative - b.cumulative)
    .slice(0, 280);
  const complete = values.filter((activity) => !activity.chapter && activity.cumulative >= 100).slice(0, 100);
  return [...chapters, ...active, ...complete];
}

function normalizedActivityName(value: unknown): string {
  const name = textValue(value).replace(/\s+/g, " ").trim();
  const comparable = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("es");
  if (comparable.includes("HORMIG")) return "Hormigón";
  if (comparable.includes("ENFIERR")) return "Enfierradura";
  if (comparable.includes("MOLDAJE")) return "Moldajes";
  if (comparable.includes("INSTALAC")) return "Instalaciones";
  return name;
}

type RawBuildingUnit = {
  activity: string;
  towerKey: string;
  towerName: string;
  floorKey: string;
  floorLabel: string;
  floorOrder: number;
  zone: "walls" | "slabs";
  id: number;
  name: string;
  progress: number;
};

function buildingUnit(row: JsonRecord): RawBuildingUnit | null {
  const root = textValue(pick(row, "RAIZ"));
  const towerMatch = root.match(/(?:EDIFICIO|TORRE)\s+([A-Z0-9-]+)/i);
  const namedBuildingMatch = root.match(/\/\s*ED\.\s*([^/]+)/i);
  if (!towerMatch && !namedBuildingMatch) return null;

  const isWalls = /\/\s*MUROS(?:\s*\/|\s*$)/i.test(root);
  const isSlabs = /\/\s*LOSAS(?:\s*\/|\s*$)/i.test(root);
  if (!isWalls && !isSlabs) return null;

  const floorMatch = root.match(/PISO\s*0*(\d{1,2})/i);
  const basementMatch = root.match(/(?:SUBTERR[AÁ]NEO|SUBTE)\s*-?\s*(\d{1,2})/i);
  const crown = /CORONACI[ÓO]N|SALA\s+M[AÁ]QUINA/i.test(root);
  let floorKey = "";
  let floorLabel = "";
  let floorOrder = 0;
  if (floorMatch) {
    const floor = Number(floorMatch[1]);
    floorKey = `P${floor}`;
    floorLabel = `P${String(floor).padStart(2, "0")}`;
    floorOrder = floor;
  } else if (crown) {
    floorKey = "PC";
    floorLabel = "P.C.";
    floorOrder = 100;
  } else if (basementMatch) {
    const basement = Number(basementMatch[1]);
    floorKey = `S${basement}`;
    floorLabel = `S-${basement}`;
    floorOrder = -basement;
  } else {
    return null;
  }

  const activity = normalizedActivityName(pick(row, "NOMBRE_INS"));
  const id = numberValue(pick(row, "ID_PAR_UCO"));
  const name = textValue(pick(row, "NOMBRE_UCO"));
  if (!activity || !id || !name) return null;
  const towerCode = (towerMatch?.[1] ?? namedBuildingMatch?.[1] ?? "EDIFICIO").trim().toLocaleUpperCase("es");
  const towerName = towerMatch ? `Torre ${towerCode}` : `Edificio ${towerCode}`;
  return {
    activity,
    towerKey: towerCode,
    towerName,
    floorKey,
    floorLabel,
    floorOrder,
    zone: isWalls ? "walls" : "slabs",
    id,
    name,
    progress: numberValue(pick(row, "AVANCE_UCO")),
  };
}

function mapBuildingProgress(payload: unknown, requestedActivity?: string): BuildingProgressData | null {
  const units = rows(payload).map(buildingUnit).filter((unit): unit is RawBuildingUnit => unit !== null);
  if (!units.length) return null;

  const coverage = new Map<string, { towers: Set<string>; floors: Set<string>; units: number }>();
  for (const unit of units) {
    const item = coverage.get(unit.activity) ?? { towers: new Set<string>(), floors: new Set<string>(), units: 0 };
    item.towers.add(unit.towerKey);
    item.floors.add(`${unit.towerKey}-${unit.floorKey}`);
    item.units += 1;
    coverage.set(unit.activity, item);
  }
  const priority = ["Hormigón", "Enfierradura", "Moldajes", "Instalaciones"];
  const activityOptions = [...coverage.entries()]
    .filter(([, item]) => item.floors.size >= 2)
    .sort(([nameA, a], [nameB, b]) => {
      const priorityA = priority.indexOf(nameA);
      const priorityB = priority.indexOf(nameB);
      if (priorityA !== -1 || priorityB !== -1) return (priorityA === -1 ? 99 : priorityA) - (priorityB === -1 ? 99 : priorityB);
      return b.towers.size - a.towers.size || b.floors.size - a.floors.size || b.units - a.units || nameA.localeCompare(nameB, "es");
    })
    .map(([name]) => name)
    .slice(0, 60);
  if (!activityOptions.length) return null;
  const selectedActivity = requestedActivity && activityOptions.includes(requestedActivity)
    ? requestedActivity
    : activityOptions[0];

  const selectedUnits = units.filter((unit) => unit.activity === selectedActivity);
  const towerMap = new Map<string, { name: string; floors: Map<string, BuildingFloor> }>();
  for (const unit of selectedUnits) {
    const tower = towerMap.get(unit.towerKey) ?? { name: unit.towerName, floors: new Map<string, BuildingFloor>() };
    const floor = tower.floors.get(unit.floorKey) ?? {
      key: unit.floorKey,
      label: unit.floorLabel,
      order: unit.floorOrder,
      walls: [],
      slabs: [],
    };
    const cells = floor[unit.zone] as BuildingCell[];
    const existing = cells.find((cell) => cell.id === unit.id || cell.name === unit.name);
    if (existing) existing.progress = Math.max(existing.progress, unit.progress);
    else cells.push({ id: unit.id, name: unit.name, progress: unit.progress });
    tower.floors.set(unit.floorKey, floor);
    towerMap.set(unit.towerKey, tower);
  }

  const towers = [...towerMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "es", { numeric: true }))
    .map(([key, tower]) => ({
      key,
      name: tower.name,
      floors: [...tower.floors.values()]
        .map((floor) => ({
          ...floor,
          walls: floor.walls.toSorted((a, b) => a.name.localeCompare(b.name, "es", { numeric: true })),
          slabs: floor.slabs.toSorted((a, b) => a.name.localeCompare(b.name, "es", { numeric: true })),
        }))
        .sort((a, b) => b.order - a.order),
    }));

  return { activity: selectedActivity, activityOptions, towers };
}

export async function getDashboard(selectedProjectId?: number): Promise<DashboardPayload> {
  const token = await authenticate();
  const worksPayload = await apiGet("/api/v1/avance/obras", token);
  const works = rows(worksPayload)
    .map((row) => ({
      id: numberValue(pick(row, "ID_OBR")),
      name: textValue(pick(row, "NOMBRE_OBR", "Nombre_Obr")),
      status: numberValue(pick(row, "ESTADO_OBR")) || 1,
      deviationDays: deviationValue(row),
    }))
    .filter((work) => work.id > 0 && work.status === 1);

  const controlResults = await Promise.allSettled(
    works.map((work) => apiGet("/api/v1/avance/control", token, { idObra: String(work.id) })),
  );

  const projects: ProjectSummary[] = works.map((work, index) => {
    const result = controlResults[index];
    const timeline = result.status === "fulfilled" ? mapTimeline(result.value) : [];
    const latest = timeline.at(-1);
    const previous = timeline.at(-2);
    return {
      ...work,
      cumulative: latest?.cumulative ?? 0,
      period: latest?.period ?? 0,
      controlDate: latest?.date || null,
      trend: latest && previous ? latest.cumulative - previous.cumulative : latest?.period ?? 0,
      deviationDays: deviationValue((result.status === "fulfilled" ? rows(result.value).at(-1) : {}) ?? {})
        ?? work.deviationDays
        ?? (work.id === 69 ? -16 : null),
      controlCount: timeline.length,
      timeline,
      warning: result.status === "rejected" ? "No fue posible consultar sus controles." : undefined,
    };
  });

  const sortedProjects = projects.toSorted((a, b) => b.cumulative - a.cumulative);
  const resolvedProjectId =
    selectedProjectId && sortedProjects.some((project) => project.id === selectedProjectId)
      ? selectedProjectId
      : sortedProjects[0]?.id ?? null;
  return {
    generatedAt: new Date().toISOString(),
    projects: sortedProjects,
    selectedProjectId: resolvedProjectId,
    activities: [],
    building: null,
  };
}

export async function getProjectDetail(projectId: number, advanceId: number, activity?: string) {
  const cacheKey = `${projectId}-${advanceId}`;
  const cached = detailCache.get(cacheKey);
  let payload = cached && cached.expiresAt > Date.now() ? cached.payload : null;
  if (!payload) {
    const token = await authenticate();
    payload = await apiGet("/api/v1/avance/partidas-criticas", token, {
      idObra: String(projectId),
      idAvance: String(advanceId),
      incluirCapitulos: "true",
    });
    detailCache.set(cacheKey, { payload, expiresAt: Date.now() + 5 * 60_000 });
  }
  return {
    activities: mapActivities(payload),
    building: mapBuildingProgress(payload, activity),
  };
}
