'use client';

import { CHEYAVA, REAL_SITES, realSiteById } from './jezeroReal';
import type { Site } from './missionTypes';

export type UiMode = 'grownup' | 'junior';

const UI_MODE_KEY = 'rednav-ui-mode-v1';
const PHOTO_WALL_KEY = 'rednav-junior-photos-v1';

export function loadUiMode(): UiMode {
  if (typeof window === 'undefined') return 'grownup';
  try {
    const v = window.localStorage.getItem(UI_MODE_KEY);
    return v === 'junior' ? 'junior' : 'grownup';
  } catch {
    return 'grownup';
  }
}

export function saveUiMode(mode: UiMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(UI_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export interface MissionPatchDef {
  missionId: string;
  name: string;
  badgeIcon: 'delta' | 'butte' | 'magnifier' | 'mountain';
  color: string;
  rewardLine: string;
  howToEarn: string;
}

export const MISSION_PATCHES: MissionPatchDef[] = [
  {
    missionId: 'm1_first_light',
    name: 'River Finder',
    badgeIcon: 'delta',
    color: '#E5484D',
    rewardLine: 'You walked to the ancient river delta!',
    howToEarn: 'Walk to Western Delta',
  },
  {
    missionId: 'm2_kodiak',
    name: 'Hill Climber',
    badgeIcon: 'butte',
    color: '#fbbf24',
    rewardLine: 'You reached Kodiak hill and zapped its layered rock!',
    howToEarn: 'Reach Kodiak and zap a rock',
  },
  {
    missionId: 'm3_biosignature',
    name: 'Spot Detective',
    badgeIcon: 'magnifier',
    color: '#34d399',
    rewardLine: 'You gathered all the clues on the Leopard Spots case!',
    howToEarn: 'Solve the Leopard Spots detective case',
  },
  {
    missionId: 'm4_rimwalk',
    name: 'Ancient Rim',
    badgeIcon: 'mountain',
    color: '#f472b6',
    rewardLine: 'You planned to the crater rim and checked Broom Point!',
    howToEarn: 'Plan toward the rim & read Broom Point',
  },
];

export interface ZapFinding {
  siteId: string;
  siteName: string;
  headline: string;
  plainChemistry: string;
  rawChemistry: string | null;
  source: string;
  canCollect: boolean;
}

/** Returns ONLY real chemistry values from the Jezero verified pack. Never invents data. */
export function buildZapFinding(site: Site): ZapFinding {
  const real = realSiteById(site.id);
  const rawChem = site.chemistry ?? real?.chemistry ?? null;
  const plainChem =
    real?.chemistryPlain ??
    (rawChem ? rawChem : 'No chemistry reading is published for this spot yet, so Percy does not guess.');
  const headline = rawChem
    ? `SuperCam laser reading at ${site.name}!`
    : `Percy scanned ${site.name}`;
  return {
    siteId: site.id,
    siteName: site.name,
    headline,
    plainChemistry: plainChem,
    rawChemistry: rawChem,
    source: real?.source ?? site.mission,
    canCollect: Boolean(rawChem),
  };
}

export function percyJobForMission(missionId: string, goalName?: string): string {
  switch (missionId) {
    case 'm1_first_light':
      return `Today: walk with Percy to ${goalName ?? 'Western Delta'} where an ancient river met the lake!`;
    case 'm2_kodiak':
      return `Today: hike to ${goalName ?? 'Kodiak'} hill and zap a rock with the laser!`;
    case 'm3_biosignature':
      return 'Mystery alert! Open Detective Case to inspect the leopard spots on Cheyava Falls!';
    case 'm4_rimwalk':
      return 'Today: check the high rim and read about the oldest rock at Broom Point!';
    default:
      return `Today: explore Jezero Crater and head toward ${goalName ?? 'Kodiak'}!`;
  }
}

export const CHEYAVA_DETECTIVE_CLUES = [
  {
    id: 'spots',
    title: 'Clue 1: The Leopard Spots',
    plain:
      'Tiny millimeter-sized dark-rimmed spots containing iron and phosphorus minerals (vivianite and greigite). On Earth, microbes sometimes help make similar spots — or water chemistry can make them without life.',
    fact: 'Organic carbon + phosphorus; vivianite + greigite spots (Bright Angel / Cheyava Falls).',
  },
  {
    id: 'veins',
    title: 'Clue 2: The White Mineral Veins',
    plain: `White calcium sulfate veins run right along this ${CHEYAVA.sizeM} m rock found on sol ${CHEYAVA.sol}. That tells Percy water flowed through cracks in the rock long ago!`,
    fact: `CaSO₄ veins; Sapphire Canyon core taken sol ${CHEYAVA.sapphireCanyonSol} (${CHEYAVA.sapphireCanyonCm} cm).`,
  },
  {
    id: 'carbon',
    title: 'Clue 3: Organic Carbon',
    plain:
      'Percy found organic carbon molecules inside the rock. Organic carbon is a building block for living things, though space rocks and non-living chemistry can make it too.',
    fact: 'POTENTIAL biosignature only (Nature-validated Sept 2025) — never confirmed life.',
  },
] as const;

export const DETECTIVE_CONCLUSION = {
  headline: 'Scientists still don’t know — you found the clues!',
  body:
    'Did tiny microbes live in that ancient lake mud, or did plain water and rock chemistry paint those leopard spots? Saying "we don’t know yet — let’s check more!" is the bravest and smartest thing a Mars scientist can say.',
} as const;

export interface SavedPhoto {
  id: string;
  takenAt: string;
  caption: string;
  coords: string;
  elevation: string;
  imageDataUrl: string | null;
}

export function loadSavedPhotos(): SavedPhoto[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PHOTO_WALL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePhotoToWall(photo: SavedPhoto): SavedPhoto[] {
  const existing = loadSavedPhotos();
  const next = [photo, ...existing].slice(0, 18);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PHOTO_WALL_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
  }
  return next;
}

export function realZoneSitesHint() {
  return REAL_SITES.filter((s) => !s.locationNotPublished && s.chemistryPlain).map((s) => ({
    id: s.id,
    name: s.name,
    plain: s.chemistryPlain!,
  }));
}

