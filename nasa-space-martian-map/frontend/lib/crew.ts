'use client';

import { bearingDeg, offsetM } from './geo';
import type { Site } from './missionTypes';
import { isInResearchPond, RESEARCH_POND } from './researchPond';

const MARS_RADIUS_M = 3_396_190;
const D2R = Math.PI / 180;

export interface CrewMemberDef {
  id: string;
  firstName: string;
  role: string;
  /** Short field tasks shown outside the Pod. */
  tasks: string[];
  /** Task shown during scheduled Science Pod lab work. */
  podTask: string;
  /** Accent hex color on map pins, rail badge, and 3D suit trim (warm red/amber/rose family). */
  color: string;
  /** Site IDs defining their continuous loop path (including returning to Octavia Butler Landing / Pod). */
  routeSiteIds: string[];
  /** Loop cycle duration in wall-clock seconds. */
  periodSec: number;
  /** Phase offset [0..1) so crewmates don't bunch together. */
  phase: number;
  /** Portion of cycle spent working outdoors before rotating through the Science Pod. */
  outdoorFraction: number;
  /** Optional local patrol radius in metres when only 1 site is listed. */
  patrolRadiusM?: number;
  /** Lateral offset away from site-to-site centerlines so they keep off main trails. */
  lateralBiasM?: number;
  /** Greeting spoken when the player comes within range. */
  greeting: string;
}

/**
 * Single editable list of non-player Martian crewmates.
 * Edit names, roles, tasks, patrol sites, or colors right here.
 */
export const CREW_ROSTER: CrewMemberDef[] = [
  {
    id: 'crew-amara',
    firstName: 'Amara',
    role: 'Geologist',
    tasks: ['In Research Pond — sampling dry lakebed', 'Logging carbonate mudstone', 'Inspecting delta outcrops'],
    podTask: 'In the Pod — Sample Lab',
    color: '#fbbf24',
    routeSiteIds: ['delta_front', 'western_delta', 'delta_front', 'octavia_butler_landing'],
    periodSec: 46,
    phase: 0.04,
    outdoorFraction: 0.78,
    lateralBiasM: 110,
    greeting: 'Sampling in the Research Pond — dry lakebed mudstone! Taking cores to the Pod!',
  },
  {
    id: 'crew-jonas',
    firstName: 'Jonas',
    role: 'Engineer',
    tasks: ['Checking Research Pond beacons', 'Testing EVA beacons', 'Inspecting solar arrays'],
    podTask: 'In the Pod — Oxygen Plant',
    color: '#E5484D',
    routeSiteIds: ['delta_front', 'octavia_butler_landing'],
    periodSec: 38,
    phase: 0.56,
    outdoorFraction: 0.72,
    patrolRadiusM: 135,
    lateralBiasM: 75,
    greeting: 'Pond perimeter beacons & MOXIE seals look clean — safe walk!',
  },
  {
    id: 'crew-priya',
    firstName: 'Priya',
    role: 'Rover Driver',
    tasks: ['Dropping rover gear near Pond', 'Scouting delta front', 'Mapping boulder pass'],
    podTask: 'In the Pod — Map Table',
    color: '#fb923c',
    routeSiteIds: ['delta_front', 'kodiak', 'octavia_butler_landing'],
    periodSec: 54,
    phase: 0.28,
    outdoorFraction: 0.84,
    lateralBiasM: -120,
    greeting: 'Parking Perseverance right near the Research Pond edge before Kodiak run!',
  },
];

export interface LiveCrewMember {
  id: string;
  firstName: string;
  role: string;
  label: string;
  task: string;
  color: string;
  lat: number;
  lon: number;
  headingDeg: number;
  distToPlayerM: number | null;
  nearPlayer: boolean;
  inPod: boolean;
  inPond: boolean;
  greeting: string;
}

function addMetersToLatLon(lat: number, lon: number, eastM: number, southM: number) {
  const dLat = -southM / (MARS_RADIUS_M * D2R);
  const cosLat = Math.max(0.2, Math.cos(lat * D2R));
  const dLon = eastM / (MARS_RADIUS_M * cosLat * D2R);
  return { lat: lat + dLat, lon: lon + dLon };
}

function buildLoopWaypoints(member: CrewMemberDef, sites: Site[]): { lat: number; lon: number }[] {
  const byId = new Map(sites.filter((s) => s.lat != null && s.lon != null).map((s) => [s.id, s]));
  const pts = member.routeSiteIds
    .map((id) => byId.get(id))
    .filter((s): s is Site & { lat: number; lon: number } => Boolean(s && s.lat != null && s.lon != null))
    .map((s) => ({ lat: s.lat, lon: s.lon }));

  if (pts.length === 0) return [];
  if (pts.length === 1) {
    const c = pts[0];
    const r = member.patrolRadiusM ?? 130;
    return [
      addMetersToLatLon(c.lat, c.lon, r, -r * 0.4),
      addMetersToLatLon(c.lat, c.lon, r * 0.6, r),
      addMetersToLatLon(c.lat, c.lon, -r, r * 0.4),
      addMetersToLatLon(c.lat, c.lon, -r * 0.6, -r),
    ];
  }
  return pts;
}

function sampleClosedLoop(
  waypoints: { lat: number; lon: number }[],
  tNorm: number,
  lateralBiasM: number
): { lat: number; lon: number; headingDeg: number } {
  const n = waypoints.length;
  const scaled = (((tNorm % 1) + 1) % 1) * n;
  const idx = Math.floor(scaled) % n;
  const nextIdx = (idx + 1) % n;
  const frac = scaled - Math.floor(scaled);

  const a = waypoints[idx];
  const b = waypoints[nextIdx];
  const { dx, dy } = offsetM(a.lat, a.lon, b.lat, b.lon);
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const baseLat = a.lat + (b.lat - a.lat) * frac;
  const baseLon = a.lon + (b.lon - a.lon) * frac;
  const shifted = addMetersToLatLon(baseLat, baseLon, nx * lateralBiasM, ny * lateralBiasM);
  return {
    lat: shifted.lat,
    lon: shifted.lon,
    headingDeg: bearingDeg(dx, dy),
  };
}

/**
 * Computes continuous wall-clock positions for all crewmates, including periodic shifts
 * inside the Science Pod at Octavia E. Butler Landing Site.
 */
export function computeCrewStates(
  sites: Site[],
  playerPos: { lat: number; lon: number } | null,
  routePoints: { lat: number; lon: number }[] | null,
  nowMs: number = Date.now()
): LiveCrewMember[] {
  const nowSec = nowMs / 1000;
  const podSite = sites.find((s) => s.id === 'octavia_butler_landing' && s.lat != null && s.lon != null);
  const results: LiveCrewMember[] = [];

  for (const def of CREW_ROSTER) {
    const waypoints = buildLoopWaypoints(def, sites);
    if (waypoints.length === 0) continue;

    const cycleT = ((nowSec / def.periodSec) + def.phase) % 1;
    const inPod = Boolean(podSite && cycleT >= def.outdoorFraction);

    let lat: number;
    let lon: number;
    let heading = 0;

    if (inPod && podSite && podSite.lat != null && podSite.lon != null) {
      // Dock cleanly beside the Science Pod at landing site
      const slotOffset = def.phase * 140 - 70;
      const docked = addMetersToLatLon(podSite.lat, podSite.lon, 55, slotOffset * 0.4);
      lat = docked.lat;
      lon = docked.lon;
    } else {
      const outdoorT = cycleT / Math.max(0.1, def.outdoorFraction);
      const sample = sampleClosedLoop(waypoints, outdoorT, def.lateralBiasM ?? 90);
      lat = sample.lat;
      lon = sample.lon;
      heading = sample.headingDeg;

      // Keep off the planned route corridor (~70 m clearance)
      if (routePoints && routePoints.length > 0) {
        const stride = Math.max(1, Math.floor(routePoints.length / 40));
        let minDist = Infinity;
        let nearestDx = 0;
        let nearestDy = 0;
        for (let i = 0; i < routePoints.length; i += stride) {
          const rp = routePoints[i];
          const { dx, dy } = offsetM(rp.lat, rp.lon, lat, lon);
          const d = Math.hypot(dx, dy);
          if (d < minDist) {
            minDist = d;
            nearestDx = dx;
            nearestDy = dy;
          }
        }
        if (minDist < 70) {
          const len = Math.max(1, minDist);
          const push = 75 - minDist;
          const nudged = addMetersToLatLon(lat, lon, (nearestDx / len) * push, (nearestDy / len) * push);
          lat = nudged.lat;
          lon = nudged.lon;
        }
      }

      // Personal clearance from player marker
      if (playerPos) {
        const { dx, dy } = offsetM(playerPos.lat, playerPos.lon, lat, lon);
        const d = Math.hypot(dx, dy);
        if (d < 45) {
          const len = Math.max(1, d);
          const push = 48 - d;
          const nudged = addMetersToLatLon(lat, lon, (dx / len) * push, (dy / len) * push);
          lat = nudged.lat;
          lon = nudged.lon;
        }
      }
    }

    const distToPlayerM = playerPos
      ? Math.round(
          Math.hypot(
            offsetM(playerPos.lat, playerPos.lon, lat, lon).dx,
            offsetM(playerPos.lat, playerPos.lon, lat, lon).dy
          )
        )
      : null;

    const inPond = !inPod && isInResearchPond(lat, lon);
    const taskIdx = Math.floor(nowSec / 18 + def.phase * 10) % def.tasks.length;
    const label = inPod
      ? `${def.firstName} — in the Pod`
      : inPond
      ? `${def.firstName} — in Research Pond`
      : `${def.firstName} — ${def.role}`;
    const task = inPod
      ? def.podTask
      : inPond
      ? `${def.id === 'crew-amara' ? 'Sampling Research Pond mudstone' : def.id === 'crew-jonas' ? 'Checking Pond beacons' : 'Driving rover by Pond'} (${RESEARCH_POND.honestyTitle.split(' — ')[0]})`
      : def.tasks[taskIdx];

    results.push({
      id: def.id,
      firstName: def.firstName,
      role: def.role,
      label,
      task,
      color: def.color,
      lat,
      lon,
      headingDeg: heading,
      distToPlayerM,
      nearPlayer: distToPlayerM != null && distToPlayerM <= 260,
      inPod,
      inPond,
      greeting: def.greeting,
    });
  }

  // Guarantee the Research Pond always has at least one active outdoor crewmate inspecting it
  if (results.length > 0 && !results.some((r) => r.inPond)) {
    const worker =
      results.find((r) => r.id === 'crew-amara' && !r.inPod) ??
      results.find((r) => !r.inPod);
    if (worker) {
      const orbitA = (nowSec * 0.14 + (worker.id === 'crew-jonas' ? 2 : 0)) % (Math.PI * 2);
      const orbitPos = addMetersToLatLon(RESEARCH_POND.lat, RESEARCH_POND.lon, Math.cos(orbitA) * 180, Math.sin(orbitA) * 160);
      worker.lat = orbitPos.lat;
      worker.lon = orbitPos.lon;
      worker.inPond = true;
      worker.label = `${worker.firstName} — in Research Pond`;
      worker.task = worker.id === 'crew-amara' ? 'Sampling dry lakebed mudstone' : 'Checking Research Pond beacons';
      worker.distToPlayerM = playerPos
        ? Math.round(
            Math.hypot(
              offsetM(playerPos.lat, playerPos.lon, worker.lat, worker.lon).dx,
              offsetM(playerPos.lat, playerPos.lon, worker.lat, worker.lon).dy
            )
          )
        : null;
      worker.nearPlayer = worker.distToPlayerM != null && worker.distToPlayerM <= 260;
    }
  }

  return results;
}
