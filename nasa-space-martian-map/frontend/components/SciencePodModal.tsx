'use client';

import React, { useEffect, useState } from 'react';
import {
  FlaskConical,
  Microscope,
  CloudSun,
  Wind,
  Map as MapIcon,
  Award,
  X,
  CheckCircle2,
  Upload,
  Sparkles,
  Users,
} from 'lucide-react';
import type { GameProgress } from '../lib/progress';
import {
  ATMOSPHERE,
  CHEYAVA,
  MOXIE,
  REAL_SITES,
  WEATHER,
  realSiteById,
} from '../lib/jezeroReal';
import { pondSpotById } from '../lib/researchPond';
import { loadSavedPhotos, type UiMode } from '../lib/juniorMode';
import type { LiveCrewMember } from '../lib/crew';
import { PatchWall, PercyPortrait } from './JuniorComponents';
import { hudSound } from '../utils/soundEffects';

type StationId = 'hub' | 'sample' | 'biosig' | 'weather' | 'oxygen' | 'map' | 'wall';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  game: GameProgress;
  uiMode: UiMode;
  liveCrew: LiveCrewMember[];
  goalName?: string;
  onOpenLab: () => void;
  onOpenDetectiveCase: () => void;
  onOpenMapTable: () => void;
  onOpenPhotoMode: () => void;
}

const STATIONS: {
  id: Exclude<StationId, 'hub'>;
  name: string;
  juniorName: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'sample',
    name: 'Sample Lab',
    juniorName: 'Rock Lab',
    subtitle: 'Real chemistry & carbonate/olivine analysis',
    icon: FlaskConical,
  },
  {
    id: 'biosig',
    name: 'Biosignature Bench',
    juniorName: 'Leopard Spots Desk',
    subtitle: 'Cheyava Falls clues & Mission 3 microscope',
    icon: Microscope,
  },
  {
    id: 'weather',
    name: 'Weather Station',
    juniorName: 'Mars Weather Desk',
    subtitle: 'Live MEDA: -22 / -83 °C, 718 Pa, gusts 10 m/s',
    icon: CloudSun,
  },
  {
    id: 'oxygen',
    name: 'Oxygen Plant',
    juniorName: 'MOXIE Air Machine',
    subtitle: 'MOXIE: 122 g O₂ made · 12 g/h peak · 98%+ pure',
    icon: Wind,
  },
  {
    id: 'map',
    name: 'Map Table',
    juniorName: 'Big Crater Map',
    subtitle: 'Measured CTX satellite map & route planner',
    icon: MapIcon,
  },
  {
    id: 'wall',
    name: 'Collection Wall',
    juniorName: 'Trophy Wall',
    subtitle: 'Your rocks, photos & mission patches',
    icon: Award,
  },
];

/**
 * Interior 2D station hub for the Jezero Science Pod at Octavia E. Butler Landing Site
 * (18.4446 N, 77.4509 E). Reuses low-RAM 2D overlays and connects to the real Research Lab.
 */
export const SciencePodModal: React.FC<Props> = ({
  isOpen,
  onClose,
  game,
  uiMode,
  liveCrew,
  goalName = 'Kodiak',
  onOpenLab,
  onOpenDetectiveCase,
  onOpenMapTable,
  onOpenPhotoMode,
}) => {
  const isJunior = uiMode === 'junior';
  const [station, setStation] = useState<StationId>('hub');
  const [analyzedSiteId, setAnalyzedSiteId] = useState<string | null>(null);
  const [savedCards, setSavedCards] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) setStation('hub');
  }, [isOpen]);

  if (!isOpen) return null;

  const podCrew = liveCrew.filter((c) => c.inPod);
  const savedPhotos = loadSavedPhotos();

  const inspectableRocks = REAL_SITES.filter((s) => s.chemistry || s.chemistryPlain);
  const selectedSiteRock = analyzedSiteId ? realSiteById(analyzedSiteId) ?? null : null;
  const selectedPondRock = analyzedSiteId && !selectedSiteRock ? pondSpotById(analyzedSiteId) ?? null : null;
  const selectedRock = selectedSiteRock
    ? selectedSiteRock
    : selectedPondRock
    ? {
        id: selectedPondRock.id,
        name: selectedPondRock.name,
        plain: selectedPondRock.plain,
        chemistryPlain: selectedPondRock.plain,
        chemistry: selectedPondRock.chemistry,
        source: selectedPondRock.source,
      }
    : null;

  const handleAnalyzeRock = (siteId: string) => {
    hudSound.playMissionComplete();
    setAnalyzedSiteId(siteId);
    game.recordChemistryRead(siteId);
    if (!savedCards.includes(siteId)) {
      setSavedCards((prev) => [...prev, siteId]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-[#090405]/92 backdrop-blur-xl p-3 sm:p-6 font-sans text-white select-none"
      role="dialog"
      aria-label="Science Pod Interior"
    >
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-[#E5484D]/55 bg-gradient-to-b from-[#16090b] via-[#0c0507] to-[#080304] shadow-[0_0_60px_rgba(255,59,48,0.22)] overflow-hidden">
        {/* Top Pod Airlock Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-white/10 bg-black/45">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest uppercase text-[#E5484D] font-bold">
              <span className="w-2 h-2 rounded-full bg-[#FF3B30] animate-pulse" />
              <span>OCTAVIA E. BUTLER LANDING · 18.4446°N 77.4509°E</span>
            </div>
            <h2
              className="text-lg sm:text-xl font-black tracking-wider uppercase text-white"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              {isJunior ? 'Science Pod — Big Round Research House' : 'Science Pod · Jezero Research Base'}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              hudSound.playClick();
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#E5484D]/60 bg-[#FF3B30]/20 hover:bg-[#FF3B30]/35 text-white font-mono text-xs font-bold transition active:scale-95"
          >
            <X className="w-4 h-4 text-[#ff8a8e]" />
            Exit Pod
          </button>
        </div>

        {/* Mandatory Game-Building Honesty Banner */}
        <div className="px-5 py-2 bg-[#E5484D]/12 border-b border-[#E5484D]/25 text-xs font-mono text-amber-100 flex flex-wrap items-center justify-between gap-2">
          <span>The pod is our game base — the science inside is real NASA data.</span>
          {podCrew.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[#ff9b9e]">
              <Users className="w-3.5 h-3.5" />
              {podCrew.map((c) => c.label).join(' · ')}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isJunior && station === 'hub' && (
            <div className="flex items-center gap-3 rounded-2xl border border-[#E5484D]/40 bg-black/45 p-3.5">
              <PercyPortrait size={52} happy />
              <div>
                <div className="text-[10px] font-mono tracking-widest uppercase text-[#E5484D] font-bold">
                  PERCY AT THE POD DOOR
                </div>
                <p className="text-sm font-medium text-white">
                  Welcome to the Science Pod! Pick any of the 6 science desks below to test rocks, check Mars weather, or see our trophies!
                </p>
              </div>
            </div>
          )}

          {/* Station Navigation Breadcrumb */}
          {station !== 'hub' && (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStation('hub')}
                className="px-3.5 py-1.5 rounded-full border border-white/20 bg-white/5 hover:bg-white/15 text-xs font-mono text-white transition"
              >
                ← Back to all 6 stations
              </button>
              <div className="text-xs font-mono text-[#ff8a8e] uppercase tracking-wider font-bold">
                {STATIONS.find((s) => s.id === station)?.[isJunior ? 'juniorName' : 'name']}
              </div>
            </div>
          )}

          {/* 6-Station Selector Grid */}
          {station === 'hub' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {STATIONS.map((st, idx) => {
                const Icon = st.icon;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      hudSound.playClick();
                      setStation(st.id);
                    }}
                    className="group text-left rounded-2xl border border-white/15 hover:border-[#E5484D]/75 bg-white/[0.04] hover:bg-[#E5484D]/10 p-4 transition flex flex-col justify-between gap-3 active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between">
                      <div className="p-2.5 rounded-xl bg-[#E5484D]/15 border border-[#E5484D]/35 text-[#ff7b7e] group-hover:bg-[#FF3B30] group-hover:text-white transition">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-mono text-white/40">0{idx + 1}</span>
                    </div>
                    <div>
                      <div className="font-bold text-base text-white">
                        {isJunior ? st.juniorName : st.name}
                      </div>
                      <div className="text-xs text-white/65 mt-1 leading-snug">{st.subtitle}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* 1. Sample Lab */}
          {station === 'sample' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-white">
                    {isJunior ? 'Drop a Mars Rock on the Lab Bench' : 'Sample Chemistry Lab (Real Zone Measurements)'}
                  </h3>
                  <p className="text-xs text-white/65">
                    Backpack rocks: {game.progress.inventory.length}. Pick a collected sample or inspect verified Jezero deposits below, or open the full Image Research Lab.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenLab}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#E5484D] hover:bg-[#FF3B30] text-white font-mono text-xs font-bold transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Open Full Research Lab
                </button>
              </div>

              {game.progress.inventory.length > 0 && (
                <div className="rounded-2xl border border-[#E5484D]/40 bg-black/40 p-3 space-y-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[#ff8a8e] font-bold">
                    Samples in your backpack ({game.progress.inventory.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {game.progress.inventory.map((item) => (
                      <button
                        key={item.siteId}
                        type="button"
                        onClick={() => handleAnalyzeRock(item.siteId)}
                        className="px-3 py-1.5 rounded-xl border border-[#E5484D]/50 bg-[#E5484D]/15 hover:bg-[#E5484D]/30 text-xs font-mono font-bold text-white"
                      >
                        Analyze: {item.siteName}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {inspectableRocks.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleAnalyzeRock(r.id)}
                    className={`text-left rounded-xl border p-3 transition ${
                      analyzedSiteId === r.id
                        ? 'border-[#FF3B30] bg-[#FF3B30]/15'
                        : 'border-white/10 bg-white/[0.03] hover:border-[#E5484D]/60'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span>{r.name}</span>
                      {savedCards.includes(r.id) && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <div className="text-[11px] text-white/60 mt-0.5 line-clamp-1">
                      {r.chemistryPlain ?? r.chemistry}
                    </div>
                  </button>
                ))}
              </div>

              {selectedRock && (
                <div className="rounded-2xl border border-emerald-400/45 bg-emerald-950/25 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-emerald-300 font-bold flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      Science Card Saved · {selectedRock.name}
                    </span>
                    <span className="text-[10px] font-mono text-white/50">{selectedRock.source}</span>
                  </div>
                  <p className="text-sm font-medium text-white">
                    {selectedRock.chemistryPlain ?? selectedRock.plain}
                  </p>
                  {selectedRock.chemistry && (
                    <div className="text-xs font-mono text-amber-200 bg-black/35 rounded-lg p-2 border border-white/10">
                      Measured zone data: {selectedRock.chemistry}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 2. Biosignature Bench */}
          {station === 'biosig' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-400/35 bg-black/45 p-4 space-y-3">
                <div className="text-xs font-mono uppercase tracking-wider text-amber-300 font-bold">
                  CHEYAVA FALLS · POTENTIAL BIOSIGNATURE (NOT CONFIRMED LIFE)
                </div>
                <p className="text-sm text-white/90 leading-relaxed">
                  A {CHEYAVA.sizeM} m rock investigated at Bright Angel on sol {CHEYAVA.sol}, with the Sapphire Canyon core drilled on sol {CHEYAVA.sapphireCanyonSol} ({CHEYAVA.sapphireCanyonCm} cm). Scientists found white calcium-sulfate veins, organic carbon signatures, and tiny leopard-spot reaction rims — intriguing clues, still unproven.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                  <div className="rounded-xl bg-white/5 border border-white/10 p-2.5">
                    <div className="text-white/50 text-[10px]">VEINS</div>
                    <div className="font-bold text-white mt-0.5">CaSO₄ calcium sulfate</div>
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-2.5">
                    <div className="text-white/50 text-[10px]">LEOPARD SPOTS</div>
                    <div className="font-bold text-white mt-0.5">Fe + P redox rims</div>
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-2.5">
                    <div className="text-white/50 text-[10px]">SCIENTIFIC STATUS</div>
                    <div className="font-bold text-amber-300 mt-0.5">Still investigating</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenDetectiveCase();
                  }}
                  className="px-5 py-2.5 rounded-full bg-[#E5484D] hover:bg-[#FF3B30] text-white font-mono text-xs font-bold transition"
                >
                  Open Biosignature Microscope &amp; Hypothesis Log
                </button>
              </div>
            </div>
          )}

          {/* 3. Weather Station */}
          {station === 'weather' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/15 bg-black/45 p-4">
                  <div className="text-[10px] font-mono text-white/55">TEMPERATURE (MEDA)</div>
                  <div className="text-2xl font-black text-white mt-1">
                    {WEATHER.tempHighC} / {WEATHER.tempLowC} °C
                  </div>
                  <p className="text-xs text-white/65 mt-1">Daytime high vs night low at Jezero Crater.</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-black/45 p-4">
                  <div className="text-[10px] font-mono text-white/55">AIR PRESSURE</div>
                  <div className="text-2xl font-black text-[#ff8a8e] mt-1">{WEATHER.pressurePa} Pa</div>
                  <p className="text-xs text-white/65 mt-1">{WEATHER.pressurePlain}</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-black/45 p-4">
                  <div className="text-[10px] font-mono text-white/55">PEAK WIND GUSTS</div>
                  <div className="text-2xl font-black text-amber-300 mt-1">{WEATHER.windGustMs} m/s</div>
                  <p className="text-xs text-white/65 mt-1">{WEATHER.source}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-black/40 p-4 space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-white/55">
                  MEASURED MARTIAN ATMOSPHERE
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  {ATMOSPHERE.map((g) => (
                    <div key={g.formula} className="rounded-xl bg-white/5 border border-white/10 p-2.5">
                      <div className="text-white/50">{g.formula}</div>
                      <div className="font-bold text-white">{g.volPct}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. Oxygen Plant (MOXIE) */}
          {station === 'oxygen' && (
            <div className="rounded-2xl border border-[#E5484D]/45 bg-black/45 p-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-full border-2 border-[#FF3B30] flex items-center justify-center bg-[#FF3B30]/15 shadow-[0_0_24px_rgba(255,59,48,0.45)]">
                  <Wind className="w-7 h-7 text-[#ff8a8e] animate-pulse" />
                </div>
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-[#ff8a8e] font-bold">
                    MOXIE SOLID-OXIDE ELECTROLYSIS PLANT
                  </div>
                  <h3 className="text-lg font-black text-white">Making breathable O₂ from CO₂</h3>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="text-white/50">TOTAL MADE ON MARS</div>
                  <div className="text-xl font-black text-white mt-0.5">{MOXIE.totalO2g} g</div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="text-white/50">PEAK PRODUCTION</div>
                  <div className="text-xl font-black text-[#ff8a8e] mt-0.5">{MOXIE.peakGPerH} g/h</div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="text-white/50">PURITY · RUNS</div>
                  <div className="text-xl font-black text-emerald-300 mt-0.5">98%+ · {MOXIE.runs} runs</div>
                </div>
              </div>
              <p className="text-xs text-white/80 leading-relaxed">
                MOXIE proved astronauts can manufacture oxygen straight from Jezero&apos;s 95.1% CO₂ air. This is where the oxygen in your suit bar comes from — your walk budget tracks real oxygen reserves using this same supply model.
              </p>
            </div>
          )}

          {/* 5. Map Table */}
          {station === 'map' && (
            <div className="rounded-2xl border border-[#E5484D]/45 bg-black/45 p-5 space-y-3">
              <div className="text-xs font-mono uppercase tracking-wider text-[#ff8a8e] font-bold">
                HOLOTABLE · MEASURED CTX 20 m JEZERO SURFACE
              </div>
              <p className="text-sm text-white/85">
                Current target plotted from Octavia E. Butler Landing Site: <b>{goalName}</b>. Open the interactive CTX satellite map to inspect all 10 sites, toggle hazard/slope overlays, or switch route strategies.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenMapTable();
                }}
                className="px-5 py-2.5 rounded-full bg-[#E5484D] hover:bg-[#FF3B30] text-white font-mono text-xs font-bold transition"
              >
                Open Crater Map Table →
              </button>
            </div>
          )}

          {/* 6. Collection Wall */}
          {station === 'wall' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-bold text-white">
                  Pod Collection Wall — Rocks ({game.progress.inventory.length}), Patches ({game.progress.completedMissionIds.length}/4), Photos ({savedPhotos.length})
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenPhotoMode();
                  }}
                  className="px-4 py-1.5 rounded-full border border-[#E5484D]/60 bg-[#E5484D]/20 text-xs font-mono font-bold text-white hover:bg-[#FF3B30]/35"
                >
                  Take New Photo
                </button>
              </div>
              <PatchWall completedIds={game.progress.completedMissionIds} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/40 p-3 space-y-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-white/60">
                    Collected Rocks &amp; Science Cards
                  </div>
                  {game.progress.inventory.length === 0 ? (
                    <p className="text-xs text-white/45">No field rocks collected yet — collect rocks in the Research Pond or along Jezero trails, then analyse them in Sample Lab.</p>
                  ) : (
                    <ul className="space-y-1.5 text-xs">
                      {game.progress.inventory.map((i) => (
                        <li key={i.id} className="rounded-lg bg-white/5 p-2 border border-white/10">
                          <div className="font-bold text-white">{i.siteName}</div>
                          <div className="text-white/65 text-[11px]">{i.plain}</div>
                          {i.chemistry && (
                            <div className="text-[10px] font-mono text-[#ff8a8e] mt-0.5">{i.chemistry}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {(game.progress.fieldNotes ?? []).length > 0 && (
                    <div className="pt-2 border-t border-white/10 space-y-1">
                      <div className="text-[10px] font-mono uppercase text-amber-300 font-bold">Pond Field Notebook</div>
                      {(game.progress.fieldNotes ?? []).map((n) => (
                        <div key={n.id} className="text-[11px] text-white/75 font-mono">
                          [{n.siteName}] {n.note}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/40 p-3 space-y-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-white/60">
                    Saved Mars Snapshots
                  </div>
                  {savedPhotos.length === 0 ? (
                    <p className="text-xs text-white/45">No snapshots taken yet — snap one in Photo Mode!</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {savedPhotos.slice(0, 4).map((p) => (
                        <div key={p.id} className="rounded-lg overflow-hidden border border-white/10 bg-black">
                          {p.imageDataUrl && <img src={p.imageDataUrl} alt={p.caption} className="w-full h-20 object-cover" />}
                          <div className="p-1.5 text-[10px] text-white/75 truncate">{p.caption}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

