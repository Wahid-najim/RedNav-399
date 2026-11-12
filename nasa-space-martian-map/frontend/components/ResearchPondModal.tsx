'use client';

import React, { useState } from 'react';
import {
  Zap,
  Pickaxe,
  Camera,
  NotebookPen,
  CheckCircle2,
  X,
  Home,
  Navigation,
  Users,
  Sparkles,
} from 'lucide-react';
import type { GameProgress } from '../lib/progress';
import type { LiveCrewMember } from '../lib/crew';
import type { UiMode } from '../lib/juniorMode';
import { CURRENT_SIM_SOL, POND_SPOTS, RESEARCH_POND, type PondSpot } from '../lib/researchPond';
import { PercyPortrait } from './JuniorComponents';
import { hudSound } from '../utils/soundEffects';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  inPond: boolean;
  game: GameProgress;
  uiMode: UiMode;
  liveCrew: LiveCrewMember[];
  onRouteToPond: () => void;
  onOpenPod: () => void;
  onOpenPhotoMode: () => void;
  onToast: (text: string, type?: 'info' | 'warning' | 'success' | 'critical') => void;
}

/**
 * Field Bench for The Research Pond (§11), anchored at the real Delta Front
 * coordinate (18.441° N, 77.412° E) — a DRY ancient lakebed with zero liquid water.
 */
export const ResearchPondModal: React.FC<Props> = ({
  isOpen,
  onClose,
  inPond,
  game,
  uiMode,
  liveCrew,
  onRouteToPond,
  onOpenPod,
  onOpenPhotoMode,
  onToast,
}) => {
  const isJunior = uiMode === 'junior';
  const [zappedSpotId, setZappedSpotId] = useState<string | null>(null);
  const [noteSpotId, setNoteSpotId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  if (!isOpen) return null;

  const pondCrew = liveCrew.filter((c) => c.inPond);
  const collectedCount = POND_SPOTS.filter((s) =>
    game.progress.inventory.some(
      (i) => i.siteId === s.id && (i.collectedSol == null || i.collectedSol === CURRENT_SIM_SOL)
    )
  ).length;
  const fieldNotes = (game.progress.fieldNotes ?? []).filter((n) =>
    POND_SPOTS.some((s) => s.id === n.siteId)
  );

  const handleZap = (spot: PondSpot) => {
    if (!inPond) {
      onToast('Walk inside the Research Pond boundary to zap and collect samples.', 'warning');
      return;
    }
    hudSound.playLaserZap();
    setZappedSpotId(spot.id);
    game.recordChemistryRead(spot.id);
    onToast(`SuperCam laser scanned ${spot.name}`, 'info');
  };

  const handleCollect = (spot: PondSpot) => {
    if (!inPond) {
      onToast('Walk inside the Research Pond boundary to dig & collect samples.', 'warning');
      return;
    }
    hudSound.playMissionComplete();
    game.collectSample(spot.id, spot.name, isJunior ? spot.juniorPlain : spot.plain, CURRENT_SIM_SOL);
    onToast(`Added ${spot.name} to backpack (Sol ${CURRENT_SIM_SOL})`, 'success');
  };

  const handleSaveNote = (spot: PondSpot) => {
    const clean = noteText.trim();
    if (!clean) return;
    hudSound.playSaveChime();
    game.addFieldNote(spot.id, spot.name, clean, CURRENT_SIM_SOL);
    onToast(`Saved field note for ${spot.name}`, 'success');
    setNoteText('');
    setNoteSpotId(null);
  };

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-[#090405]/92 backdrop-blur-xl p-3 sm:p-6 font-sans text-white select-none"
      role="dialog"
      aria-label="Research Pond Field Bench"
    >
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-[#E5484D]/55 bg-gradient-to-b from-[#16090b] via-[#0c0507] to-[#080304] shadow-[0_0_60px_rgba(255,59,48,0.22)] overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-white/10 bg-black/45">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest uppercase text-[#E5484D] font-bold">
              <span className="w-2 h-2 rounded-full bg-[#FF3B30] animate-pulse" />
              <span>DELTA FRONT LAKEBED · 18.4410°N 77.4120°E · SOL {CURRENT_SIM_SOL}</span>
            </div>
            <h2
              className="text-lg sm:text-xl font-black tracking-wider uppercase text-white"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              {isJunior ? `${RESEARCH_POND.juniorName} · ${collectedCount}/6 Collected` : `${RESEARCH_POND.name} — Dry Lakebed Field Zone (${collectedCount}/6)`}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                hudSound.playClick();
                onClose();
                onOpenPod();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[#E5484D]/55 bg-[#E5484D]/20 hover:bg-[#FF3B30]/35 text-white font-mono text-xs font-bold transition"
            >
              <Home className="w-3.5 h-3.5 text-[#ff8a8e]" />
              Analyse in Pod
            </button>
            <button
              type="button"
              onClick={() => {
                hudSound.playClick();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/20 bg-white/5 hover:bg-white/15 text-white font-mono text-xs font-bold transition"
            >
              <X className="w-4 h-4 text-[#ff8a8e]" />
              Close
            </button>
          </div>
        </div>

        {/* Live Zone Status & Dry-Lakebed Honesty Banner */}
        <div className="px-5 py-2.5 bg-[#E5484D]/12 border-b border-[#E5484D]/25 space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <span className={`font-bold ${inPond ? 'text-emerald-300' : 'text-amber-200'}`}>
              {inPond ? 'You are in the Research Pond' : 'Outside Pond boundary — walk into the Pond to dig & collect'}
            </span>
            {pondCrew.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[#ff9b9e]">
                <Users className="w-3.5 h-3.5" />
                {pondCrew.map((c) => c.label).join(' · ')}
              </span>
            )}
          </div>
          <p className="text-[11px] text-white/75 leading-snug">
            {RESEARCH_POND.honestyDetail}
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isJunior && (
            <div className="flex items-center gap-3 rounded-2xl border border-[#E5484D]/45 bg-black/45 p-3.5">
              <PercyPortrait size={52} happy />
              <div>
                <div className="text-[10px] font-mono tracking-widest uppercase text-[#E5484D] font-bold">
                  PERCY AT THE DRY LAKEBED
                </div>
                <p className="text-sm font-semibold text-white">
                  “{RESEARCH_POND.juniorPercyLine}”
                </p>
                <p className="text-xs text-white/70 mt-0.5">{RESEARCH_POND.juniorSubtitle}</p>
              </div>
            </div>
          )}

          {!inPond && (
            <div className="rounded-2xl border border-amber-400/45 bg-amber-950/25 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-amber-100 leading-relaxed max-w-xl">
                Collecting only happens inside the Pond boundary or at real Jezero sites. Plan the real route to Delta Front and walk inside to dig, zap, photograph, and log field notes.
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRouteToPond();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#E5484D] hover:bg-[#FF3B30] text-white font-mono text-xs font-bold transition"
              >
                <Navigation className="w-3.5 h-3.5" />
                Route to Research Pond
              </button>
            </div>
          )}

          {/* 6 Collect Spots Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {POND_SPOTS.map((spot) => {
              const collected = game.progress.inventory.some(
                (i) => i.siteId === spot.id && (i.collectedSol == null || i.collectedSol === CURRENT_SIM_SOL)
              );
              const isZapped = zappedSpotId === spot.id || game.progress.chemistryRead.includes(spot.id);
              const spotNotes = fieldNotes.filter((n) => n.siteId === spot.id);

              return (
                <div
                  key={spot.id}
                  data-pond-spot={spot.id}
                  className={`rounded-2xl border p-4 space-y-2.5 transition ${
                    collected
                      ? 'border-emerald-400/50 bg-emerald-950/20'
                      : 'border-white/15 bg-white/[0.03] hover:border-[#E5484D]/55'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-mono text-[#ff8a8e] uppercase tracking-wider">
                        {spot.rockType}
                      </div>
                      <h3 className="font-bold text-base text-white">{spot.name}</h3>
                    </div>
                    {collected && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        Sol {CURRENT_SIM_SOL}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-white/80 leading-snug">
                    {isJunior ? spot.juniorPlain : spot.plain}
                  </p>

                  {isZapped && (
                    <div className="rounded-xl border border-[#E5484D]/35 bg-black/50 p-2 text-[11px] font-mono text-amber-200 flex items-start gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#ff8a8e] shrink-0 mt-0.5" />
                      <span>
                        {spot.chemistry} <span className="text-white/50">({spot.source})</span>
                      </span>
                    </div>
                  )}

                  {spotNotes.length > 0 && (
                    <div className="space-y-1">
                      {spotNotes.map((n) => (
                        <div key={n.id} className="text-[11px] font-mono text-white/75 bg-white/5 rounded-lg px-2.5 py-1 border border-white/10">
                          Note (Sol {n.sol}): {n.note}
                        </div>
                      ))}
                    </div>
                  )}

                  {noteSpotId === spot.id && (
                    <div className="flex gap-1.5 pt-1">
                      <input
                        type="text"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="One-line field finding..."
                        maxLength={120}
                        className="flex-1 rounded-xl border border-white/20 bg-black/60 px-2.5 py-1.5 text-xs text-white focus:border-[#E5484D] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveNote(spot)}
                        className="px-3 py-1.5 rounded-xl bg-[#E5484D] hover:bg-[#FF3B30] text-white text-xs font-mono font-bold"
                      >
                        Save
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      disabled={!inPond}
                      onClick={() => handleZap(spot)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-mono font-bold transition ${
                        inPond
                          ? 'border-emerald-400/55 bg-emerald-950/45 hover:bg-emerald-900/60 text-emerald-200'
                          : 'border-white/10 bg-white/5 text-white/35 cursor-not-allowed'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Zap
                    </button>
                    <button
                      type="button"
                      disabled={!inPond || collected}
                      onClick={() => handleCollect(spot)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-mono font-bold transition ${
                        collected
                          ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
                          : inPond
                          ? 'border-[#E5484D]/75 bg-[#E5484D]/25 hover:bg-[#FF3B30]/40 text-white'
                          : 'border-white/10 bg-white/5 text-white/35 cursor-not-allowed'
                      }`}
                    >
                      <Pickaxe className="w-3.5 h-3.5" />
                      {collected ? 'In Backpack' : 'Dig & Collect'}
                    </button>
                    <button
                      type="button"
                      disabled={!inPond}
                      onClick={() => {
                        onClose();
                        onOpenPhotoMode();
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-mono font-bold transition ${
                        inPond
                          ? 'border-blue-400/45 bg-blue-950/35 hover:bg-blue-900/50 text-blue-200'
                          : 'border-white/10 bg-white/5 text-white/35 cursor-not-allowed'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Photo
                    </button>
                    <button
                      type="button"
                      disabled={!inPond}
                      onClick={() => {
                        setNoteSpotId(noteSpotId === spot.id ? null : spot.id);
                        setNoteText('');
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-mono font-bold transition ${
                        inPond
                          ? 'border-amber-400/45 bg-amber-950/35 hover:bg-amber-900/50 text-amber-200'
                          : 'border-white/10 bg-white/5 text-white/35 cursor-not-allowed'
                      }`}
                    >
                      <NotebookPen className="w-3.5 h-3.5" />
                      Note
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

