import React, { useState } from 'react';
import { Maximize2, Plus, Minus, Layers } from 'lucide-react';
import { DetectedObject, NavigationRoute } from '../types';

interface MiniMapRadarProps {
  headingDeg: number;
  route: NavigationRoute;
  objects: DetectedObject[];
  distanceRemaining: number;
  walkDistance?: number;
  isWalking?: boolean;
  onExpandMap: () => void;
  onSelectObject: (obj: DetectedObject) => void;
}

export const MiniMapRadar: React.FC<MiniMapRadarProps> = ({
  headingDeg,
  route,
  objects,
  distanceRemaining,
  walkDistance = 0,
  isWalking = false,
  onExpandMap,
  onSelectObject,
}) => {
  const [zoomScale, setZoomScale] = useState<number>(1);
  const radarRadius = 70;
  const maxRangeMeters = 700 / zoomScale;
  const progress = Math.min(1, Math.max(0, walkDistance / (route.totalDistanceMeters || 640)));

  const destAngleRad = ((248 - 90) * Math.PI) / 180;
  const destDistNorm = 0.78;
  const destX = 72 + Math.cos(destAngleRad) * (radarRadius * destDistNorm);
  const destY = 72 + Math.sin(destAngleRad) * (radarRadius * destDistNorm);
  const startX = 72 - Math.cos(destAngleRad) * (radarRadius * 0.65);
  const startY = 72 - Math.sin(destAngleRad) * (radarRadius * 0.65);
  const userX = startX + (destX - startX) * progress;
  const userY = startY + (destY - startY) * progress;

  return (
    <div
      id="hud-minimap-radar"
      className="absolute bottom-24 right-8 z-30 flex flex-col items-end pointer-events-auto select-none"
    >
      <div className="relative p-3 rounded-2xl bg-black/65 backdrop-blur-xl border border-[#E5484D]/35 shadow-[0_8px_32px_rgba(0,0,0,0.65)]">
        <div className="flex items-center justify-between w-full mb-2 text-[10px] font-mono">
          <div className="flex items-center space-x-1.5 text-[#ff8a8e]">
            <Layers className="w-3 h-3 text-[#E5484D]" />
            <span className="font-semibold tracking-wider">RADAR · {Math.round(maxRangeMeters)}m</span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setZoomScale((z) => Math.min(2.5, z + 0.5))}
              className="p-1 rounded bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
              title="Zoom In"
            >
              <Plus className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={() => setZoomScale((z) => Math.max(0.75, z - 0.5))}
              className="p-1 rounded bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
              title="Zoom Out"
            >
              <Minus className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={onExpandMap}
              className="p-1 rounded bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
              title="Open Map"
            >
              <Maximize2 className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        {/* Circular Mars Red Radar Scope */}
        <div className="relative w-36 h-36 rounded-full overflow-hidden border border-[#E5484D]/50 bg-[#0d0506]/80 flex items-center justify-center">
          <div className="absolute w-28 h-28 rounded-full border border-[#E5484D]/25" />
          <div className="absolute w-16 h-16 rounded-full border border-[#E5484D]/35" />
          <div className="absolute w-6 h-6 rounded-full border border-[#E5484D]/45" />

          <div className="absolute inset-x-0 top-1/2 h-px bg-[#E5484D]/25" />
          <div className="absolute inset-y-0 left-1/2 w-px bg-[#E5484D]/25" />

          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'conic-gradient(from 0deg at 50% 50%, rgba(255, 59, 48, 0.28) 0deg, transparent 60deg, transparent 360deg)',
              animation: 'spin 4s linear infinite',
            }}
          />

          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            {progress > 0.01 && (
              <line
                x1={startX}
                y1={startY}
                x2={userX}
                y2={userY}
                stroke="#ff8a8e"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.9"
              />
            )}
            <line
              x1={userX}
              y1={userY}
              x2={destX}
              y2={destY}
              stroke="#E5484D"
              strokeWidth="1.5"
              strokeDasharray="3 2"
              opacity="0.85"
            />
            <circle cx={startX} cy={startY} r="2.5" fill="#fb923c" stroke="#ffffff" strokeWidth="0.8" />
            <circle cx={destX} cy={destY} r="4.5" fill="#FF3B30" stroke="#ffffff" strokeWidth="1.2" className="animate-pulse" />
          </svg>

          <div
            className="absolute z-20 flex items-center justify-center transition-all duration-100"
            style={{ left: `${userX}px`, top: `${userY}px`, transform: 'translate(-50%, -50%)' }}
          >
            {isWalking && (
              <div className="absolute w-8 h-8 rounded-full border border-[#FF3B30]/70 animate-ping pointer-events-none" />
            )}
            <div className="absolute flex items-center justify-center pointer-events-none" style={{ transform: `rotate(${headingDeg}deg)` }}>
              <div className="absolute -top-14 w-0 h-0 border-l-[24px] border-l-transparent border-r-[24px] border-r-transparent border-t-[48px] border-t-[#FF3B30]/25 pointer-events-none" />
            </div>
            <div className="relative w-3 h-3 bg-[#FF3B30] rounded-full shadow-[0_0_10px_#FF3B30] border-2 border-white flex items-center justify-center">
              <div className="w-1 h-1 bg-white rounded-full" />
            </div>
          </div>

          {objects.map((obj) => {
            const angleRad = ((obj.azimuthDeg - 90) * Math.PI) / 180;
            const distNorm = Math.min(0.92, (obj.distanceMeters / maxRangeMeters) * 0.9);
            const x = 72 + Math.cos(angleRad) * (radarRadius * distNorm);
            const y = 72 + Math.sin(angleRad) * (radarRadius * distNorm);
            const isHazard = obj.category === 'HAZARD';
            const blipColor = isHazard
              ? 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,1)]'
              : 'bg-[#FF3B30] shadow-[0_0_6px_#FF3B30]';

            return (
              <button
                key={obj.id}
                onClick={() => onSelectObject(obj)}
                title={`${obj.title.replace(/\s*\(measured DEM\)/gi, '')} (${Math.round(obj.distanceMeters)}m)`}
                className={`absolute w-2 h-2 rounded-full ${blipColor} -translate-x-1/2 -translate-y-1/2 z-20 hover:scale-150 transition-transform`}
                style={{ left: `${x}px`, top: `${y}px` }}
              />
            );
          })}
        </div>

        <div className="flex justify-between items-center mt-2 px-1 text-[9px] font-mono">
          <div className="flex items-center space-x-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isWalking ? 'bg-[#FF3B30] animate-ping' : 'bg-[#E5484D]'}`} />
            <span className="text-white/80 font-semibold">
              {isWalking ? `ADV +${Math.round(walkDistance)}m` : `${Math.round(distanceRemaining)} m to go`}
            </span>
          </div>
          <span className="text-[#ff8a8e] font-bold">N ↑ 000°</span>
        </div>
      </div>
    </div>
  );
};
