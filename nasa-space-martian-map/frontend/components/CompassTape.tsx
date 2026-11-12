import React from 'react';
import { Compass, Navigation } from 'lucide-react';

interface CompassTapeProps {
  headingDeg: number;
  targetBearingDeg: number;
  destinationName: string;
  coordinates: {
    lat: string;
    lng: string;
    elevation: string;
  };
  elapsedMin?: number;
}

export const CompassTape: React.FC<CompassTapeProps> = ({
  headingDeg,
  targetBearingDeg,
  coordinates,
  elapsedMin = 0,
}) => {
  const normalizedHeading = ((headingDeg % 360) + 360) % 360;

  const visibleTicks = [];
  const startTick = Math.floor((normalizedHeading - 45) / 5) * 5;
  const endTick = Math.ceil((normalizedHeading + 45) / 5) * 5;

  for (let deg = startTick; deg <= endTick; deg += 5) {
    const rawDeg = ((deg % 360) + 360) % 360;
    const offsetFromCenter = deg - normalizedHeading;

    let label = '';
    if (rawDeg === 0) label = 'N';
    else if (rawDeg === 45) label = 'NE';
    else if (rawDeg === 90) label = 'E';
    else if (rawDeg === 135) label = 'SE';
    else if (rawDeg === 180) label = 'S';
    else if (rawDeg === 225) label = 'SW';
    else if (rawDeg === 270) label = 'W';
    else if (rawDeg === 315) label = 'NW';
    else if (rawDeg % 15 === 0) label = `${rawDeg}°`;

    visibleTicks.push({
      deg: rawDeg,
      offset: offsetFromCenter,
      isMajor: rawDeg % 15 === 0,
      isCardinal: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].includes(label),
      label,
    });
  }

  let bearingDiff = targetBearingDeg - normalizedHeading;
  while (bearingDiff > 180) bearingDiff -= 360;
  while (bearingDiff < -180) bearingDiff += 360;
  const showBearingPip = Math.abs(bearingDiff) <= 45;

  // Format planner elapsed time cleanly (MM:SS of simulated EVA) — never copy reference clock numbers
  const totalSec = Math.max(0, Math.round(elapsedMin * 60));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');

  return (
    <div id="hud-top-compass" className="w-full flex flex-col items-center pointer-events-none select-none">
      {/* Subtle coordinate readout strip at top edge */}
      <div className="flex items-center justify-between w-full max-w-4xl px-8 pt-1.5 text-[10px] font-mono tracking-wider text-rose-100/75 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
        <div className="flex items-center space-x-2.5">
          <span className="flex items-center space-x-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#FF3B30] animate-pulse" />
            <span className="text-white font-semibold">HELMET EVA</span>
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <span>LAT {coordinates.lat}</span>
          <span>LNG {coordinates.lng}</span>
          <span className="text-[#ff8a8e] font-semibold">ELEV {coordinates.elevation}</span>
        </div>
      </div>

      {/* Sleek Reference-Style Transparent Mars Red Compass Tape */}
      <div className="relative w-full max-w-xl h-12 mt-0.5 flex items-center justify-center overflow-hidden">
        <div className="relative z-20 -top-3.5 flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-black/70 border border-[#E5484D]/55 shadow-[0_0_12px_rgba(255,59,48,0.28)]">
          <Compass className="w-3 h-3 text-[#FF3B30]" />
          <span className="text-[11px] font-mono font-bold tracking-wider text-white">
            {String(Math.round(normalizedHeading)).padStart(3, '0')}°
          </span>
        </div>

        {/* Moving Compass Ticks */}
        <div className="relative w-full h-8 flex items-center justify-center">
          {visibleTicks.map((tick, idx) => {
            const xOffsetPx = tick.offset * 6.2;
            return (
              <div
                key={`${tick.deg}-${idx}`}
                className="absolute flex flex-col items-center transition-transform duration-75"
                style={{
                  transform: `translateX(${xOffsetPx}px)`,
                  opacity: Math.max(0, 1 - Math.abs(tick.offset) / 46),
                }}
              >
                <div
                  className={`w-px ${
                    tick.isCardinal
                      ? 'h-3.5 bg-[#FF3B30] shadow-[0_0_6px_rgba(255,59,48,0.85)]'
                      : tick.isMajor
                      ? 'h-2.5 bg-white/80'
                      : 'h-1.5 bg-[#E5484D]/45'
                  }`}
                />
                {tick.label && (
                  <span
                    className={`mt-1 font-mono text-[10px] tracking-tight leading-none ${
                      tick.isCardinal ? 'text-white font-bold' : 'text-rose-200/75 font-medium'
                    }`}
                  >
                    {tick.label}
                  </span>
                )}
              </div>
            );
          })}

          {showBearingPip && (
            <div
              className="absolute z-20 flex flex-col items-center pointer-events-none transition-transform duration-100"
              style={{ transform: `translateX(${bearingDiff * 6.2}px)` }}
            >
              <div className="p-0.5 rounded-full bg-[#FF3B30] shadow-[0_0_10px_#FF3B30]">
                <Navigation className="w-2.5 h-2.5 text-white fill-white rotate-45" />
              </div>
              <span className="text-[8px] font-mono font-bold text-[#ff8a8e] bg-black/75 px-1 rounded">
                DEST
              </span>
            </div>
          )}
        </div>

        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-black/60 to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-black/60 to-transparent pointer-events-none" />
      </div>

      {/* Real Jezero Survey Sol + Planner EVA Timer underneath compass (never reference SOL 420 / 14:32) */}
      <div className="px-3 py-0.5 rounded-full bg-black/55 border border-[#E5484D]/35 text-[11px] font-mono font-bold tracking-widest text-white">
        SOL 1212 | +{mm}:{ss}
      </div>
    </div>
  );
};
