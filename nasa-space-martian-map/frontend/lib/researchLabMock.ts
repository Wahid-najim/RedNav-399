/**
 * MOCK fallback for the Research Lab ONLY, for development while the
 * backend agent finishes POST /api/analyze-image. This is DEMO DATA —
 * clearly labelled MOCK in code and in the UI ("demo data — backend
 * not connected"). It must never be presented as a real analysis.
 * The UI tries the live API first and only uses this on failure.
 */
import type { LabAnalysis } from './missionTypes';

export function mockAnalysis(filename: string, sha256: string, width: number | null, height: number | null, meta: LabAnalysis['metadata']): LabAnalysis {
  return {
    id: 'mock-demo-001',
    created_at: new Date().toISOString(),
    filename,
    sha256,
    width,
    height,
    metadata: meta,
    tier: 3,
    brain: 'Tier 3 — Minimal (ONNX + classical CV only)',
    mock: true,
    measurements: [
      { name: 'Longest visible clast', value: 0.62, unit: 'm', method: 'Segmentation + scale from image metadata; scale not verified', uncertainty: '±0.15 m (scale uncalibrated)', plain: 'The biggest rock piece in the photo is about 60 cm across — roughly the size of a desk.' },
      { name: 'Spotted patches counted', value: 14, unit: 'count', method: 'Classical CV blob count on the cropped rock face', uncertainty: '±3 patches (overlapping spots merged)', plain: 'We counted 14 leopard-like spots on the rock face.' },
      { name: 'Vein length', value: 0.58, unit: 'm', method: 'Skeletonised vein trace', uncertainty: '±0.08 m', plain: 'A pale vein runs almost the whole length of the rock.' },
    ],
    matches: [
      { name: 'Cheyava Falls (sol 1212)', score: 0.81, metric: 'shape + spot-pattern similarity', shared_properties: ['mm-scale leopard spots', 'pale CaSO₄ veins', '1.0 × 0.6 m block'], archive_ref: 'Jezero Research Pack, PIA26368 (WATSON, sol 1212)', plain: 'Most like Cheyava Falls — the spotted rock from sol 1212.' },
      { name: 'Mandu Wall outcrop', score: 0.46, metric: 'shape + spot-pattern similarity', shared_properties: ['layered outcrop', 'pale veins'], archive_ref: 'Jezero Research Pack, Z3 Margin Unit', plain: 'Somewhat like the Mandu Wall rocks, but the spots do not match as well.' },
      { name: 'Séítah floor rock', score: 0.22, metric: 'shape + spot-pattern similarity', shared_properties: ['dark volcanic rock'], archive_ref: 'Jezero Research Pack, Z1 Séítah', plain: 'Not much like the dark Séítah floor rocks.' },
    ],
    novelty: {
      score_sigma: 2.4, population: 'Verified Jezero archive: 10 sites, 6 zones, 7 PIA images', n: 10,
      method: 'Distance from the reference population in measurement space, in standard deviations',
      plain: 'This rock is unusual — 2.4 standard deviations away from the rocks we already know. Unusual is interesting, not proof of anything.',
    },
    hypotheses: [
      {
        text: 'The spotted texture is consistent with mineral growth in the presence of water, similar to the Cheyava Falls leopard spots.',
        supporting_measurements: ['Spotted patches counted', 'Vein length'],
        citation: { author: 'NASA / Perseverance team', year: 2025, title: 'Cheyava Falls potential biosignature assessment', source_file: 'Jezero Research Pack (28 pp.)' },
        confidence: 'low — a potential biosignature, not confirmed life',
        plain: 'The spots could have formed in water. That is a guess worth testing, not a discovery.',
      },
    ],
    actions: [
      { rank: 1, action: 'Take a close-up of the spots with the WATSON camera', cost: '1 sol of rover time (estimate)', expected_value: 'Confirms whether the spots are surface staining or inside the rock', cost_unknown: false },
      { rank: 2, action: 'Run SHERLOC spectra on two spots and one vein', cost: 'Unknown — instrument time not published', expected_value: 'Tests for organic carbon in the spots', cost_unknown: true },
      { rank: 3, action: 'Compare against the Sapphire Canyon core (sol 1215, 6.2 cm)', cost: 'Archive work only', expected_value: 'Checks whether the same minerals appear in the cored sample', cost_unknown: false },
    ],
    unknowns: [
      'Scale is not calibrated — no ruler or known object in the photo, so sizes are estimates.',
      'We do not know whether the spots are on the surface or through the rock.',
      'No chemical measurement was made from this photo alone — chemistry needs an instrument, not a picture.',
    ],
    pattern_finder: {
      pairs: [
        { a: 'leopard spots', b: 'pale veins', count: 14, expected: 3, note: 'Spots and veins appear together far more often than chance in the local archive.' },
        { a: 'layering', b: 'spots', count: 2, expected: 4, note: 'Layering and spots appear together less often than expected.' },
      ],
      label: 'Local co-occurrence (PathCore idea, adapted to Mars images — local implementation, not the transcriptomics tool).',
    },
    plain_summary: 'This rock looks most like the Cheyava Falls rock we already know, and it is unusual enough to be worth a closer look. Nothing here proves life — it only says "look again, carefully".',
  };
}

export const MOCK_BRAIN = {
  tier: 3,
  brain: 'Tier 3 — Minimal (ONNX + classical CV only)',
  model: 'mock — backend not connected',
  ram_mb: null,
  available: false,
};
