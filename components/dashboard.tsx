"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { DashboardPayload } from "@/lib/types";
import { ProgressRing, ProjectBars, TrendChart } from "./charts";
import { BuildingProgress } from "./building-progress";
import { AlertIcon, BuildingIcon, ChevronIcon, ClockIcon, RefreshIcon, SearchIcon } from "./icons";
import { criticalRouteItems } from "@/lib/internal-report";

function formatDate(value: string | null, withTime = false) {
  if (!value) return "Sin control";
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

function delayPresentation(value: number | null) {
  if (value === null) return { className: "unknown", value: "—", label: "No disponible en API" };
  if (value < 0) return { className: "late", value: `${Math.abs(value)}`, label: "días de atraso" };
  if (value > 0) return { className: "ahead", value: `${value}`, label: "días de adelanto" };
  return { className: "on-time", value: "0", label: "días · En plazo" };
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatExactPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(value));
}

const finishingPattern = /termin|revest|pintur|cer[aá]m|puerta|ventana|yeso|impermeabil|grada|zócalo|zocalo/i;

async function fetchDashboard(projectId?: number): Promise<DashboardPayload> {
  const query = projectId ? `?projectId=${projectId}` : "";
  const response = await fetch(`/api/dashboard${query}`, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "No fue posible cargar el avance.");
  return payload as DashboardPayload;
}

async function fetchActivityData(projectId: number, advanceId: number, activity?: string) {
  const query = new URLSearchParams({ projectId: String(projectId), advanceId: String(advanceId) });
  if (activity) query.set("activity", activity);
  const response = await fetch(`/api/activities?${query}`, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "No fue posible cargar las actividades.");
  return payload as Pick<DashboardPayload, "activities" | "building">;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [loadingBuilding, setLoadingBuilding] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activitySearch, setActivitySearch] = useState("");
  const [activityFilter, setActivityFilter] = useState<"all" | "critical" | "complete">("all");
  const [showFinishingSummary, setShowFinishingSummary] = useState(false);
  const activitiesPanelRef = useRef<HTMLElement>(null);
  const finishingSummaryRef = useRef<HTMLElement>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const payload = await fetchDashboard(data?.selectedProjectId ?? undefined);
      const selectedProject = payload.projects.find((project) => project.id === payload.selectedProjectId);
      const lastControl = selectedProject?.timeline.at(-1);
      const detail = selectedProject && lastControl
        ? await fetchActivityData(selectedProject.id, lastControl.id)
        : { activities: [], building: null };
      setData({ ...payload, ...detail });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible cargar el avance.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [data?.selectedProjectId]);

  const selectProject = useCallback(async (projectId: number) => {
    const project = data?.projects.find((item) => item.id === projectId);
    const lastControl = project?.timeline.at(-1);
    setData((current) => current ? { ...current, selectedProjectId: projectId, activities: [], building: null } : current);
    window.history.replaceState(null, "", `?projectId=${projectId}`);
    setActivitySearch("");
    if (!project || !lastControl) return;
    setLoadingActivities(true);
    setError("");
    try {
      const detail = await fetchActivityData(projectId, lastControl.id);
      setData((current) => current?.selectedProjectId === projectId ? { ...current, ...detail } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible cargar las actividades.");
    } finally {
      setLoadingActivities(false);
    }
  }, [data?.projects]);

  const selectBuildingActivity = useCallback(async (activity: string) => {
    const project = data?.projects.find((item) => item.id === data.selectedProjectId);
    const lastControl = project?.timeline.at(-1);
    if (!project || !lastControl) return;
    setLoadingBuilding(true);
    setError("");
    try {
      const detail = await fetchActivityData(project.id, lastControl.id, activity);
      setData((current) => current?.selectedProjectId === project.id ? { ...current, building: detail.building } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible cargar el gráfico del proyecto.");
    } finally {
      setLoadingBuilding(false);
    }
  }, [data?.projects, data?.selectedProjectId]);

  useEffect(() => {
    let active = true;
    const requestedId = Number(new URLSearchParams(window.location.search).get("projectId"));
    void fetchDashboard(Number.isFinite(requestedId) && requestedId > 0 ? requestedId : undefined)
      .then(async (payload) => {
        if (!active) return;
        setData(payload);
        const selectedProject = payload.projects.find((project) => project.id === payload.selectedProjectId);
        const lastControl = selectedProject?.timeline.at(-1);
        if (!selectedProject || !lastControl) return;
        setLoadingActivities(true);
        const detail = await fetchActivityData(selectedProject.id, lastControl.id);
        if (active) setData({ ...payload, ...detail });
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "No fue posible cargar el avance."); })
      .finally(() => { if (active) { setLoading(false); setLoadingActivities(false); } });
    return () => { active = false; };
  }, []);

  const selected = data?.projects.find((project) => project.id === data.selectedProjectId) ?? null;
  const selectedProgram = selected?.programProgress ?? null;
  const selectedCriticalRoute = useMemo(() => selected ? criticalRouteItems[selected.id] ?? [] : [], [selected]);
  const filteredProjects = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return data?.projects.filter((project) => project.name.toLocaleLowerCase("es").includes(query)) ?? [];
  }, [data, search]);
  const filteredActivities = useMemo(() => {
    const query = activitySearch.trim().toLocaleLowerCase("es");
    return (data?.activities ?? []).filter((activity) => {
      const matchesText = `${activity.code} ${activity.name} ${activity.room}`.toLocaleLowerCase("es").includes(query);
      const matchesState = activityFilter === "all" || (activityFilter === "critical" && activity.cumulative < 50) || (activityFilter === "complete" && activity.cumulative >= 100);
      return matchesText && matchesState;
    });
  }, [activityFilter, activitySearch, data]);
  const finishingActivities = useMemo(
    () => (data?.activities ?? []).filter((activity) => !activity.chapter && finishingPattern.test(`${activity.name} ${activity.location}`)),
    [data],
  );
  const criticalFinishingItems = useMemo(
    () => selectedCriticalRoute.filter((item) => finishingPattern.test(`${item.chapter} ${item.activity}`)),
    [selectedCriticalRoute],
  );
  const finishingAverage = useMemo(
    () => {
      if (finishingActivities.length) return finishingActivities.reduce((sum, activity) => sum + activity.cumulative, 0) / finishingActivities.length;
      return criticalFinishingItems.length ? criticalFinishingItems.reduce((sum, item) => sum + item.actual, 0) / criticalFinishingItems.length : 0;
    },
    [criticalFinishingItems, finishingActivities],
  );
  const finishingCount = finishingActivities.length || criticalFinishingItems.length;
  const finishingStarted = finishingActivities.length
    ? finishingActivities.filter((activity) => activity.cumulative > 0).length
    : criticalFinishingItems.filter((item) => item.actual > 0).length;
  const finishingCompleted = finishingActivities.length
    ? finishingActivities.filter((activity) => activity.cumulative >= 100).length
    : criticalFinishingItems.filter((item) => item.actual >= 100).length;

  const showActivities = useCallback(() => {
    activitiesPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const showFinishing = useCallback(() => {
    setShowFinishingSummary(true);
    window.setTimeout(() => finishingSummaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }, []);

  if (loading && !data) {
    return <LoadingDashboard />;
  }

  if (error && !data) {
    return (
      <main className="center-state">
        <div className="error-card">
          <AlertIcon />
          <h1>No pudimos cargar el avance</h1>
          <p>{error}</p>
          <button className="primary-button" onClick={() => void load()}>Reintentar</button>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand"><Image src="/logo-boetsch.png" width={82} height={90} alt="Boetsch" preload /></div>
        <div className="topbar-title">
          <span>Control de obras</span>
          <small>Panel ejecutivo de avance</small>
        </div>
        <div className="updated">
          <span className="live-dot" />
          <span>Actualizado {data ? formatDate(data.generatedAt, true) : "-"}</span>
          <button className="icon-button" onClick={() => void load(true)} aria-label="Actualizar datos" disabled={refreshing}>
            <RefreshIcon className={refreshing ? "spinning" : ""} />
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        {error && <div className="inline-error"><AlertIcon /> {error}</div>}
        <section className="intro-row">
          <div>
            <p className="eyebrow">PORTAFOLIO VIGENTE</p>
            <h1>Avance programa interno (Foco en Obra)</h1>
            <p className="intro-copy">Lectura de avance real, programa interno y riesgos de la última actualización disponible.</p>
          </div>
          <label className="select-wrap">
            <span>Obra seleccionada</span>
            <div>
              <select value={data?.selectedProjectId ?? ""} onChange={(event) => void selectProject(Number(event.target.value))}>
                {data?.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
              <ChevronIcon />
            </div>
          </label>
        </section>

        <section className="summary-layout">
          <div className="metrics-grid summary-metrics">
            <article className="metric-card primary-metric">
              <div className="metric-icon"><BuildingIcon /></div>
              <div><span>Proyectos vigentes</span><strong>{data?.projects.length ?? 0}</strong><small>obras monitoreadas</small></div>
            </article>
            <article className="metric-card program-metric">
              <div className="metric-icon green"><ClockIcon /></div>
              <div>
                <span>Avance semanal</span>
                {selectedProgram ? (
                  <>
                    <strong>{formatExactPercent(selectedProgram.weeklyActual)}</strong>
                    <small>Programado parcial: {formatExactPercent(selectedProgram.weeklyPlanned)} · Corte {formatShortDate(selectedProgram.reportDate)}</small>
                  </>
                ) : <><strong>—</strong><small>Sin reporte interno configurado</small></>}
              </div>
            </article>
          </div>
          <article className="panel ranking-panel summary-ranking">
            <div className="panel-heading">
              <div><p className="eyebrow">COMPARATIVO</p><h2>Avance por proyecto</h2></div>
              <label className="search-box"><SearchIcon /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar obra" /></label>
            </div>
            <ProjectBars projects={filteredProjects} selectedId={data?.selectedProjectId ?? null} onSelect={(id) => void selectProject(id)} />
          </article>
        </section>

        <section className="panel delay-panel">
          <div className="panel-heading delay-heading">
            <div><p className="eyebrow">PLAZOS DEL PORTAFOLIO</p><h2>Desviación de días por proyecto</h2></div>
            <small>Valores negativos corresponden a atraso</small>
          </div>
          <div className="delay-grid">
            {data?.projects.map((project) => {
              const delay = delayPresentation(project.deviationDays);
              return (
                <button
                  type="button"
                  className={`delay-card ${delay.className}${project.id === data.selectedProjectId ? " selected" : ""}`}
                  key={project.id}
                  onClick={() => void selectProject(project.id)}
                >
                  <span>{project.name}</span>
                  <strong>{delay.value}</strong>
                  <small>{delay.label}</small>
                </button>
              );
            })}
          </div>
        </section>

        <section className="main-grid">
          <article className="panel selected-overview">
            <div className="panel-heading">
              <div><p className="eyebrow">OBRA SELECCIONADA</p><h2>{selected?.name ?? "Sin proyectos"}</h2></div>
              <span className="status-chip">Vigente</span>
            </div>
            <div className="overview-body">
              <ProgressRing value={selected?.cumulative ?? 0} />
              <div className="overview-stats">
                <div><span>Último control</span><strong>{formatDate(selected?.controlDate ?? null)}</strong></div>
                <div><span>Variación</span><strong className={(selected?.trend ?? 0) >= 0 ? "positive" : "negative"}>{(selected?.trend ?? 0) >= 0 ? "+" : ""}{selected?.trend.toFixed(1) ?? "0.0"} pp</strong></div>
                <div><span>Controles</span><strong>{selected?.controlCount ?? 0}</strong></div>
                <button className="detail-link" type="button" onClick={showActivities}>Ver actividades y recintos <ChevronIcon /></button>
              </div>
            </div>
          </article>

          <article className="panel trend-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">EVOLUCIÓN</p><h2>Avance acumulado</h2></div>
              <div className="legend"><span /><small>Avance real</small></div>
            </div>
            <TrendChart data={selected?.timeline ?? []} />
          </article>
        </section>

        <BuildingProgress
          data={data?.building ?? null}
          loading={loadingActivities || loadingBuilding}
          onActivityChange={(activity) => void selectBuildingActivity(activity)}
          onFinishingClick={showFinishing}
        />

        {showFinishingSummary ? (
          <section className="panel finishing-panel" ref={finishingSummaryRef}>
            <div className="panel-heading">
              <div><p className="eyebrow">AVANCE DE TERMINACIONES</p><h2>{selected?.name ?? "Obra seleccionada"}</h2></div>
              <button className="detail-link" type="button" onClick={showActivities}>Ver detalle <ChevronIcon /></button>
            </div>
            {finishingCount ? (
              <div className="finishing-summary">
                <div><span>{finishingActivities.length ? "Partidas registradas" : "Partidas críticas de terminaciones"}</span><strong>{finishingCount}</strong></div>
                <div><span>Avance promedio de partidas</span><strong>{formatPercent(finishingAverage)}</strong></div>
                <div><span>Partidas iniciadas</span><strong>{finishingStarted}</strong></div>
                <div><span>Partidas terminadas</span><strong>{finishingCompleted}</strong></div>
              </div>
            ) : <div className="chart-empty">No hay partidas de terminaciones registradas en el último control de esta obra.</div>}
          </section>
        ) : null}

        <section className="panel critical-route-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">RUTA CRÍTICA</p><h2>Partidas atrasadas</h2></div>
            <small>{selectedCriticalRoute.length ? `${selectedCriticalRoute.length} alertas relevantes` : "Sin atrasos informados"}</small>
          </div>
          {selectedCriticalRoute.length ? (
            <div className="critical-route-list">
              {selectedCriticalRoute.map((item) => (
                <article className="critical-route-item" key={`${item.chapter}-${item.activity}`}>
                  <div><span>{item.chapter}</span><strong>{item.activity}</strong></div>
                  <div><span>Programado</span><strong>{formatPercent(item.planned)}</strong></div>
                  <div><span>Real</span><strong>{formatPercent(item.actual)}</strong></div>
                  <div className="critical-deviation"><span>Desviación</span><strong>{item.deviation.toFixed(1)} pp</strong><small>Saldo desde {formatShortDate(item.balanceStart)}</small></div>
                </article>
              ))}
            </div>
          ) : <div className="chart-empty">Este proyecto no tiene una Ruta Crítica configurada o no registra atrasos en el último reporte.</div>}
        </section>

        <section className="lower-grid single-column">

          <article className="panel activities-panel" ref={activitiesPanelRef}>
            <div className="panel-heading activity-heading">
              <div><p className="eyebrow">DETALLE</p><h2>Actividades y recintos</h2></div>
              <label className="search-box"><SearchIcon /><input value={activitySearch} onChange={(event) => setActivitySearch(event.target.value)} placeholder="Buscar actividad" /></label>
            </div>
            <div className="filter-tabs">
              <button className={activityFilter === "all" ? "active" : ""} onClick={() => setActivityFilter("all")}>Todas</button>
              <button className={activityFilter === "critical" ? "active" : ""} onClick={() => setActivityFilter("critical")}>Bajo 50%</button>
              <button className={activityFilter === "complete" ? "active" : ""} onClick={() => setActivityFilter("complete")}>Completadas</button>
            </div>
            <div className="table-wrap">
              {loadingActivities ? <div className="activity-loading"><RefreshIcon className="spinning" /> Cargando detalle de la obra...</div> : null}
              <table>
                <thead><tr><th>Actividad</th><th>Recinto</th><th>Avance</th><th>Variación</th></tr></thead>
                <tbody>
                  {filteredActivities.slice(0, 100).map((activity, index) => (
                    <tr key={`${activity.id}-${activity.room}-${index}`} className={activity.chapter ? "chapter-row" : ""}>
                      <td><strong>{activity.name}</strong><small>{activity.code || activity.location}</small></td>
                      <td>{activity.room || (activity.chapter ? "Capítulo" : "-")}</td>
                      <td><div className="table-progress"><span><i style={{ width: `${Math.max(0, Math.min(100, activity.cumulative))}%` }} /></span><strong>{activity.cumulative.toFixed(1)}%</strong></div></td>
                      <td><span className={activity.variation >= 0 ? "positive" : "negative"}>{activity.variation >= 0 ? "+" : ""}{activity.variation.toFixed(1)} pp</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loadingActivities && !filteredActivities.length ? <div className="chart-empty">No hay actividades que coincidan con el filtro.</div> : null}
            </div>
          </article>
        </section>
        <footer>Fuente: API Foco en Obra · Información en modo lectura</footer>
      </div>
    </main>
  );
}

function LoadingDashboard() {
  return (
    <main className="dashboard-shell loading-shell">
      <header className="topbar"><div className="brand"><Image src="/logo-boetsch.png" width={82} height={90} alt="Boetsch" preload /></div></header>
      <div className="dashboard-content">
        <div className="skeleton heading-skeleton" />
        <div className="metrics-grid">{Array.from({ length: 4 }, (_, index) => <div className="skeleton metric-card" key={index} />)}</div>
        <div className="main-grid"><div className="skeleton panel" /><div className="skeleton panel" /></div>
      </div>
    </main>
  );
}
