'use client';

import React, { useEffect, useRef, useState } from 'react';

interface Props {
  missionId: string;
  num: string;
  title: string;
  objective: string;
  onFinished?: () => void;
}

/**
 * Compact mission header pill & bottom objective card shown once on launch.
 * Never covers the center of the map or site labels.
 */
export const MissionCinematic: React.FC<Props> = ({
  missionId,
  num,
  title,
  objective,
  onFinished,
}) => {
  const [visible, setVisible] = useState(true);
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;

  useEffect(() => {
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      finishedRef.current?.();
    }, 2200);
    return () => clearTimeout(t);
  }, [missionId]);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 top-14 bottom-16 z-[65] pointer-events-none flex flex-col justify-between items-center px-4 select-none">
      {/* Small Top Pill (never centered over map) */}
      <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-[#E5484D]/65 bg-[#0e0607]/92 shadow-[0_4px_20px_rgba(0,0,0,0.7)]">
        <span className="font-mono text-[10px] tracking-widest text-[#ff8a8e] uppercase font-bold">
          {num}
        </span>
        <span className="text-white/30">·</span>
        <span
          className="font-mono text-xs sm:text-sm font-black tracking-widest uppercase text-white"
          style={{ fontFamily: "'Orbitron', monospace" }}
        >
          {title}
        </span>
      </div>

      {/* Small Docked Bottom Briefing Strip */}
      <div className="max-w-xl rounded-2xl border border-[#E5484D]/45 bg-[#0d0608]/92 px-4 py-2 text-center shadow-lg">
        <p className="font-mono text-[11px] sm:text-xs text-slate-200 leading-snug">
          {objective}
        </p>
      </div>
    </div>
  );
};
