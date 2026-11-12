'use client';

import React from 'react';
import { Target, Flag, ShieldCheck } from 'lucide-react';
import type { GameProgress } from '../lib/progress';

interface Props {
  game: GameProgress;
  destinationName?: string;
  distanceRemainingM: number;
  className?: string;
}

export const ObjectiveTracker: React.FC<Props> = ({
  game,
  destinationName,
  distanceRemainingM,
  className = '',
}) => {
  const activeMission = game.activeMission;
  const isComplete = game.progress.completedMissionIds.includes(activeMission.id);
  const nextObjective = isComplete
    ? 'Mission accomplished'
    : destinationName
    ? `Reach ${destinationName}`
    : activeMission.objectives[0] ?? 'Complete surface survey';

  return (
    <div
      className={`rounded-xl border border-white/15 bg-slate-950/75 backdrop-blur-md p-3 font-mono select-none shadow-[0_8px_32px_rgba(0,0,0,0.6)] ${className}`}
    >
      <div className="flex items-center justify-between gap-3 pb-1 border-b border-white/10 mb-2">
        <div className="flex items-center gap-1.5 text-[#ff8a8e] text-[10px] tracking-wider uppercase font-bold">
          <Target className="w-3 h-3 text-[#E5484D]" />
          <span>OBJECTIVES</span>
        </div>
        <span className="text-[9px] text-amber-300 font-bold tracking-widest uppercase">
          {activeMission.num}
        </span>
      </div>

      <div className="space-y-1.5 text-[11px]">
        <div className="text-white font-bold tracking-wide truncate">
          {activeMission.title}
        </div>

        <div className="flex items-start gap-2 text-white/80">
          {isComplete ? (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-[#FF3B30] shrink-0 mt-1 animate-pulse" />
          )}
          <span className="leading-snug">{nextObjective}</span>
        </div>

        {!isComplete && (
          <div className="flex items-center gap-1.5 text-[10px] text-[#ff8a8e] pt-0.5">
            <Flag className="w-3 h-3 text-[#E5484D] shrink-0" />
            <span>{Math.round(distanceRemainingM).toLocaleString()} m to target</span>
          </div>
        )}
      </div>
    </div>
  );
};

