'use client';

import React, { useEffect, useRef, useState } from 'react';

/** Opening sequence: first you SEE the astronaut standing on the surface, then the camera pushes in until you are
 *  INSIDE the helmet and the HUD appears (NASA brief: the interface is what the astronaut sees through the helmet).
 *  Pure SVG + CSS, no images. Skippable (click / Esc / any key). */
export const AstronautIntro: React.FC<{ onDone: () => void; regionName?: string }> = ({ onDone, regionName }) => {
  const [phase, setPhase] = useState<0 | 1 | 2>(0); // 0 = see the astronaut, 1 = zoom into the visor, 2 = fade into HUD
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    // Auto-finishes inside 3.0s including hydration; click or any key skips immediately
    const t1 = setTimeout(() => setPhase(1), 750);
    const t2 = setTimeout(() => setPhase(2), 1650);
    const t3 = setTimeout(() => doneRef.current(), 2450);
    const skip = () => doneRef.current();
    window.addEventListener('keydown', skip);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); window.removeEventListener('keydown', skip); };
  }, []);

  // the whole scene scales about the visor so the helmet fills the screen
  const scale = phase === 0 ? 1 : 9;
  return (
    <div onClick={onDone} className={`fixed inset-0 z-[80] overflow-hidden bg-black cursor-pointer transition-opacity duration-700 ${phase === 2 ? 'opacity-0' : 'opacity-100'}`} role="img" aria-label="Astronaut on Mars; the view moves into the helmet">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDone();
        }}
        className="absolute top-5 right-5 z-[90] px-3.5 py-1.5 rounded-full bg-black/75 border border-white/25 text-xs font-mono text-white hover:bg-white/15 transition"
      >
        Skip →
      </button>
      <div className="absolute inset-0 transition-transform ease-in duration-[2000ms]" style={{ transform: `scale(${scale})`, transformOrigin: '50% 38%' }}>
        <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a0d0a" /><stop offset="0.6" stopColor="#b5603a" /><stop offset="1" stopColor="#d98a58" /></linearGradient>
            <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8a3d22" /><stop offset="1" stopColor="#3b1608" /></linearGradient>
            <radialGradient id="visor" cx="0.35" cy="0.3" r="0.9"><stop offset="0" stopColor="#f4c36a" /><stop offset="0.5" stopColor="#a8641c" /><stop offset="1" stopColor="#2b1503" /></radialGradient>
          </defs>
          <rect width="1000" height="600" fill="url(#sky)" />
          <circle cx="780" cy="130" r="22" fill="#fff4d6" opacity="0.9" />
          <path d="M0 380 Q 200 340 380 372 T 760 366 T 1000 384 V600 H0Z" fill="url(#ground)" />
          <path d="M0 420 Q 260 400 520 428 T 1000 430 V600 H0Z" fill="#5c230f" opacity="0.8" />
          {/* astronaut (front view, simplified) */}
          <g transform="translate(500 250)">
            <ellipse cx="0" cy="285" rx="90" ry="14" fill="#000" opacity="0.35" />
            <rect x="-62" y="150" width="46" height="130" rx="18" fill="#e6e6ea" /><rect x="16" y="150" width="46" height="130" rx="18" fill="#e6e6ea" />
            <rect x="-66" y="258" width="54" height="26" rx="10" fill="#9aa0aa" /><rect x="12" y="258" width="54" height="26" rx="10" fill="#9aa0aa" />
            <rect x="-85" y="20" width="170" height="170" rx="48" fill="#f2f2f5" />
            <rect x="-34" y="70" width="68" height="46" rx="8" fill="#c9ccd4" /><circle cx="-14" cy="93" r="6" fill="#FF3B30" /><circle cx="12" cy="93" r="6" fill="#ef4444" />
            <rect x="-132" y="40" width="48" height="120" rx="22" fill="#e6e6ea" transform="rotate(14 -108 100)" /><rect x="84" y="40" width="48" height="120" rx="22" fill="#e6e6ea" transform="rotate(-14 108 100)" />
            <rect x="-48" y="-96" width="96" height="112" rx="44" fill="#f6f6f8" />
            <ellipse cx="0" cy="-42" rx="36" ry="38" fill="url(#visor)" />
            <ellipse cx="-12" cy="-56" rx="10" ry="6" fill="#fff" opacity="0.55" />
          </g>
        </svg>
      </div>
      <div className={`absolute bottom-10 inset-x-0 text-center font-mono tracking-widest transition-opacity duration-700 ${phase === 0 ? 'opacity-100' : 'opacity-0'}`}>
        <div className="text-[11px] text-white/60">RedNav-N399 · MARSWALK PLANNER</div>
        <div className="text-sm text-[#ff8a8e] mt-1">{regionName ? regionName.replace(/\s*-\s*Western Delta\s*\(PRIMARY\)/i, '').replace(/\s*\(PRIMARY\)/i, '').trim() : 'Jezero Crater'} · helmet systems online…</div>
        <div className="text-[10px] text-white/35 mt-3">click or press any key to skip</div>
      </div>
      {phase === 1 && (
        <div className="absolute bottom-10 inset-x-0 text-center font-mono tracking-widest text-rose-200/80 text-xs animate-pulse">
          INSIDE THE HELMET…
        </div>
      )}
    </div>
  );
};
