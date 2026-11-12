/**
 * Real Jezero Crater values, copied from the verified research pack
 * (jezeroVerified.ts, T1–T13). Every number carries its source.
 * Nothing here is invented. Where no published value exists, the
 * value is `null` / "not published" — never a guess.
 *
 * Sources: [V1] NASA NSSDC Mars Fact Sheet · [V2] Wiens et al. 2022
 * Science Advances eabo3399 (SuperCam, Supplement) · [V3] NASA MEDA
 * first weather report · [V5] Clavé et al. 2026 JGR
 * doi:10.1029/2025JE009107 (Supplement) · [V6] NASA MOXIE 2023-09-06
 * · [V7] NASA Science Mars Rock Samples.
 */

import { pondSpotById } from './researchPond';

export interface RealSite {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
  locationNotPublished: boolean;
  elevationM: number | null;
  elevationNote: string;
  goal: string;
  plain: string;
  chemistry: string | null;
  chemistryPlain: string | null;
  zone: string;
  source: string;
}

/** The ten real Jezero sites. bright_angel / broom_point /
 *  cheyava_falls have NO published coordinates — lat/lon are null
 *  and must NEVER be plotted as map markers or route targets. */
export const REAL_SITES: RealSite[] = [
  {
    id: 'octavia_butler_landing', name: 'Octavia E. Butler Landing', lat: 18.4446, lon: 77.4509,
    locationNotPublished: false, elevationM: -2570,
    elevationNote: '−2,570 m reported; −2,568 m sampled from the CTX DTM.',
    goal: 'Base / landing hub',
    plain: 'This is home base. Perseverance landed here on 18 Feb 2021. Every walk starts and ends here.',
    chemistry: 'Máaz paver field; MOXIE site; first weather report site.',
    chemistryPlain: 'The ground here is flat volcanic rock. The MOXIE machine made oxygen here.',
    zone: 'Z6', source: '[V2][V3][V6]',
  },
  {
    id: 'mandu_wall', name: 'Mandu Wall', lat: 18.463, lon: 77.356,
    locationNotPublished: false, elevationM: null,
    elevationNote: 'Elevation not published for this site.',
    goal: 'Margin Unit — ancient shoreline',
    plain: 'A long sloping bench on the inner rim — the edge of an ancient lake shore, not a cliff.',
    chemistry: 'Carbonate 6–16 wt% (Margin Unit).',
    chemistryPlain: 'Carbonate 6–16% — this rock once sat in water.',
    zone: 'Z3', source: '[V5]',
  },
  {
    id: 'delta_front', name: 'Delta Front', lat: 18.441, lon: 77.412,
    locationNotPublished: false, elevationM: null,
    elevationNote: 'Elevation not published for this site.',
    goal: 'Western delta front',
    plain: 'The front edge of the old river delta, where the river met the lake.',
    chemistry: 'Carbonate 3–9 wt% (Upper Fan).',
    chemistryPlain: 'Carbonate 3–9% — river mud that settled in standing water.',
    zone: 'Z2', source: '[V5]',
  },
  {
    id: 'seitah', name: 'Séítah', lat: 18.4382, lon: 77.4421,
    locationNotPublished: false, elevationM: -2583,
    elevationNote: 'Rochette, south Séítah, −2,583 m (reported low point, sol 168).',
    goal: 'Crater floor — olivine-rich rock',
    plain: 'Dark, heavy rock on the crater floor, rich in a green mineral called olivine.',
    chemistry: 'MgO 21.4 wt%, olivine CIPW 41.1 wt%, Mg# 62.8 (SuperCam).',
    chemistryPlain: 'MgO 21.4% and olivine 41.1% — this rock came from deep inside Mars, not from a river.',
    zone: 'Z1', source: '[V2] Wiens et al. 2022',
  },
  {
    id: 'kodiak', name: 'Kodiak', lat: 18.4124, lon: 77.382,
    locationNotPublished: false, elevationM: -2510,
    elevationNote: '−2,510 m representative butte elevation. CTX centre sample is −2,527 m; the butte rises to about −2,483 m ~1.2 km west.',
    goal: 'Delta remnant butte',
    plain: 'A lone flat-topped hill left behind when the delta eroded away — a layered slice of the old river.',
    chemistry: 'Carbonate 3–9 wt% (Upper Fan).',
    chemistryPlain: 'Carbonate 3–9% — layers laid down by flowing water.',
    zone: 'Z2', source: '[V5]',
  },
  {
    id: 'western_delta', name: 'Western Delta', lat: 18.455, lon: 77.375,
    locationNotPublished: false, elevationM: null,
    elevationNote: 'Elevation not published for this site.',
    goal: 'River delta sediments',
    plain: 'Where the ancient river dropped its sand and mud into the lake — the best place to look for signs of past life.',
    chemistry: 'Carbonate 3–9 wt% (Upper Fan); Fe/Mg clay in delta sediments.',
    chemistryPlain: 'Carbonate 3–9% — this mud once sat under lake water.',
    zone: 'Z2', source: '[V5]',
  },
  {
    id: 'belva', name: 'Belva Crater', lat: 18.48, lon: 77.38,
    locationNotPublished: false, elevationM: -2489,
    elevationNote: '−2,489 m (MEASURED, CTX DTM). IAU Feature 15872, adopted 2020-01-17, diameter 0.90 km.',
    goal: 'Small crater on the delta',
    plain: 'A small, fresh crater punched into the delta — it dug up rock from below the surface.',
    chemistry: null,
    chemistryPlain: null,
    zone: 'Z2', source: 'IAU Gazetteer Feature 15872; CTX DTM DOI 10.5066/P906QQT8',
  },
  {
    id: 'bright_angel', name: 'Bright Angel', lat: null, lon: null,
    locationNotPublished: true, elevationM: null,
    elevationNote: 'Location not published — no coordinates, no elevation.',
    goal: 'Cheyava Falls / Sapphire Canyon science',
    plain: 'A pale rock outcrop on the edge of the Neretva channel. Perseverance found the Cheyava Falls rock here.',
    chemistry: 'Organic carbon + phosphorus; vivianite + greigite leopard spots (mm-scale).',
    chemistryPlain: 'Tiny spotted minerals here hold organic carbon — one reason scientists look closely at this rock.',
    zone: 'Z4', source: '[R12][R19]',
  },
  {
    id: 'broom_point', name: 'Broom Point', lat: null, lon: null,
    locationNotPublished: true, elevationM: null,
    elevationNote: 'Location not published — no coordinates. Outer rim, >3.9 billion years old, 75 m stack.',
    goal: 'Ancient rim rock',
    plain: 'Very old rock on the crater rim — older than almost everything else here, tilted on its side.',
    chemistry: 'Igneous / impactite; 6 rock types in a 75 m stack, strata tilted 80°+.',
    chemistryPlain: 'Six kinds of rock stacked 75 m thick and tipped sideways — a cross-section of ancient Mars.',
    zone: 'Z5', source: '[R15][R22][R23][V7]',
  },
  {
    id: 'cheyava_falls', name: 'Cheyava Falls', lat: null, lon: null,
    locationNotPublished: true, elevationM: null,
    elevationNote: 'Location not published — no coordinates. Rock 1.0 × 0.6 m, sol 1212.',
    goal: 'Potential biosignature — NOT confirmed life',
    plain: 'One leopard-spotted rock, about the size of a desk, found on sol 1212. It might hold signs of ancient microbial life — or it might not. Scientists are still checking.',
    chemistry: 'CaSO₄ veins run the length of the rock; organic carbon + phosphorus; Sapphire Canyon core sol 1215, 6.2 cm.',
    chemistryPlain: 'White mineral veins run through a spotted rock. The spots could be signs of ancient life — but that is NOT proven.',
    zone: 'Z4', source: '[R12][R19][V7] · Nature-validated Sept 2025',
  },
];

export const CHEYAVA = {
  sizeM: '1.0 × 0.6',
  sol: 1212,
  sapphireCanyonSol: 1215,
  sapphireCanyonCm: 6.2,
  status: 'POTENTIAL BIOSIGNATURE ONLY',
  statusPlain: 'Potential biosignature means "looks interesting, not proven". It is NOT confirmed life.',
} as const;

export const JEZERO_CHEMISTRY = {
  seitah: { label: 'Séítah — MgO 21.4 wt%, olivine CIPW 41.1 wt%, Mg# 62.8', plain: 'Rich in magnesium and olivine — deep volcanic rock.' },
  maaz: { label: 'Máaz — SiO₂ 49.6 / MgO 2.7 / FeOT 18.4 wt%', plain: 'Ordinary volcanic rock, low in magnesium.' },
  carbonate: {
    upperFan: '3–9 wt%', marginUnit: '6–16 wt%', seitah: '<5 wt%',
    plain: 'Carbonate forms in water. More carbonate means the rock spent longer sitting in water.',
  },
} as const;

export interface AtmosphereRow {
  gas: string; formula: string; volPct: number; ppm: number; plain: string;
}

/** NASA NSSDC Mars Fact Sheet [V1]. ppm is NASA's value; % is
 *  ppm ÷ 10,000 — a conversion, labelled as such in the UI. */
export const ATMOSPHERE: AtmosphereRow[] = [
  { gas: 'Carbon dioxide', formula: 'CO₂', volPct: 95.1, ppm: 951000, plain: 'Almost all the air is carbon dioxide. You cannot breathe it.' },
  { gas: 'Nitrogen', formula: 'N₂', volPct: 2.59, ppm: 25900, plain: 'A small part of the air, like on Earth but far less.' },
  { gas: 'Argon', formula: 'Ar', volPct: 1.94, ppm: 19400, plain: 'An inert gas — it does nothing, it just sits there.' },
  { gas: 'Oxygen', formula: 'O₂', volPct: 0.16, ppm: 1600, plain: 'Almost no oxygen in the air — that is why you wear a suit.' },
  { gas: 'Carbon monoxide', formula: 'CO', volPct: 0.06, ppm: 600, plain: 'A poisonous gas, in a tiny amount.' },
  { gas: 'Water vapour', formula: 'H₂O', volPct: 0.021, ppm: 210, plain: 'A trace of water in the air — far too little to drink or breathe.' },
];
export const ATMOSPHERE_SOURCE = 'NASA NSSDC Mars Fact Sheet [V1] — ppm is NASA’s value; % is ppm ÷ 10,000 (converted).';

export const WEATHER = {
  pressurePa: 718,
  pressureRangePa: '705–735',
  pressurePlain: 'The air presses down 150 times weaker than on Earth. Your suit holds its own pressure — the outside air cannot keep you alive.',
  tempHighC: -22,
  tempLowC: -83,
  tempPlain: 'Even the warmest part of the day is colder than a freezer. Nights drop to −83 °C.',
  windGustMs: 10,
  windPlain: 'Wind gusts reach 10 m/s — a strong breeze on Earth, but the air is so thin it barely pushes.',
  source: 'NASA MEDA first weather report, sols 43–44 [V3]',
} as const;

export const MOXIE = {
  totalO2g: 122,
  peakGPerH: 12,
  purityPct: 98,
  runs: 16,
  plain: 'MOXIE made 122 g of oxygen from Mars air over 16 runs — about as much as a small dog breathes in 10 minutes. It proved oxygen can be made on Mars.',
  source: 'NASA, MOXIE Completes Mars Mission, 2023-09-06 [V6]',
} as const;

/** Suit air vs Mars air — keep them apart everywhere. */
export const SUIT_VS_AMBIENT = {
  suitO2Pct: 98,
  suitPlain: 'Inside the suit, the air is 98% oxygen — like a hospital oxygen mask. That 98% is SUIT air, not Mars air.',
  habitatKPa: 101.3,
  habitatPlain: 'Inside a habitat the pressure is 101.3 kPa, like Earth. Outside on Mars it is only 718 Pa.',
  ambientPa: 718,
  ambientPlain: 'Mars air is 0.16% oxygen at 718 Pa. Breathing it would not keep you alive for a minute.',
} as const;

export const RADIATION_ILLUSTRATIVE = {
  doseRateUsvPerH: 25,
  planningLimitUsv: 1000,
  label: 'ILLUSTRATIVE — not a measured MSL RAD value',
  plain: 'This dose is a planning placeholder from the app config, not a real measurement. Real MSL RAD numbers were not verified for this build.',
} as const;

export const ZONES = [
  { id: 'Z1', name: 'Crater floor — Séítah / Máaz', plain: 'The flat floor of the crater, covered in volcanic rock.' },
  { id: 'Z2', name: 'Western delta + Kodiak', plain: 'Where the old river met the lake and dropped its mud.' },
  { id: 'Z3', name: 'Margin Unit — ancient shoreline', plain: 'The old lake shore, a sloping bench around the rim.' },
  { id: 'Z4', name: 'Neretva Vallis + Bright Angel', plain: 'The river channel that cut through the rim, and the pale rocks beside it.' },
  { id: 'Z5', name: 'Rim + Broom Point', plain: 'The high rim of the crater — the oldest rock here.' },
  { id: 'Z6', name: 'Octavia E. Butler Landing hub', plain: 'Home base, where Perseverance landed.' },
] as const;

export const FIELD_FILES = [
  {
    file: '/field-files/jezero-research-pack.pdf',
    title: 'Jezero Crater Research Pack',
    detail: '28 pages — elevations, 6 zones, NASA images with metadata, sources [R1]–[R31].',
  },
  {
    file: '/field-files/jezero-values-tables.pdf',
    title: 'Jezero Values Tables',
    detail: '14 pages, A4 landscape — tables T1–T13: chemistry, elevations, atmosphere, weather, samples.',
  },
] as const;

export function realSiteById(id: string): RealSite | undefined {
  return REAL_SITES.find((s) => s.id === id);
}

/** Chemistry text for a sample collected at a site or Pond spot — real values only. */
export function sampleChemistryForSite(siteId: string): string | null {
  const s = realSiteById(siteId);
  if (s?.chemistry) return s.chemistry;
  const spot = pondSpotById(siteId);
  return spot?.chemistry ?? null;
}
