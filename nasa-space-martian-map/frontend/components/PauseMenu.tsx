'use client';

import React, { useEffect, useState } from 'react';
import { Play, RotateCcw, FileText, LogOut, Share2, Copy, Check, Award } from 'lucide-react';
import { PatchWall } from './JuniorComponents';
import { safeCopyText } from '../lib/browserSafe';

interface Props {
  isOpen: boolean;
  onResume: () => void;
  onRestart: () => void;
  onDetails: () => void;
  onQuit: () => void;
  activeMissionTitle?: string;
  goalName?: string;
  distanceRemainingM?: number;
  oxygenPct?: number | null;
  uiMode?: 'grownup' | 'junior';
  onToggleUiMode?: () => void;
  completedMissionIds?: string[];
}

export const PauseMenu: React.FC<Props> = ({
  isOpen,
  onResume,
  onRestart,
  onDetails,
  onQuit,
  activeMissionTitle,
  goalName,
  distanceRemainingM,
  oxygenPct,
  uiMode = 'grownup',
  onToggleUiMode,
  completedMissionIds = [],
}) => {
  const [copied, setCopied] = useState(false);
  const [showPatches, setShowPatches] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShareUrl(window.location.origin);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copyUrl = () => {
    void safeCopyText(shareUrl || 'http://localhost:3000').then((ok) => {
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none cursor-default font-mono"
      role="dialog"
      aria-label="Pause Menu"
    >
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl border border-[#E5484D]/50 bg-[#0c0506]/95 p-6 shadow-[0_0_50px_rgba(255,59,48,0.28)] space-y-5">
        <div className="text-center space-y-1">
          <div className="text-[10px] tracking-widest text-[#E5484D] uppercase font-bold">
            EXPEDITION PAUSED
          </div>
          <h2
            className="text-2xl font-black tracking-widest text-white uppercase"
            style={{ fontFamily: "'Orbitron', monospace" }}
          >
            REDNAV-N399
          </h2>
          <div className="text-xs text-white/55 tracking-wider">Jezero Crater · Mars</div>
        </div>

        {(activeMissionTitle || goalName) && (
          <div className="rounded-xl border border-white/10 bg-black/50 p-3 space-y-2 text-xs">
            {activeMissionTitle && (
              <div className="flex justify-between text-white/75">
                <span className="text-white/45">MISSION</span>
                <span className="font-bold text-white">{activeMissionTitle}</span>
              </div>
            )}
            {goalName && (
              <div className="flex justify-between text-white/75">
                <span className="text-white/45">TARGET</span>
                <span className="text-[#ff8a8e] font-bold">{goalName}</span>
              </div>
            )}
            {distanceRemainingM != null && (
              <div className="flex justify-between text-white/75">
                <span className="text-white/45">DISTANCE REMAINING</span>
                <span className="text-white">{Math.round(distanceRemainingM).toLocaleString()} m</span>
              </div>
            )}
            {oxygenPct != null && (
              <div className="flex justify-between text-white/75">
                <span className="text-white/45">AIR LEFT</span>
                <span className={oxygenPct < 30 ? 'text-[#FF3B30] font-bold' : 'text-white font-bold'}>
                  {Math.round(oxygenPct)}%
                </span>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2.5">
          <button
            onClick={onResume}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#E5484D] hover:bg-[#FF3B30] text-sm font-bold tracking-widest text-white transition active:scale-95"
          >
            <Play className="w-4 h-4" />
            RESUME (Esc)
          </button>

          <button
            onClick={onRestart}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-bold tracking-widest text-white/90 transition active:scale-95"
          >
            <RotateCcw className="w-4 h-4 text-amber-300" />
            RESTART MISSION WALK
          </button>

          <button
            onClick={onDetails}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-bold tracking-widest text-white/90 transition active:scale-95"
          >
            <FileText className="w-4 h-4 text-white/70" />
            DETAILS (SCIENCE &amp; DATA)
          </button>

          {onToggleUiMode && (
            <button
              onClick={onToggleUiMode}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#E5484D]/15 hover:bg-[#E5484D]/30 border border-[#E5484D]/45 text-xs font-bold tracking-widest text-[#ff9b9e] transition active:scale-95"
            >
              SWITCH TO {uiMode === 'junior' ? 'GROWN-UP MODE' : 'JUNIOR ASTRONAUT MODE'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowPatches((s) => !s)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-950/35 hover:bg-amber-900/45 border border-amber-400/35 text-xs font-bold tracking-widest text-amber-200 transition"
          >
            <Award className="w-4 h-4 text-amber-300" />
            MISSION PATCH WALL ({completedMissionIds.length} / 4)
          </button>

          {showPatches && (
            <div className="rounded-xl border border-amber-400/30 bg-black/50 p-3">
              <PatchWall completedIds={completedMissionIds} compact />
            </div>
          )}

          {uiMode !== 'junior' && (
            <div className="rounded-xl border border-[#E5484D]/40 bg-black/55 p-3 space-y-2 text-left">
              <div className="flex items-center gap-1.5 text-[10px] tracking-widest uppercase text-[#E5484D] font-bold">
                <Share2 className="w-3.5 h-3.5" />
                SHARE THIS EXPEDITION
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  readOnly
                  value={shareUrl || 'http://localhost:3000'}
                  aria-label="Share expedition URL"
                  className="flex-1 min-w-0 rounded bg-black/70 border border-white/15 px-2 py-1 text-[11px] text-white select-all"
                />
                <button
                  type="button"
                  onClick={copyUrl}
                  className="px-2.5 py-1 rounded bg-[#E5484D] hover:bg-[#FF3B30] text-white text-[11px] font-bold flex items-center gap-1 shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={onQuit}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF3B30]/15 hover:bg-[#FF3B30]/30 border border-[#FF3B30]/45 text-xs font-bold tracking-widest text-[#ff8a8e] transition active:scale-95"
          >
            <LogOut className="w-4 h-4 text-[#FF3B30]" />
            QUIT TO TITLE
          </button>
        </div>

        <div className="text-[10px] text-center text-white/45 tracking-wider">
          WASD/Arrows to pan · Space to walk · E near Pod · M for 3D · Esc for menu
        </div>
      </div>
    </div>
  );
};
