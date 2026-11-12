/**
 * Plain-language glossary (§6a). Every science word a normal person
 * might meet gets a one-sentence plain answer first, then the detail.
 */

export interface GlossaryTerm {
  word: string;
  plain: string;
  detail: string;
}

export const GLOSSARY: Record<string, GlossaryTerm> = {
  sol: {
    word: 'Sol',
    plain: 'One day on Mars — about 24 hours and 37 minutes, a little longer than an Earth day.',
    detail: 'Mission teams count time in sols since landing. Perseverance landed on sol 0 (18 Feb 2021). Sol 1212 is the day the Cheyava Falls rock was found.',
  },
  delta: {
    word: 'Delta',
    plain: 'Where a river meets a lake and drops its sand and mud, building a fan of layered rock.',
    detail: 'Jezero’s western delta formed where the Neretva river flowed into an ancient lake. Deltas bury organic matter quickly, which is why they are good places to look for signs of past life.',
  },
  olivine: {
    word: 'Olivine',
    plain: 'A green mineral found in volcanic rock that comes from deep inside a planet.',
    detail: 'Séítah rock is 41.1 wt% olivine (CIPW norm, SuperCam). Olivine weathers fast in water, so finding so much of it tells scientists about the rock’s history.',
  },
  carbonate: {
    word: 'Carbonate',
    plain: 'A mineral that forms in water — finding it means water was once here.',
    detail: 'Carbonate wt% by zone: Margin Unit 6–16 wt%, Upper Fan 3–9 wt%, Séítah <5 wt% (Clavé et al. 2026). More carbonate means the rock spent longer sitting in water.',
  },
  biosignature: {
    word: 'Biosignature',
    plain: 'A sign that life might once have been there — not proof of life.',
    detail: 'Cheyava Falls / Sapphire Canyon is a POTENTIAL biosignature only (Nature-validated Sept 2025). It is not confirmed life. Scientists are still testing other explanations.',
  },
  ctx: {
    word: 'CTX',
    plain: 'A camera on the Mars Reconnaissance Orbiter that photographs Mars from above.',
    detail: 'CTX takes 6 m/pixel images and stereo pairs used to build the 20 m/pixel elevation map (USGS CTX DTM, DOI 10.5066/P906QQT8) this app’s terrain comes from.',
  },
  hirise: {
    word: 'HiRISE',
    plain: 'The sharpest camera orbiting Mars — it can see objects about the size of a desk.',
    detail: 'HiRISE images are 25 cm/pixel. A 1 m/pixel HiRISE elevation map exists for part of Jezero but is not yet in this app (listed as MISSING).',
  },
  moxie: {
    word: 'MOXIE',
    plain: 'A machine on Perseverance that made oxygen out of Mars air.',
    detail: 'MOXIE made 122 g of oxygen over 16 runs (2021–2023), at up to 12 g/h and 98%+ purity (NASA, 2023-09-06). It proved oxygen can be made on Mars for future astronauts.',
  },
  regolith: {
    word: 'Regolith',
    plain: 'The loose dust and broken rock covering the ground — Mars soil, but not soil for growing things.',
    detail: 'Regolith is crushed rock with no organic matter. Walking on it is like walking on dry gravel dust.',
  },
  meda: {
    word: 'MEDA',
    plain: 'The weather station on Perseverance that measures wind, pressure and temperature.',
    detail: 'MEDA (Mars Environmental Dynamics Analyzer) gave the first weather report from Jezero: pressure 718 Pa, high −22 °C, low −83 °C, gusts 10 m/s (sols 43–44).',
  },
  'point of no return': {
    word: 'Point of no return',
    plain: 'The farthest point on your walk where you still have enough oxygen to walk back with reserve to spare.',
    detail: 'Computed by the oxygen model in the route planner from the route distance, slope and the 25% reserve. Past this point, turning back would use more oxygen than the reserve allows.',
  },
  'hazard level': {
    word: 'Hazard level',
    plain: 'How rough the ground is on your route, worked out from the real slope and hazard data.',
    detail: 'LOW: max slope under the caution limit. CAUTION: max slope between caution and no-go limits. HIGH: route touches no-go cells or a marked hazard. Thresholds come from the mission settings (config.py).',
  },
  'chemical index': {
    word: 'Chemical index',
    plain: 'A number showing how much carbonate (a water-formed mineral) the ground in that area holds.',
    detail: 'Zone-mapped rover composition in wt%, not a spectrometer map. CRISM carbonate is a spectral index (0–0.11), never shown as wt%.',
  },
  'oxygen on arrival': {
    word: 'Air left (Oxygen)',
    plain: 'How much suit breathing air you will have left when you reach your goal.',
    detail: 'Calculated from suit capacity (480 min baseline), distance, slope steepness, cargo weight, and a 25% safety reserve (team assumptions in config.py).',
  },
};

export function glossaryFor(word: string): GlossaryTerm | null {
  return GLOSSARY[word.toLowerCase()] ?? null;
}
