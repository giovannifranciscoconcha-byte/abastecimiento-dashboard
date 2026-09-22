"use client";

import type { BuildingCell, BuildingProgressData } from "@/lib/types";
import { RefreshIcon } from "./icons";

function stateClass(value: number) {
  if (value >= 100) return "complete";
  if (value >= 70) return "high";
  if (value >= 25) return "active";
  if (value > 0) return "initial";
  return "pending";
}

function Cell({ cell, delayed }: { cell: BuildingCell; delayed: boolean }) {
  return (
    <div
      className={`building-cell ${delayed ? "initial" : stateClass(cell.progress)}`}
      title={`${cell.name}: ${cell.progress.toFixed(1)}%`}
    >
      <span>{cell.name}</span>
      <b>{cell.progress.toFixed(0)}%</b>
    </div>
  );
}

function ZoneRow({ label, cells, floorOrder, frontier }: {
  label: "L" | "M";
  cells: BuildingCell[];
  floorOrder: number;
  frontier: number;
}) {
  return (
    <>
      <span className="zone-label">{label}</span>
      <div className="building-cells">
        {cells.length
          ? cells.map((cell) => (
              <Cell
                cell={cell}
                delayed={cell.progress === 0 && floorOrder <= frontier + 1}
                key={`${cell.id}-${cell.name}`}
              />
            ))
          : <div className="building-cell pending empty-cell"><b>0%</b></div>}
      </div>
    </>
  );
}

export function BuildingProgress({ data, loading, onActivityChange }: {
  data: BuildingProgressData | null;
  loading: boolean;
  onActivityChange: (activity: string) => void;
}) {
  return (
    <article className="panel building-panel">
      <div className="panel-heading building-heading">
        <div>
          <p className="eyebrow">AVANCE GRÁFICO</p>
          <h2>Estructura por torre y piso</h2>
          <p className="panel-copy">Cada bloque representa un frente real de losa o muro informado en el último control.</p>
        </div>
        {data?.activityOptions.length ? (
          <label className="activity-select">
            <span>Actividad</span>
            <select value={data.activity} onChange={(event) => onActivityChange(event.target.value)} disabled={loading}>
              {data.activityOptions.map((activity) => <option key={activity} value={activity}>{activity}</option>)}
            </select>
          </label>
        ) : null}
      </div>

      <div className="building-legend" aria-label="Leyenda de avance">
        <span><i className="complete" />100% completado</span>
        <span><i className="high" />70% a 99%</span>
        <span><i className="active" />25% a 69%</span>
        <span><i className="initial" />Atraso en frente activo</span>
        <span><i className="pending" />Próxima etapa</span>
      </div>

      {loading && !data ? (
        <div className="building-loading"><RefreshIcon className="spinning" /> Construyendo gráfico desde la API...</div>
      ) : data?.towers.length ? (
        <div className={`building-scroll ${loading ? "is-loading" : ""}`}>
          {loading ? <div className="building-overlay"><RefreshIcon className="spinning" /> Actualizando actividad</div> : null}
          <div className="tower-list">
            {data.towers.map((tower) => {
              const wallFrontier = Math.max(-99, ...tower.floors.filter((floor) => floor.walls.some((cell) => cell.progress > 0)).map((floor) => floor.order));
              const slabFrontier = Math.max(-99, ...tower.floors.filter((floor) => floor.slabs.some((cell) => cell.progress > 0)).map((floor) => floor.order));
              return (
                <section className="tower" key={tower.key}>
                  <div className="tower-title">
                    <span>{tower.name}</span>
                    <small>{data.activity}</small>
                  </div>
                  <div className="tower-body">
                    {tower.floors.map((floor) => {
                      return (
                        <div className="tower-floor" key={floor.key}>
                          <strong className="floor-label">{floor.label}</strong>
                          <ZoneRow label="L" cells={floor.slabs} floorOrder={floor.order} frontier={slabFrontier} />
                          <ZoneRow label="M" cells={floor.walls} floorOrder={floor.order} frontier={wallFrontier} />
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="chart-empty">Esta obra todavía no tiene una estructura de torres, pisos, losas y muros disponible en la API.</div>
      )}
    </article>
  );
}
