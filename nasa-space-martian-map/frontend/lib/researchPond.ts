'use client';

import { offsetM } from './geo';

const MARS_RADIUS_M = 3_396_190;
const D2R = Math.PI / 180;

function addNorthEastM(lat: number, lon: number, dNorthM: number, dEastM: number): { lat: number; lon: number } {
  const dLat = dNorthM / (MARS_RADIUS_M * D2R);
  const cosLat = Math.max(0.2, Math.cos(lat * D2R));
  const dLon = dEastM / (MARS_RADIUS_M * cosLat * D2R);
  return { lat: lat + dLat, lon: lon + dLon };
}

/**
 * The Research Pond (§11): a closed field research zone anchored strictly
 * at the real Delta Front site in Jezero Crater (18.441° N, 77.412° E, Z2),
 * where the ancient river met the lake.
 *
 * Honesty note: Mars has NO liquid water in Jezero Crater today. The Pond is a
 * DRY ancient lakebed and our perimeter beacons mark an exploration game boundary,
 * not a physical fence on Mars.
 */

export const CURRENT_SIM_SOL = 1212;

export const RESEARCH_POND = {
  id: 'research_pond',
  anchorSiteId: 'delta_front',
  name: 'Research Pond',
  juniorName: 'Old Lakebed Pond',
  /** Exact published coordinates from data/processed/jezero_delta/sites.json (delta_front). */
  lat: 18.441,
  lon: 77.412,
  /** Radius in metres defining the marked dry-lakebed exploration boundary. */
  radiusM: 450,
  honestyTitle: 'Dry ancient lakebed today — zero liquid water',
  honestyDetail:
    'Anchored at Delta Front (18.441° N, 77.412° E). Zero liquid water exists in Jezero today — perimeter beacons mark our game exploration zone, not a real fence.',
  juniorSubtitle: 'The old pond where the water used to be — completely dry mud and rock today!',
  juniorPercyLine: 'The water is gone, but the mud remembers it.',
} as const;

export interface PondSpot {
  id: string;
  name: string;
  rockType: string;
  plain: string;
  juniorPlain: string;
  chemistry: string;
  source: string;
  /** Metric offset (dNorthM, dEastM) from RESEARCH_POND (18.441, 77.412), well inside radiusM=450 m. */
  dNorthM: number;
  dEastM: number;
}

export const POND_SPOTS: PondSpot[] = [
  {
    id: 'pond_carbonate_mudstone',
    name: 'Carbonate Mudstone',
    rockType: 'Mg-Fe Carbonate Lakebed Crust',
    plain: 'Pale carbonate-rich mudstone precipitated from shallow standing water along the delta lakebed.',
    juniorPlain: 'Rocky crust formed when minerals dried out of ancient lake water!',
    chemistry: 'Carbonate 3–9 wt% (Upper Fan) / 6–16 wt% (Margin Unit) [V5]',
    source: '[V5] Clavé et al. 2026',
    dNorthM: -95,
    dEastM: -115,
  },
  {
    id: 'pond_delta_sandstone',
    name: 'Delta Front Layered Sediment',
    rockType: 'Fine River-Mouth Silt & Sand',
    plain: 'Thin flat rock layers deposited right where Neretva Vallis river currents slowed entering Jezero lake.',
    juniorPlain: 'Flat pancake layers dropped by an ancient river entering the pond!',
    chemistry: 'Carbonate 3–9 wt% (Upper Fan); Fe/Mg clay in delta sediments [V5]',
    source: '[V5] NASA Delta Front (Z2)',
    dNorthM: 60,
    dEastM: -45,
  },
  {
    id: 'pond_smectite_clay',
    name: 'Fe/Mg Smectite Clay',
    rockType: 'Iron-Magnesium Phyllosilicate Mudstone',
    plain: 'Soft dry clay formed in neutral ancient water; fine smectite grains are ideal for trapping organic clues.',
    juniorPlain: 'Dry baked pond mud that was great at keeping tiny ancient clues safe!',
    chemistry: 'Fe/Mg phyllosilicates (smectite clay) + low-carbonate fan mudstone [V5]',
    source: '[V5] NASA Jezero Delta (Z2)',
    dNorthM: -120,
    dEastM: 130,
  },
  {
    id: 'pond_olivine_float',
    name: 'Séítah Olivine-Rich Float',
    rockType: 'Mafic Cumulate Crater-Floor Fragment',
    plain: 'Dense greenish-dark igneous rock eroded from underlying crater-floor lava units near the lakebed floor.',
    juniorPlain: 'Heavy dark green space-lava stone peeking up from beneath the dry mud!',
    chemistry: 'MgO 21.4 wt%, olivine CIPW 41.1 wt%, Mg# 62.8 [V2]',
    source: '[V2] Wiens et al. 2022',
    dNorthM: 145,
    dEastM: 110,
  },
  {
    id: 'pond_organic_mudstone',
    name: 'Sulfate-Veined Mystery Rock',
    rockType: 'Wildcat-Type CaSO₄ Mudstone (Potential Biosignature Zone)',
    plain: 'Fine sulfate-cemented lake mudstone holding detected organic signatures — intriguing clue, NOT confirmed life.',
    juniorPlain: 'Salty pond stone with mystery organic clues — scientists are still solving it!',
    chemistry: 'SHERLOC detected organic G-band signatures + CaSO₄ veins (potential biosignature only, not confirmed life) [R12][R21]',
    source: '[R12][R21] NASA Mars 2020',
    dNorthM: -25,
    dEastM: 195,
  },
  {
    id: 'pond_conglomerate_cobbles',
    name: 'Flood Conglomerate Pebbles',
    rockType: 'Rounded River-Tumbled Gravel',
    plain: 'Smooth rounded boulders and pebbles rolled down Neretva Vallis during strong ancient river floods.',
    juniorPlain: 'Smooth river pebbles rolled into the dry pond by huge rushing floods long ago!',
    chemistry: 'Upper Fan fluvial conglomerate — carbonate 3–9 wt% matrix [V5]',
    source: '[V5] NASA Mars 2020',
    dNorthM: 165,
    dEastM: -145,
  },
];

export function pondSpotById(spotId: string): PondSpot | undefined {
  return POND_SPOTS.find((s) => s.id === spotId);
}

export function pondSpotCoords(spot: PondSpot): { lat: number; lon: number } {
  return addNorthEastM(RESEARCH_POND.lat, RESEARCH_POND.lon, spot.dNorthM, spot.dEastM);
}

export function pondPerimeterVertices(count = 12): Array<{ lat: number; lon: number }> {
  const verts: Array<{ lat: number; lon: number }> = [];
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2;
    const dNorth = RESEARCH_POND.radiusM * Math.cos(theta);
    const dEast = RESEARCH_POND.radiusM * Math.sin(theta);
    verts.push(addNorthEastM(RESEARCH_POND.lat, RESEARCH_POND.lon, dNorth, dEast));
  }
  return verts;
}

export function isInResearchPond(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  const { dx, dy } = offsetM(RESEARCH_POND.lat, RESEARCH_POND.lon, lat, lon);
  return Math.hypot(dx, dy) <= RESEARCH_POND.radiusM;
}

export function distanceToResearchPondEdgeM(lat: number, lon: number): number {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return Infinity;
  const { dx, dy } = offsetM(RESEARCH_POND.lat, RESEARCH_POND.lon, lat, lon);
  return Math.max(0, Math.hypot(dx, dy) - RESEARCH_POND.radiusM);
}
