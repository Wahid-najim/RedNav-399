import React from 'react';
import { TriangleAlert } from 'lucide-react';
import { NavigationRoute } from '../types';

interface ArGroundPathProps {
  route: NavigationRoute;
  distanceRemaining: number;
  panOffset: number;
  pitchOffset: number;
  isWalking: boolean;
  walkDistance?: number;
  speedMs?: number;
  /** Real hazard warning from planner / evidenced hazards — only shown when present */
  steepHazardNote?: string | null;
}

/**
 * First-person AR Direction Path in Mars Red (#FF3B30 / #E5484D):
 * thin glowing centerline on the terrain with centered directional chevrons
 * and optional real hazard box.
 */
export const ArGroundPath: React.FC<ArGroundPathProps> = ({
  route,
  distanceRemaining,
  panOffset,
  pitchOffset,
  isWalking,
  walkDistance = 0,
  speedMs = 0.8,
  steepHazardNote = null,
}) => {
  const destHeadingRel = 8 - panOffset;
  const screenXPercent = 50 + destHeadingRel * 1.5;
  const screenYPercent = 52 + pitchOffset * 0.8;

  const secondsLeft = Math.max(0, Math.round(distanceRemaining / Math.max(speedMs, 0.1)));
  const etaMinutes = Math.floor(secondsLeft / 60);
  const etaSeconds = secondsLeft % 60;

  return (
    <div
      id="hud-ar-ground-path"
      className="absolute inset-0 pointer-events-none overflow-hidden select-none"
    >
      <svg className="w-full h-full absolute inset-0" viewBox="0 0 1000 1000" preserveAspectRatio="none">
        <defs>
          <filter id="arRedGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {(() => {
          const horizonY = 540 + pitchOffset * 7;
          const targetX = 500 + destHeadingRel * 16;
          const targetY = horizonY - 10;
          const bottomStartX = 500;
          const bottomStartY = 1040;
          const ctrl1X = bottomStartX + 18;
          const ctrl1Y = 820;
          const ctrl2X = targetX - 30;
          const ctrl2Y = 655;

          const bezPt = (t: number) => {
            const u = 1 - t;
            const x =
              u * u * u * bottomStartX +
              3 * u * u * t * ctrl1X +
              3 * u * t * t * ctrl2X +
              t * t * t * targetX;
            const y =
              u * u * u * bottomStartY +
              3 * u * u * t * ctrl1Y +
              3 * u * t * t * ctrl2Y +
              t * t * t * targetY;
            return { x, y };
          };

          const shift = isWalking ? (walkDistance * 0.04) % 0.18 : 0;

          return (
            <g filter="url(#arRedGlow)">
              {/* Soft outer red trail bloom */}
              <path
                d={`M ${bottomStartX} ${bottomStartY} C ${ctrl1X} ${ctrl1Y}, ${ctrl2X} ${ctrl2Y}, ${targetX} ${targetY}`}
                fill="none"
                stroke="#FF3B30"
                strokeWidth="5"
                strokeLinecap="round"
                opacity="0.28"
              />
              {/* Crisp red direction centerline */}
              <path
                d={`M ${bottomStartX} ${bottomStartY} C ${ctrl1X} ${ctrl1Y}, ${ctrl2X} ${ctrl2Y}, ${targetX} ${targetY}`}
                fill="none"
                stroke="#E5484D"
                strokeWidth="2.2"
                strokeDasharray="10 10"
                strokeLinecap="round"
                style={{
                  strokeDashoffset: isWalking ? -(walkDistance * 30) % 40 : 0,
                }}
                opacity="0.92"
              />

              {/* Centered forward chevrons aligned directly on the Bezier curve */}
              {[0.18, 0.34, 0.5, 0.66, 0.82].map((baseT, idx) => {
                const t = Math.min(0.92, Math.max(0.12, baseT + shift * 0.5));
                const p = bezPt(t);
                const w = 13 - idx * 1.6;
                return (
                  <path
                    key={idx}
                    d={`M ${p.x - w} ${p.y + w * 0.5} L ${p.x} ${p.y - w * 0.5} L ${p.x + w} ${p.y + w * 0.5}`}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.9 - idx * 0.11}
                  />
                );
              })}
            </g>
          );
        })()}
      </svg>

      {/* DIRECTION PATH label */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-[11px] font-mono font-bold tracking-[0.26em] uppercase text-white/85 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
        DIRECTION PATH
      </div>

      {/* Real Evidenced Hazard Callout (ONLY when real hazard/steep slope exists ahead) */}
      {steepHazardNote && (
        <div
          className="absolute right-[24%] top-[46%] flex flex-col items-center pointer-events-none"
          aria-label="Steep ground ahead"
        >
          <div className="w-28 h-16 rounded-md border border-[#FF3B30]/75 bg-[#FF3B30]/10 shadow-[0_0_16px_rgba(255,59,48,0.3)]" />
          <div className="mt-1 flex items-center gap-1 px-2 py-0.5 rounded bg-black/80 border border-[#E5484D]/60 text-[10px] font-mono text-amber-200 whitespace-nowrap">
            <TriangleAlert className="w-3 h-3 text-[#FF3B30]" />
            <span>Steep ground ahead · {steepHazardNote}</span>
          </div>
        </div>
      )}

      {/* Destination Ground Beacon */}
      <div
        id="hud-destination-marker"
        className="absolute transition-all duration-100 flex flex-col items-center pointer-events-auto"
        style={{
          left: `${screenXPercent}%`,
          top: `${screenYPercent}%`,
          transform: 'translate(-50%, -100%)',
          display: screenXPercent > -20 && screenXPercent < 120 ? 'flex' : 'none',
        }}
      >
        <div className="flex flex-col items-center">
          <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-black/75 backdrop-blur-md border border-[#E5484D]/60 shadow-[0_0_18px_rgba(255,59,48,0.4)]">
            <div className="w-2 h-2 rounded-full bg-[#FF3B30] animate-ping" />
            <span className="text-xs font-mono font-bold text-white tracking-wide">
              {route.destinationName}
            </span>
            <span className="text-[10px] font-mono text-[#ff8a8e] font-semibold">
              {Math.round(distanceRemaining)} m
            </span>
          </div>

          <div className="mt-1 px-2 py-0.5 rounded bg-black/65 border border-white/10 text-[9px] font-mono text-rose-100/80">
            ETA {etaMinutes}m {etaSeconds < 10 ? `0${etaSeconds}` : etaSeconds}s
          </div>
          <div className="w-px h-10 bg-gradient-to-b from-[#FF3B30] to-transparent mt-0.5" />
          <div className="w-2.5 h-1 rounded-full bg-[#FF3B30] shadow-[0_0_8px_#FF3B30]" />
        </div>
      </div>
    </div>
  );
};
