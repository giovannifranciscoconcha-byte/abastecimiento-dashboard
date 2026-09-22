export type TimelinePoint = {
  id: number;
  date: string;
  status: string;
  cumulative: number;
  period: number;
};

export type ProjectSummary = {
  id: number;
  name: string;
  status: number;
  cumulative: number;
  period: number;
  controlDate: string | null;
  trend: number;
  deviationDays: number | null;
  controlCount: number;
  timeline: TimelinePoint[];
  warning?: string;
};

export type ActivityDetail = {
  id: number;
  code: string;
  name: string;
  unit: string;
  chapter: boolean;
  level: number;
  cumulative: number;
  previous: number;
  variation: number;
  room: string;
  location: string;
};

export type BuildingCell = {
  id: number;
  name: string;
  progress: number;
};

export type BuildingFloor = {
  key: string;
  label: string;
  order: number;
  walls: BuildingCell[];
  slabs: BuildingCell[];
};

export type BuildingTower = {
  key: string;
  name: string;
  floors: BuildingFloor[];
};

export type BuildingProgressData = {
  activity: string;
  activityOptions: string[];
  towers: BuildingTower[];
};

export type DashboardPayload = {
  generatedAt: string;
  projects: ProjectSummary[];
  selectedProjectId: number | null;
  activities: ActivityDetail[];
  building: BuildingProgressData | null;
};
