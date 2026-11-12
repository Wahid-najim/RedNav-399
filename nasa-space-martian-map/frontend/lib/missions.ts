/**
 * Missions, XP and ranks (§6). XP is earned ONLY from real,
 * verifiable in-app actions, and every XP event is logged with its
 * cause. No leaderboard, no multiplayer, no fake players.
 */

export interface MissionDef {
  id: string;
  num: string;
  title: string;
  /** Plain English first: what you are doing and why it matters. */
  briefingPlain: string;
  /** Science detail second. */
  briefingScience: string;
  goalSiteId: string | null;
  objectives: string[];
  xpReward: number;
}

export const MISSIONS: MissionDef[] = [
  {
    id: 'm1_first_light', num: 'MISSION 1', title: 'FIRST LIGHT',
    briefingPlain: 'Walk from home base to the Western Delta, where the old river met the lake. This is your first real walk on Mars.',
    briefingScience: 'Plan a route from Octavia E. Butler Landing (18.4446°N, 77.4509°E) to the Western Delta (18.4550°N, 77.3750°E) and walk it in the HUD sim. Delta sediments carry carbonate 3–9 wt% (Upper Fan).',
    goalSiteId: 'western_delta',
    objectives: ['Plan a route to the Western Delta', 'Walk the whole route in the helmet HUD'],
    xpReward: 100,
  },
  {
    id: 'm2_kodiak', num: 'MISSION 2', title: 'KODIAK',
    briefingPlain: 'Reach Kodiak, the lone hill left behind when the delta washed away, and read what its rock is made of.',
    briefingScience: 'Reach Kodiak (18.4124°N, 77.3820°E, representative elevation −2,510 m) in the HUD sim and open its chemistry: carbonate 3–9 wt% (Upper Fan, Clavé et al. 2026).',
    goalSiteId: 'kodiak',
    objectives: ['Walk to Kodiak in the helmet HUD', 'Read Kodiak’s chemistry'],
    xpReward: 150,
  },
  {
    id: 'm3_biosignature', num: 'MISSION 3', title: 'THE POTENTIAL BIOSIGNATURE',
    briefingPlain: 'Take a photo of a rock to the Research Lab and let the instrument measure it. Your target is the Cheyava Falls rock — but remember, it is a potential biosignature, not proof of life.',
    briefingScience: 'Run an analysis in the Research Lab. Cheyava Falls: 1.0 × 0.6 m rock, sol 1212, Sapphire Canyon core sol 1215, 6.2 cm. POTENTIAL biosignature only (Nature-validated Sept 2025) — never "life found".',
    goalSiteId: 'cheyava_falls',
    objectives: ['Upload a rock photo in the Research Lab', 'Run the analysis and read the results'],
    xpReward: 150,
  },
  {
    id: 'm4_rimwalk', num: 'MISSION 4', title: 'RIMWALK',
    briefingPlain: 'Head for the high rim of the crater and read the record of Broom Point — the oldest rock in this whole story. Broom Point has no published coordinates, so this mission is about planning toward the rim and reading its record, not reaching a dot on the map.',
    briefingScience: 'Plan a route toward the rim zone and open the Broom Point record (outer rim, >3.9 Ga, 75 m stack of 6 rock types, strata tilted 80°+). Broom Point has no published lat/lon — it is never plotted as a marker.',
    goalSiteId: null,
    objectives: ['Plan a route toward the rim zone', 'Read the Broom Point record'],
    xpReward: 150,
  },
];

export const RANKS = [
  { name: 'Rookie', minXp: 0 },
  { name: 'Surveyor', minXp: 100 },
  { name: 'Pathfinder', minXp: 300 },
  { name: 'Veteran', minXp: 600 },
  { name: 'Legend of Jezero', minXp: 1000 },
] as const;

export function rankForXp(xp: number): string {
  let rank: string = RANKS[0].name;
  for (const r of RANKS) if (xp >= r.minXp) rank = r.name;
  return rank;
}

export function nextRankForXp(xp: number): { name: string; minXp: number } | null {
  return RANKS.find((r) => r.minXp > xp) ?? null;
}

/** XP rules — all from real in-app actions. */
export const XP_RULES = {
  /** Per 100 m actually walked in the HUD sim. */
  per100mWalked: 10,
  per10mClimb: 5,
  siteReached: 50,
  sampleCollected: 40,
  analysisCompleted: 60,
  zoneVisited: 25,
} as const;

export function xpForWalk(distanceM: number, elevGainM: number): number {
  return Math.round(distanceM / 100) * XP_RULES.per100mWalked + Math.round(elevGainM / 10) * XP_RULES.per10mClimb;
}

/** Hazard level from REAL slope + hazard data on the current route. */
export function hazardLevel(maxSlopeDeg: number | null, cautionDeg: number, maxDeg: number, nearHazard: boolean): { level: 'LOW' | 'CAUTION' | 'HIGH'; plain: string } {
  if (maxSlopeDeg == null) return { level: 'LOW', plain: 'No slope data for this route yet — hazard level unknown, not assumed low.' };
  if (maxSlopeDeg >= maxDeg || nearHazard) return { level: 'HIGH', plain: `Steepest slope ${maxSlopeDeg.toFixed(1)}° reaches the ${maxDeg}° no-go limit, or the route passes a marked hazard. The route goes around what it cannot cross.` };
  if (maxSlopeDeg >= cautionDeg) return { level: 'CAUTION', plain: `Steepest slope ${maxSlopeDeg.toFixed(1)}° is past the ${cautionDeg}° caution line but under the ${maxDeg}° limit. Walk carefully here.` };
  return { level: 'LOW', plain: `Steepest slope ${maxSlopeDeg.toFixed(1)}° is under the ${cautionDeg}° caution line. Nothing on this route stands out in the slope data.` };
}
