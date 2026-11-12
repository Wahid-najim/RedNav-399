// Shapes returned by the FastAPI backend (see docs/API_SPEC.md). Keep in sync with backend/app/main.py.
export type Nature = 'static' | 'historical' | 'current' | 'predicted';

export interface LayerProvenance {
  kind: string;
  name: string;
  mission: string;
  instrument: string;
  product: string;
  resolution_m: number;
  acquired: string;
  nature: Nature;
  source_url: string;
  limitation: string;
}

export interface BangladeshInfo {
  name: string;
  diameter_km: number;
  approved: string;
  named_after: string;
  gazetteer: string;
  crater_center?: { lat: number; lon: number };
}

export interface RegionSummary {
  id: string;
  name: string;
  role: 'primary' | 'bangladesh' | 'demo' | string;
  center: { lat: number; lon: number };
  synthetic?: boolean;
  bangladesh?: BangladeshInfo | null;
  coord_status?: string;
}

export interface DemGrid {
  rows: number;
  cols: number;
  min_m: number;
  max_m: number;
  grid: {
    north_lat: number;
    south_lat: number;
    west_lon: number;
    east_lon: number;
    width: number;
    height: number;
    cell_m: number;
  };
  elev_m: number[][];
}

export interface RegionMeta extends RegionSummary {
  synthetic?: boolean;
  science_goal: string;
  coord_status: string;
  grid: { width: number; height: number; cell_m: number; north_lat: number; west_lon: number };
  layers: LayerProvenance[];
  warnings: string[];
  defaults: {
    max_slope_deg: number;
    caution_slope_deg: number;
    walk_speed_ms: number;
    load_factor: number;
    science_stop_min: number;
  };
  layer_urls: Partial<Record<LayerName, string>>;
  suit_assumptions?: { o2_capacity_min: number; o2_reserve_pct: number; o2_slope_factor_per_deg: number; o2_load_weight: number; o2_stop_factor: number };
  crs?: { coordinates: string; body_radius_m: number; grid: string; alignment: string };
  stats: { elev_min_m: number; elev_max_m: number; slope_max_deg: number; nodata_pct: number };
}

export type LayerName = 'imagery' | 'hillshade' | 'slope' | 'hazard' | 'chemical';

export interface PovImage {
  url: string;
  rover: string;
  camera: string;
  sol: string;
  earth_date: string;
  credit: string;
  source_url: string;
}

export interface Site {
  id: string;
  name: string;
  /** null when no published coordinates exist (Bright Angel, Cheyava
   *  Falls, Broom Point) — NEVER plot these as markers or route targets. */
  lat: number | null;
  lon: number | null;
  location_not_published?: boolean;
  goal: string;
  description: string;
  mission: string;
  observed: string;
  source_url: string;
  pov_images: PovImage[];
  geology?: string;
  science_purpose?: string;
  chemistry?: string;
  chem_index?: number | null;
}

export interface GeologyFeature {
  id: string;
  name: string;
  type: string;
  polygon: [number, number][];
  description: string;
  synthetic?: boolean;
}

export interface OxygenBudget {
  capacity_min_baseline: number;
  walk_used_pct: number;
  stop_used_pct: number;
  one_way_used_pct: number;
  remaining_on_arrival_pct: number;
  round_trip_used_pct: number;
  remaining_after_return_pct: number;
  reserve_pct: number;
  one_way_ok: boolean;
  round_trip_ok: boolean;
  assumption: string;
}

export interface RadiationEstimate {
  dose_rate_usv_per_h: number;
  estimated_dose_usv: number;
  planning_limit_usv: number;
  within_limit: boolean;
  synthetic: boolean;
  assumption: string;
}

export interface Insight {
  level: 'ok' | 'info' | 'warning' | 'critical';
  kind: string;
  text: string;
}

export interface RouteExplanation {
  data_used: { kind: string; name: string; mission: string; instrument: string; resolution_m: number; synthetic: boolean; effect: string }[];
  obstacles: {
    near_route: { name: string; type: string; radius_m: number; route_clearance_m: number; reason: string; source_url: string }[];
    blocked_steep_cells: number;
    blocked_pct_of_region: number;
    no_data_cells: number;
    note: string;
  };
  science_destination: {
    id: string; name: string; goal: string; description: string; lat: number; lon: number; elev_m: number | null; slope_deg: number | null;
    mission: string; observed: string; source_url: string; geology?: string; chemical_index: number | null; chemical_status: string;
    rover_photos: number; scientific_purpose: string;
  };
  why_alternatives: { strategy: string; found: boolean; why: string; delta_distance_m?: number; delta_max_slope_deg?: number; delta_mission_min?: number; oxygen_round_trip_ok?: boolean }[];
  evidence: { decision: string; evidence: string[] }[];
  missing_data: string[];
  route_statement: string;
  insights: Insight[];
}

export interface NearbyScience {
  id: string;
  name: string;
  reachable: boolean;
  lat?: number;
  lon?: number;
  extra_distance_m?: number;
  extra_time_min?: number;
  why_interesting: string;
  geology?: string;
  chemical_index?: number | null;
  considerations?: string[];
  note?: string;
  method?: string;
}

export interface SpaceWeather {
  source: string;
  synthetic: boolean;
  dose_rate_usv_per_h: number;
  planning_limit_usv: number;
  solar_activity: { level: string; events: { class: string; begin: string; peak: string; link: string }[] };
  safety_context: string[];
  how_to_go_live?: string;
  live_error?: string;
}

export interface Hazard {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radius_m: number;
  reason: string;
  source_url: string;
}

export interface Obstacle {
  lat: number;
  lon: number;
  radius_m: number;
  name?: string;
}

export interface RoutePoint {
  x: number;
  y: number;
  lat: number;
  lon: number;
  elev_m: number;
  slope_deg: number;
  t_min?: number;
  o2_used_pct?: number;
}

export interface RouteResult {
  strategy: 'balanced' | 'safest' | 'shortest_feasible';
  found: boolean;
  points?: RoutePoint[];
  distance_m?: number;
  max_slope_deg?: number;
  mean_slope_deg?: number;
  elev_gain_m?: number;
  walk_time_min?: number;
  mission_time_min?: number;
  reasons?: string[];
  assumptions?: Record<string, number>;
  safety?: { oxygen: OxygenBudget; radiation: RadiationEstimate };
  explanation?: RouteExplanation;
}

export interface RouteResponse {
  region_id: string;
  routes: RouteResult[];
  nearby_science: NearbyScience[];
  insights: Insight[];
  direct_line?: { cells: number; max_slope_deg: number | null; over_limit: number; over_caution: number; no_data: number; hazard_cells: number };
  warnings: string[];
  disclaimer: string;
}

export interface PlanOptions {
  max_slope_deg: number;
  caution_slope_deg: number;
  walk_speed_ms: number;
  load_factor: number;
  science_stop_min: number;
}

// ---- Research Lab (POST /api/analyze-image contract) -------------------
export interface LabMeasurement {
  name: string;
  value: number | string;
  unit: string;
  method: string;
  uncertainty: string;
  plain?: string;
}

export interface LabMatch {
  name: string;
  score: number;
  metric: string;
  shared_properties: string[];
  archive_ref: string;
  plain?: string;
}

export interface LabHypothesis {
  text: string;
  supporting_measurements: string[];
  citation: { author: string; year: number | string; title: string; source_file: string };
  confidence: string;
  plain?: string;
}

export interface LabAction {
  rank: number;
  action: string;
  cost: string;
  expected_value: string;
  cost_unknown: boolean;
}

export interface LabAnalysis {
  id: string;
  created_at: string;
  filename: string;
  sha256: string;
  width: number | null;
  height: number | null;
  metadata: { sol: string | null; instrument: string | null; lat: string | null; lon: string | null; note: string | null };
  tier: number;
  brain: string;
  measurements: LabMeasurement[];
  matches: LabMatch[];
  novelty: { score_sigma: number; population: string; n: number; method: string; plain: string };
  hypotheses: LabHypothesis[];
  actions: LabAction[];
  unknowns: string[];
  pattern_finder: { pairs: { a: string; b: string; count: number; expected: number; note: string }[]; label: string };
  plain_summary: string;
  mock?: boolean;
}

export interface LabAnalysisListItem {
  id: string;
  created_at: string;
  filename: string;
  tier: number;
}

export interface BrainStatus {
  tier: number;
  brain: string;
  model: string;
  ram_mb: number | null;
  available: boolean;
}
