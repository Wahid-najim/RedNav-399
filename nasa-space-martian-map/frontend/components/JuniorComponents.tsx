'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Zap,
  Backpack,
  Award,
  Search,
  Camera,
  X,
  CheckCircle2,
  Sun,
  Mountain,
  Waves,
  HelpCircle,
  HeartHandshake,
  Volume2,
} from 'lucide-react';
import {
  CHEYAVA_DETECTIVE_CLUES,
  DETECTIVE_CONCLUSION,
  MISSION_PATCHES,
  loadSavedPhotos,
  savePhotoToWall,
  type SavedPhoto,
  type ZapFinding,
} from '../lib/juniorMode';
import type { GameProgress } from '../lib/progress';
import { hudSound } from '../utils/soundEffects';
import { Mars3dSurface } from './Mars3dSurface';

export const PercyPortrait: React.FC<{ size?: number; happy?: boolean }> = ({
  size = 56,
  happy = false,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 80 80"
    className="shrink-0 drop-shadow-[0_4px_12px_rgba(34,211,238,0.35)]"
    aria-hidden="true"
  >
    <circle cx="40" cy="40" r="38" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
    {/* Mast & SuperCam head */}
    <rect x="37" y="20" width="6" height="20" rx="2" fill="#e2e8f0" />
    <rect x="24" y="12" width="32" height="16" rx="5" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.5" />
    {/* SuperCam Laser Eye */}
    <circle cx="40" cy="20" r="5.5" fill={happy ? '#34d399' : '#22d3ee'} />
    <circle cx="38.5" cy="18.5" r="2" fill="#ffffff" />
    {/* Mini antenna */}
    <line x1="52" y1="12" x2="56" y2="6" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
    <circle cx="56" cy="6" r="2" fill="#fbbf24" />
    {/* Rover body */}
    <rect x="18" y="38" width="44" height="18" rx="4" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
    <rect x="22" y="42" width="22" height="10" rx="2" fill="#f59e0b" />
    <rect x="47" y="42" width="11" height="10" rx="2" fill="#334155" />
    {/* 6 rugged wheels */}
    <circle cx="22" cy="60" r="6" fill="#1e293b" stroke="#94a3b8" strokeWidth="2" />
    <circle cx="40" cy="60" r="6" fill="#1e293b" stroke="#94a3b8" strokeWidth="2" />
    <circle cx="58" cy="60" r="6" fill="#1e293b" stroke="#94a3b8" strokeWidth="2" />
  </svg>
);

export const PercyCompanion: React.FC<{
  message: string;
  tips?: string[];
  className?: string;
}> = ({ message, tips = [], className = '' }) => {
  const [tipIdx, setTipIdx] = useState<number | null>(null);
  const displayMsg = tipIdx !== null && tips[tipIdx] ? tips[tipIdx] : message;

  const handleTap = () => {
    hudSound.playClick();
    if (tips.length === 0) return;
    setTipIdx((prev) => (prev === null ? 0 : prev + 1 >= tips.length ? null : prev + 1));
  };

  return (
    <button
      type="button"
      onClick={handleTap}
      className={`group flex items-center gap-3 text-left rounded-2xl border-2 border-[#E5484D]/55 bg-[#120608]/95 px-3.5 py-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.65)] hover:border-[#FF3B30] transition active:scale-[0.98] max-w-md ${className}`}
      title="Tap Percy for a quick helper tip!"
    >
      <PercyPortrait size={52} happy={tipIdx !== null} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-[#ff8a8e]">
            PERCY THE ROVER
          </span>
          {tips.length > 0 && (
            <span className="text-[10px] font-mono text-amber-300 flex items-center gap-0.5">
              <HelpCircle className="w-3 h-3" /> Tap me
            </span>
          )}
        </div>
        <p className="text-xs sm:text-sm font-medium text-white leading-snug mt-0.5">
          {displayMsg}
        </p>
      </div>
    </button>
  );
};

const PatchIcon: React.FC<{ icon: string; unlocked: boolean; color: string }> = ({
  icon,
  unlocked,
  color,
}) => {
  const cls = 'w-7 h-7';
  const style = { color: unlocked ? color : '#64748b' };
  if (icon === 'delta') return <Waves className={cls} style={style} />;
  if (icon === 'butte') return <Mountain className={cls} style={style} />;
  if (icon === 'magnifier') return <Search className={cls} style={style} />;
  return <Award className={cls} style={style} />;
};

export const PatchWall: React.FC<{
  completedIds: string[];
  compact?: boolean;
}> = ({ completedIds, compact = false }) => (
  <div className={`grid ${compact ? 'grid-cols-4 gap-2' : 'grid-cols-2 sm:grid-cols-4 gap-3'} w-full`}>
    {MISSION_PATCHES.map((p) => {
      const unlocked = completedIds.includes(p.missionId);
      return (
        <div
          key={p.missionId}
          className={`flex flex-col items-center text-center rounded-2xl border-2 p-2.5 transition ${
            unlocked
              ? 'border-amber-400/70 bg-amber-950/35 shadow-[0_0_20px_rgba(251,191,36,0.2)]'
              : 'border-white/10 bg-slate-950/50 opacity-55'
          }`}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center border-2 mb-1.5"
            style={{
              borderColor: unlocked ? p.color : '#334155',
              background: unlocked ? 'rgba(15, 23, 42, 0.9)' : 'rgba(15, 23, 42, 0.5)',
            }}
          >
            <PatchIcon icon={p.badgeIcon} unlocked={unlocked} color={p.color} />
          </div>
          <div className="text-xs font-bold text-white leading-tight">{p.name}</div>
          {!compact && (
            <div className="text-[10px] text-white/65 mt-1 leading-snug">
              {unlocked ? p.rewardLine : p.howToEarn}
            </div>
          )}
        </div>
      );
    })}
  </div>
);

export const ZapCardModal: React.FC<{
  finding: ZapFinding | null;
  alreadyInBackpack: boolean;
  onCollect: () => void;
  onClose: () => void;
}> = ({ finding, alreadyInBackpack, onCollect, onClose }) => {
  if (!finding) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none"
      role="dialog"
      aria-label="SuperCam laser scan result"
    >
      <div className="w-full max-w-md rounded-3xl border-2 border-emerald-400/70 bg-[#071512]/95 p-6 shadow-[0_0_50px_rgba(16,185,129,0.35)] space-y-4 animate-fadeIn">
        {/* Laser Flash Banner */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-xs font-bold text-emerald-300">
            <Zap className="w-4 h-4 text-emerald-300 animate-pulse" />
            SUPERCAM LASER ZAP!
          </span>
          <button
            onClick={onClose}
            className="p-2 rounded-full border border-white/20 text-white/70 hover:text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <PercyPortrait size={58} happy />
          <div>
            <h3 className="text-lg font-black text-white">{finding.headline}</h3>
            <p className="text-xs font-mono text-white/50">Real Jezero data · {finding.source}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-400/30 bg-slate-950/70 p-4 space-y-2">
          <p className="text-base font-semibold text-emerald-100 leading-relaxed">
            “{finding.plainChemistry}”
          </p>
          {finding.rawChemistry && (
            <div className="text-xs font-mono text-[#ff8a8e] pt-2 border-t border-white/10">
              Measured reading: {finding.rawChemistry}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          {finding.canCollect && !alreadyInBackpack && (
            <button
              onClick={() => {
                hudSound.playMissionComplete();
                onCollect();
              }}
              className="flex-1 flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition active:scale-95"
            >
              <Backpack className="w-5 h-5" />
              Put Rock in Backpack
            </button>
          )}
          {alreadyInBackpack && (
            <div className="flex-1 flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 rounded-2xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              Already in Backpack!
            </div>
          )}
          <button
            onClick={onClose}
            className="min-h-[48px] px-5 py-3 rounded-2xl border border-white/20 bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export const BackpackModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  game: GameProgress;
}> = ({ isOpen, onClose, game }) => {
  const [tab, setTab] = useState<'rocks' | 'patches' | 'photos'>('rocks');
  const photos = isOpen ? loadSavedPhotos() : [];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none"
      role="dialog"
      aria-label="Junior Astronaut Backpack"
    >
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-3xl border-2 border-amber-400/50 bg-[#0b0912] p-5 sm:p-6 shadow-[0_0_50px_rgba(251,191,36,0.2)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-400/50">
              <Backpack className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Explorer Backpack</h2>
              <p className="text-xs text-white/60">Your rock collection, patches &amp; Mars photos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-full border border-white/20 text-white/70 hover:text-white"
            aria-label="Close backpack"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Big Kid-Friendly Tabs */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setTab('rocks')}
            className={`min-h-[46px] rounded-2xl font-bold text-xs sm:text-sm border-2 transition ${
              tab === 'rocks'
                ? 'border-emerald-400 bg-emerald-500/20 text-white'
                : 'border-white/10 bg-slate-900/60 text-white/60'
            }`}
          >
            🪨 Rocks ({game.progress.inventory.length})
          </button>
          <button
            onClick={() => setTab('patches')}
            className={`min-h-[46px] rounded-2xl font-bold text-xs sm:text-sm border-2 transition ${
              tab === 'patches'
                ? 'border-amber-400 bg-amber-500/20 text-white'
                : 'border-white/10 bg-slate-900/60 text-white/60'
            }`}
          >
            🏅 Patches ({game.progress.completedMissionIds.length}/4)
          </button>
          <button
            onClick={() => setTab('photos')}
            className={`min-h-[46px] rounded-2xl font-bold text-xs sm:text-sm border-2 transition ${
              tab === 'photos'
                ? 'border-[#E5484D] bg-[#E5484D]/20 text-white'
                : 'border-white/10 bg-slate-900/60 text-white/60'
            }`}
          >
            📸 Photos ({photos.length})
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {tab === 'rocks' && (
            <>
              {game.progress.inventory.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 flex items-center gap-4">
                  <PercyPortrait size={56} />
                  <p className="text-sm text-white/80 leading-relaxed">
                    Your backpack has no rocks yet! Tap any site marker on the map and press{' '}
                    <b className="text-emerald-300">Zap Rock</b> to collect your first real Mars sample.
                  </p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {game.progress.inventory.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border-2 border-emerald-400/40 bg-emerald-950/20 p-4 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-base text-white">{item.siteName}</span>
                        <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                          COLLECTED
                        </span>
                      </div>
                      <p className="text-xs text-white/85 leading-snug">{item.plain}</p>
                      {item.chemistry && (
                        <p className="text-[11px] font-mono text-[#ff8a8e] pt-1">{item.chemistry}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'patches' && <PatchWall completedIds={game.progress.completedMissionIds} />}

          {tab === 'photos' && (
            <>
              {photos.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 flex items-center gap-4">
                  <PercyPortrait size={56} />
                  <p className="text-sm text-white/80 leading-relaxed">
                    No photos on your wall yet! Press the big <b className="text-[#ff8a8e]">Photo</b> button
                    anytime to snap a Mars postcard and add your own caption.
                  </p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {photos.map((ph) => (
                    <div
                      key={ph.id}
                      className="rounded-2xl border border-[#E5484D]/35 bg-slate-950/80 overflow-hidden"
                    >
                      {ph.imageDataUrl ? (
                        <img
                          src={ph.imageDataUrl}
                          alt={ph.caption || 'Mars expedition photo'}
                          className="w-full h-36 object-cover bg-black"
                        />
                      ) : (
                        <div className="w-full h-24 bg-gradient-to-br from-orange-950 to-slate-950 flex items-center justify-center text-xs font-mono text-orange-200">
                          Jezero Crater · {ph.coords}
                        </div>
                      )}
                      <div className="p-3 space-y-1">
                        <div className="text-sm font-bold text-white">“{ph.caption || 'Exploring Mars!'}”</div>
                        <div className="text-[10px] font-mono text-white/50">
                          {ph.coords} · Elev {ph.elevation}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const DetectiveCaseModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSolve: () => void;
  alreadySolved: boolean;
}> = ({ isOpen, onClose, onSolve, alreadySolved }) => {
  const [foundClues, setFoundClues] = useState<string[]>(
    alreadySolved ? CHEYAVA_DETECTIVE_CLUES.map((c) => c.id) : []
  );

  if (!isOpen) return null;

  const toggleClue = (id: string) => {
    hudSound.playClick();
    setFoundClues((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const allFound = foundClues.length === CHEYAVA_DETECTIVE_CLUES.length;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 select-none"
      role="dialog"
      aria-label="The Case of the Leopard Spots"
    >
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border-2 border-amber-400/60 bg-[#0d0a12] p-6 shadow-[0_0_50px_rgba(251,191,36,0.25)] space-y-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-xs font-bold text-amber-300">
            <Search className="w-4 h-4" />
            MYSTERY CASE · CHEYAVA FALLS
          </span>
          <button
            onClick={onClose}
            className="p-2 rounded-full border border-white/20 text-white/70 hover:text-white"
            aria-label="Close detective case"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <h2 className="text-2xl font-black text-white">The Case of the Leopard Spots</h2>
        <p className="text-sm text-white/80 leading-relaxed">
          Tap each real clue Percy found on the Cheyava Falls rock to examine the mystery!
        </p>

        <div className="space-y-3">
          {CHEYAVA_DETECTIVE_CLUES.map((clue) => {
            const inspected = foundClues.includes(clue.id);
            return (
              <button
                key={clue.id}
                onClick={() => toggleClue(clue.id)}
                className={`w-full text-left rounded-2xl border-2 p-4 transition ${
                  inspected
                    ? 'border-emerald-400/70 bg-emerald-950/25'
                    : 'border-white/15 bg-slate-900/70 hover:border-amber-400/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-base text-white">{clue.title}</span>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      inspected ? 'bg-emerald-500 text-black' : 'bg-amber-500/20 text-amber-200'
                    }`}
                  >
                    {inspected ? 'Clue Found!' : 'Tap to Inspect'}
                  </span>
                </div>
                {inspected && (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-emerald-100 leading-snug">{clue.plain}</p>
                    <p className="text-[11px] font-mono text-white/50">{clue.fact}</p>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {allFound && (
          <div className="rounded-2xl border-2 border-[#E5484D]/60 bg-[#2a0c10]/60 p-5 space-y-3 animate-fadeIn">
            <div className="flex items-center gap-3">
              <PercyPortrait size={54} happy />
              <div className="text-lg font-black text-[#ffb4b7]">{DETECTIVE_CONCLUSION.headline}</div>
            </div>
            <p className="text-sm text-white/90 leading-relaxed">{DETECTIVE_CONCLUSION.body}</p>
            <button
              onClick={() => {
                hudSound.playMissionComplete();
                onSolve();
                onClose();
              }}
              className="w-full min-h-[48px] rounded-2xl bg-[#E5484D] hover:bg-[#FF3B30] text-white font-black text-sm tracking-wide transition active:scale-95"
            >
              {alreadySolved ? 'Keep Investigating' : 'Claim Spot Detective Patch!'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const PhotoModeModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  coords: string;
  elevation: string;
  onSaved: (photo: SavedPhoto) => void;
}> = ({ isOpen, onClose, coords, elevation, onSaved }) => {
  const [caption, setCaption] = useState('');
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    setCaption('');
    try {
      const canvas = document.querySelector('#mars-eva-hud-container canvas') as HTMLCanvasElement | null;
      if (canvas) {
        setSnapshotUrl(canvas.toDataURL('image/png'));
      } else {
        setSnapshotUrl(null);
      }
    } catch {
      setSnapshotUrl(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    hudSound.playSaveChime();
    const photo: SavedPhoto = {
      id: `${Date.now()}`,
      takenAt: new Date().toISOString(),
      caption: caption.trim() || 'Walking on Jezero Crater!',
      coords,
      elevation,
      imageDataUrl: snapshotUrl,
    };
    savePhotoToWall(photo);
    onSaved(photo);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 select-none"
      role="dialog"
      aria-label="Mars Photo Mode"
    >
      <div className="w-full max-w-md rounded-3xl border-2 border-[#E5484D]/60 bg-[#0d0708] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-sm font-bold text-[#ff8a8e]">
            <Camera className="w-5 h-5" />
            MARS PHOTO POSTCARD
          </span>
          <button
            onClick={onClose}
            className="p-2 rounded-full border border-white/20 text-white/70 hover:text-white"
            aria-label="Close photo mode"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-2xl overflow-hidden border border-white/15 bg-slate-950">
          {snapshotUrl ? (
            <img src={snapshotUrl} alt="Captured Mars surface" className="w-full h-48 object-cover" />
          ) : (
            <div className="w-full h-40 bg-gradient-to-br from-orange-950 via-slate-900 to-black flex flex-col items-center justify-center p-4 text-center">
              <Sparkles className="w-8 h-8 text-amber-300 mb-2" />
              <div className="text-sm font-bold text-white">Jezero Crater Snapshot</div>
              <div className="text-xs font-mono text-[#ff8a8e] mt-1">{coords}</div>
            </div>
          )}
          <div className="px-3 py-2 bg-black/60 text-[11px] font-mono text-white/60 flex justify-between">
            <span>{coords}</span>
            <span>Elev {elevation}</span>
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-white/80">Write a caption for your wall (saved offline):</span>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Look at that crater hill!"
            maxLength={80}
            className="w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2.5 text-sm text-white focus:border-[#E5484D] focus:outline-none"
          />
        </label>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 min-h-[48px] rounded-2xl bg-[#E5484D] hover:bg-[#FF3B30] text-white font-black text-sm transition active:scale-95"
          >
            Save to My Wall
          </button>
          <button
            onClick={onClose}
            className="min-h-[48px] px-4 rounded-2xl border border-white/20 text-white font-bold text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export const BlueSunsetModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  patchName: string;
}> = ({ isOpen, onClose, patchName }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[98] flex flex-col justify-between bg-[#02050d] select-none overflow-hidden"
      role="dialog"
      aria-label="Blue Mars Sunset Reward"
    >
      {/* Live 3D Blue Sunset View */}
      <div className="absolute inset-0 z-0">
        <Mars3dSurface
          isWalking={false}
          walkDistance={0}
          stepPhase={0}
          pitchOffset={5}
          panOffset={0}
          headingDeg={275}
          visorTint="clear"
          viewMode="eva"
          timeOfSol="blue-sunset"
          showTopoGrid={false}
          isTourPlaying={true}
          dustDevilsActive={false}
          zoomLevel={1}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 50% 42%, rgba(56,189,248,0.28) 0%, rgba(14,116,144,0.12) 35%, transparent 70%)',
          }}
        />
      </div>

      <div className="relative z-10 flex items-center justify-between p-6 bg-gradient-to-b from-black/80 to-transparent">
        <span className="font-mono text-xs text-sky-300 tracking-widest uppercase">
          SOL COMPLETE · BLUE MARS SUNSET (VISUALISATION)
        </span>
        <button
          onClick={() => hudSound.playBlueSunsetTone()}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-sky-400/50 bg-sky-950/60 text-xs font-bold text-sky-200"
        >
          <Volume2 className="w-4 h-4" />
          Play Soft Tone
        </button>
      </div>

      <div className="relative z-10 mx-auto max-w-lg text-center px-6 py-6 rounded-3xl bg-black/70 backdrop-blur-md border border-sky-400/40 mb-10 space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-xs font-bold text-amber-200">
          <Sun className="w-4 h-4 text-sky-300" />
          PATCH EARNED: {patchName}
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white">Blue Sunset on Mars!</h2>
        <p className="text-sm text-sky-100/90 leading-relaxed">
          On Earth, sunsets are red and orange. On Mars, fine dust scatters blue light near the sun — so sunsets glow cool blue!
        </p>
        <p className="text-[11px] font-mono text-white/50">
          Audio: soft synthesized ambient tone (no Perseverance recording bundled).
        </p>
        <button
          onClick={onClose}
          className="min-h-[48px] px-8 py-3 rounded-2xl bg-sky-400 hover:bg-sky-300 text-black font-black text-sm transition active:scale-95"
        >
          Back to Jezero
        </button>
      </div>
    </div>
  );
};

export const FriendlyRescueModal: React.FC<{
  isOpen: boolean;
  onRetry: () => void;
}> = ({ isOpen, onRetry }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none"
      role="dialog"
      aria-label="Percy Rover Pickup"
    >
      <div className="w-full max-w-md rounded-3xl border-2 border-amber-400/70 bg-[#140e06] p-6 text-center space-y-4 shadow-[0_0_50px_rgba(251,191,36,0.3)]">
        <div className="flex justify-center">
          <PercyPortrait size={76} happy />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-xs font-bold text-amber-300">
          <HeartHandshake className="w-4 h-4" />
          PERCY PICKED YOU UP!
        </div>
        <h2 className="text-2xl font-black text-white">Whoa — air got low!</h2>
        <p className="text-sm text-amber-100/90 leading-relaxed">
          Percy drove right out to pick you up safely! That was close — let’s plan a shorter walk or carry a lighter pack next time.
        </p>
        <button
          onClick={onRetry}
          className="w-full min-h-[48px] rounded-2xl bg-amber-400 hover:bg-amber-300 text-black font-black text-sm transition active:scale-95"
        >
          Try Again with Percy
        </button>
      </div>
    </div>
  );
};

