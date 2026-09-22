import type { ProjectSummary, TimelinePoint } from "@/lib/types";

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function ProgressRing({ value, size = 116 }: { value: number; size?: number }) {
  const normalized = clamp(value);
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalized / 100) * circumference;
  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" role="img" aria-label={`${normalized.toFixed(1)}% de avance`}>
        <circle className="ring-track" cx="50" cy="50" r={radius} />
        <circle
          className="ring-value"
          cx="50"
          cy="50"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span>{normalized.toFixed(1)}%</span>
    </div>
  );
}

function compactDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", { month: "short", year: "2-digit", timeZone: "UTC" })
    .format(new Date(value))
    .replace(" de ", " ");
}

export function TrendChart({ data }: { data: TimelinePoint[] }) {
  if (!data.length) return <div className="chart-empty">Esta obra todavía no registra controles de avance.</div>;
  const width = 760;
  const height = 260;
  const pad = { left: 46, right: 18, top: 18, bottom: 40 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const x = (index: number) => pad.left + (index / Math.max(1, data.length - 1)) * plotWidth;
  const y = (value: number) => pad.top + (1 - clamp(value) / 100) * plotHeight;
  const line = data.map((point, index) => `${x(index)},${y(point.cumulative)}`).join(" ");
  const area = `${pad.left},${pad.top + plotHeight} ${line} ${x(data.length - 1)},${pad.top + plotHeight}`;
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div className="trend-chart" role="img" aria-label="Evolución del avance acumulado">
      <svg viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f28b30" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#f28b30" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className="grid-line" />
            <text x={pad.left - 10} y={y(tick) + 4} textAnchor="end" className="axis-text">{tick}%</text>
          </g>
        ))}
        <polygon points={area} fill="url(#areaGradient)" />
        <polyline points={line} className="trend-line" />
        {data.map((point, index) => (
          <g key={`${point.id}-${point.date}`}>
            <circle cx={x(index)} cy={y(point.cumulative)} r="5" className="trend-dot" />
            {(index % labelEvery === 0 || index === data.length - 1) && (
              <text x={x(index)} y={height - 12} textAnchor="middle" className="axis-text">
                {compactDate(point.date)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

export function ProjectBars({ projects, selectedId, onSelect }: {
  projects: ProjectSummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  if (!projects.length) return <div className="chart-empty">No hay proyectos vigentes para mostrar.</div>;
  return (
    <div className="project-bars">
      {projects.map((project) => (
        <button
          type="button"
          key={project.id}
          className={`project-bar-row ${selectedId === project.id ? "selected" : ""}`}
          onClick={() => onSelect(project.id)}
        >
          <span className="project-bar-label" title={project.name}>{project.name}</span>
          <span className="project-bar-track">
            <span className="project-bar-fill" style={{ width: `${clamp(project.cumulative)}%` }} />
          </span>
          <strong>{project.cumulative.toFixed(1)}%</strong>
        </button>
      ))}
    </div>
  );
}
