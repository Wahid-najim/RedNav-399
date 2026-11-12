'use client';

import React from 'react';
import { VisorTint, GoogleEarthViewMode } from '../types';
import { WEATHER } from '../lib/jezeroReal';

interface HelmetVisorOverlayProps {
  tint: VisorTint;
  panOffset: number;
  pitchOffset: number;
  isWalking: boolean;
  viewMode?: GoogleEarthViewMode;
  oxygenPct?: number | null;
  reservePct?: number;
  walkedM?: number;
  totalM?: number;
  distanceRemainingM?: number;
  elapsedMin?: number;
}

/**
 * First-person EVA helmet visor frame modeled after the reference HUD layout,
 * styled in team Mars Red (#E5484D / #FF3B30) and strictly wired to real NASA/route numbers.
 */
export const HelmetVisorOverlay: React.FC<HelmetVisorOverlayProps> = ({
  tint,
  panOffset,
  pitchOffset,
  isWalking,
  viewMode = 'eva',
  oxygenPct = null,
  reservePct = 25,
  walkedM = 0,
  totalM = 0,
  distanceRemainingM = 0,
  elapsedMin = 0,
}) => {
  const isFirstPerson = viewMode === 'eva';
  const o2Clamped = oxygenPct != null ? Math.max(0, Math.min(100, oxygenPct)) : 100;
  const routePct = totalM > 0 ? Math.max(0, Math.min(100, (walkedM / totalM) * 100)) : 0;

  // Arc path length heuristic for dasharray animation (q-curve ~ 378 units)
  const ARC_LEN = 382;
  const o2DashOffset = ARC_LEN * (1 - o2Clamped / 100);
  const routeDashOffset = ARC_LEN * (1 - routePct / 100);

  const getTintOverlay = () => {
    switch (tint) {
      case 'gold-polar':
        return 'bg-amber-600/15 mix-blend-color backdrop-brightness-95 backdrop-contrast-110';
      case 'thermal-lidar':
        return 'bg-rose-950/20 mix-blend-hard-light backdrop-contrast-125';
      case 'night-nv':
        return 'bg-emerald-900/20 mix-blend-screen backdrop-brightness-110';
      default:
        return 'bg-transparent';
    }
  };

  return (
    <div
      id="hud-helmet-visor-structure"
      className="absolute inset-0 pointer-events-none overflow-hidden select-none z-10"
    >
      {/* 1. Visor Optical Coating */}
      <div className={`absolute inset-0 transition-colors duration-500 ${getTintOverlay()}`} />

      {/* 2. Curved Helmet Bezel Corners — slim frame keeps >80% of Mars terrain clearly visible */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${isFirstPerson ? 'opacity-100' : 'opacity-40'}`}
        style={{
          boxShadow: 'inset 0 0 85px 22px rgba(4, 2, 3, 0.78)',
        }}
      />
      {isFirstPerson && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 1000 600"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M 0,0 L 1000,0 L 1000,600 L 0,600 Z M 75,34 C 310,10 690,10 925,34 C 974,115 978,485 925,566 C 690,590 310,590 75,566 C 22,485 26,115 75,34 Z"
            fill="rgba(6, 3, 4, 0.72)"
            fillRule="evenodd"
          />
          <path
            d="M 75,34 C 310,10 690,10 925,34 C 974,115 978,485 925,566 C 690,590 310,590 75,566 C 22,485 26,115 75,34 Z"
            fill="none"
            stroke="rgba(229, 72, 77, 0.32)"
            strokeWidth="1.5"
          />
        </svg>
      )}

      {/* 3. Subtle Visor Curved Optical Glare */}
      <div
        className="absolute inset-0 transition-transform duration-300 pointer-events-none opacity-30"
        style={{ transform: `translate(${panOffset * 0.3}px, ${pitchOffset * 0.3}px)` }}
      >
        <div
          className="absolute -top-36 -left-32 w-[520px] h-[280px] rounded-[100%] opacity-25 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(255,220,215,0.35) 0%, rgba(229,72,77,0.06) 45%, transparent 72%)',
            transform: 'rotate(-22deg)',
          }}
        />
      </div>

      {/* 4. Top-Left Real Mars Air Telemetry (MEDA — 718 Pa & temp) */}
      <div className="hidden md:flex items-center gap-2 absolute top-14 left-12 sm:left-16 px-3 py-1 rounded-full bg-black/60 border border-[#E5484D]/35 font-mono text-[10px] tracking-wider text-white/90">
        <span className="text-[#E5484D] font-bold">MARS AIR:</span>
        <span>
          {WEATHER.pressurePa} Pa · {WEATHER.tempHighC} / {WEATHER.tempLowC} °C
        </span>
      </div>

      {/* 5. Top-Right Real Route Distance & Planner Time */}
      <div className="hidden md:flex items-center gap-2 absolute top-14 right-12 sm:right-16 px-3 py-1 rounded-full bg-black/60 border border-[#E5484D]/35 font-mono text-[10px] tracking-wider text-white/90">
        <span className="text-[#E5484D] font-bold">GOAL:</span>
        <span>
          {Math.round(distanceRemainingM).toLocaleString()} m · T+{Math.round(elapsedMin)} min
        </span>
      </div>

      {/* 6. Left Visor Curved Arc Gauge — Real Suit Oxygen Model */}
      <div className="hidden sm:flex items-center absolute left-4 md:left-7 top-1/2 -translate-y-1/2 w-32 h-72 pointer-events-none">
        <svg viewBox="0 0 110 420" className="w-20 h-full overflow-visible">
          <defs>
            <filter id="redArcGlowLeft" x="-40%" y="-20%" width="180%" height="140%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feComposite in="SourceGraphic" in2="b" operator="over" />
            </filter>
          </defs>
          {/* Track */}
          <path
            d="M 80 28 Q 22 210 80 392"
            fill="none"
            stroke="rgba(229, 72, 77, 0.2)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Reserve threshold tick */}
          <circle cx="52" cy={392 - (reservePct / 100) * 350} r="3" fill="#fbbf24" opacity="0.85" />
          {/* Live value */}
          <path
            d="M 80 28 Q 22 210 80 392"
            fill="none"
            stroke={o2Clamped < reservePct ? '#FF3B30' : '#E5484D'}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={ARC_LEN}
            strokeDashoffset={o2DashOffset}
            filter="url(#redArcGlowLeft)"
          />
        </svg>
        <div className="-ml-3 flex flex-col items-start font-mono rounded-lg bg-black/55 backdrop-blur-[2px] border border-[#E5484D]/30 px-2.5 py-1.5 shadow-[0_4px_14px_rgba(0,0,0,0.65)]">
          <span className="text-[10px] tracking-widest uppercase text-[#ff8a8e] font-bold">OXYGEN</span>
          <span className="text-2xl md:text-3xl font-black text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
            {oxygenPct != null ? `${Math.round(o2Clamped)}%` : '—'}
          </span>
          <span className="text-[9px] text-white/75">reserve {reservePct}%</span>
        </div>
      </div>

      {/* 7. Right Visor Curved Arc Gauge — Real Route Progress (Never fake power %) */}
      <div className="hidden sm:flex items-center justify-end absolute right-4 md:right-7 top-1/2 -translate-y-1/2 w-40 h-72 pointer-events-none">
        <div className="-mr-3 flex flex-col items-end font-mono text-right rounded-lg bg-black/55 backdrop-blur-[2px] border border-[#E5484D]/30 px-2.5 py-1.5 shadow-[0_4px_14px_rgba(0,0,0,0.65)]">
          <span className="text-[10px] tracking-widest uppercase text-[#ff8a8e] font-bold">ROUTE</span>
          <span className="text-2xl md:text-3xl font-black text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
            {totalM > 0 ? `${Math.round(routePct)}%` : '0%'}
          </span>
          <span className="text-[9px] text-white/75 whitespace-nowrap">
            {Math.round(walkedM)} / {Math.round(totalM)} m
          </span>
        </div>
        <svg viewBox="0 0 110 420" className="w-20 h-full overflow-visible">
          <defs>
            <filter id="redArcGlowRight" x="-40%" y="-20%" width="180%" height="140%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feComposite in="SourceGraphic" in2="b" operator="over" />
            </filter>
          </defs>
          <path
            d="M 30 28 Q 88 210 30 392"
            fill="none"
            stroke="rgba(229, 72, 77, 0.2)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d="M 30 28 Q 88 210 30 392"
            fill="none"
            stroke="#FF3B30"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={ARC_LEN}
            strokeDashoffset={routeDashOffset}
            filter="url(#redArcGlowRight)"
          />
        </svg>
      </div>

      {/* 8. Subtle Red Crosshair Reticle */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-65">
        <div className="relative w-12 h-12 flex items-center justify-center">
          <div className="w-1 h-1 bg-[#FF3B30] rounded-full shadow-[0_0_8px_#FF3B30]" />
          <div className="absolute top-0 w-px h-2.5 bg-[#E5484D]/55" />
          <div className="absolute bottom-0 w-px h-2.5 bg-[#E5484D]/55" />
          <div className="absolute left-0 h-px w-2.5 bg-[#E5484D]/55" />
          <div className="absolute right-0 h-px w-2.5 bg-[#E5484D]/55" />
        </div>
      </div>

      {/* 9. Faint Breath Fog Pulse at Lower Seal when Walking */}
      {isWalking && (
        <div
          className="absolute bottom-2 inset-x-1/4 h-14 rounded-t-full bg-gradient-to-t from-[#FF3B30]/10 via-white/5 to-transparent blur-md pointer-events-none"
          style={{ animation: 'breathing 6s ease-in-out infinite' }}
        />
      )}
    </div>
  );
};
