import type { BrainStatus, DemGrid, GeologyFeature, LabAnalysis, LabAnalysisListItem, SpaceWeather, Hazard, Obstacle, PlanOptions, RegionMeta, RegionSummary, RouteResponse, Site } from './missionTypes';

export const API_BASE =
  typeof window === 'undefined'
    ? process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000'
    : '';

export function getApiDisplayBase(): string {
  return typeof window === 'undefined' ? API_BASE : window.location.origin;
}

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  regions: () => j<RegionSummary[]>('/api/regions'),
  region: (id: string) => j<RegionMeta>(`/api/regions/${id}`),
  sites: (id: string) => j<Site[]>(`/api/regions/${id}/sites`),
  hazards: (id: string) => j<Hazard[]>(`/api/regions/${id}/hazards`),
  geology: (id: string) => j<GeologyFeature[]>(`/api/regions/${id}/geology`),
  dem: (id: string, size = 64) => j<DemGrid>(`/api/regions/${id}/dem?size=${size}`),
  spaceWeather: () => j<SpaceWeather>('/api/space-weather'),
  // ---- Research Lab ------------------------------------------------------
  brain: () => j<BrainStatus>('/api/brain'),
  setBrainTier: (tier: number) => j<BrainStatus>('/api/brain/tier', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier }),
  }),
  analyzeImage: (file: File, meta: { sol?: string; instrument?: string; lat?: string; lon?: string; note?: string }) => {
    const fd = new FormData();
    fd.append('image', file);
    for (const [k, v] of Object.entries(meta)) if (v) fd.append(k, v);
    return j<LabAnalysis>('/api/analyze-image', { method: 'POST', body: fd });
  },
  analyses: () => j<LabAnalysisListItem[]>('/api/analyses'),
  analysis: (id: string) => j<LabAnalysis>(`/api/analyses/${id}`),
  bundleUrl: (id: string) => `${API_BASE}/api/analyses/${id}/bundle`,
  route: (body: {
    region_id: string;
    start: { lat: number; lon: number };
    goal_site_id?: string;
    goal?: { lat: number; lon: number };
    obstacles: Obstacle[];
  } & Partial<PlanOptions>) =>
    j<RouteResponse>('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, obstacles: body.obstacles.map((o) => ({ ...o, name: o.name ?? 'user obstacle' })) }),
    }),
  assetUrl: (path: string) => (path.startsWith('http') ? path : `${API_BASE}${path}`),
};
