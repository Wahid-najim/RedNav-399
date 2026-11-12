'use client';

import React, { useMemo } from 'react';
import { MapPin, TriangleAlert, Compass } from 'lucide-react';
import { DetectedObject } from '../types';

interface Props {
  objects: DetectedObject[];
  headingDeg: number;
  pitchDeg: number;
  selectedObjectId: string | null;
  goalId?: string | null;
  maxLabels?: number;
  hazardZoomRangeM?: number;
  onSelectObject: (obj: DetectedObject) => void;
  onSetNavigationTarget: (obj: DetectedObject) => void;
  onOpenInformation: (obj: DetectedObject) => void;
}

interface ProjectedTag {
  obj: DetectedObject;
  xPct: number;
  yPct: number;
  isGoal: boolean;
  cleanTitle: string;
}

/**
 * Projects up to 3 clean, non-overlapping AR floating labels in 3D view.
 * Strips raw dataset suffixes ("(measured DEM)"), hides distant hazards unless zoomed within 600 m,
 * and prioritises the active goal and nearest landmarks.
 */
export const ArDetectionOverlay: React.FC<Props> = ({
  objects,
  headingDeg,
  pitchDeg,
  selectedObjectId,
  goalId,
  maxLabels = 3,
  hazardZoomRangeM = 600,
  onSelectObject,
  onSetNavigationTarget,
  onOpenInformation,
}) => {
  const visible = useMemo<ProjectedTag[]>(() => {
    const hFov = 70;
    const candidates: ProjectedTag[] = [];

    for (const obj of objects) {
      // Only surface hazard tags at close range (< 600 m) or when explicitly selected
      if (obj.category === 'HAZARD' && obj.distanceMeters > hazardZoomRangeM && obj.id !== selectedObjectId) {
        continue;
      }

      const relAngle = ((obj.azimuthDeg - headingDeg + 540) % 360) - 180;
      if (Math.abs(relAngle) > hFov * 0.48) continue;

      const xPct = 50 + (relAngle / hFov) * 90;
      // Place landmark labels cleanly in the upper horizon band so astronaut badges stay unobstructed
      const normDist = Math.min(1, Math.log10(Math.max(50, obj.distanceMeters)) / 4);
      const yPct = Math.max(19, Math.min(34, 34 - normDist * 14 + pitchDeg * 0.3));

      const cleanTitle = obj.title.replace(/\s*\(measured DEM\)/gi, '').trim();
      candidates.push({
        obj,
        xPct,
        yPct,
        isGoal: obj.id === goalId,
        cleanTitle,
      });
    }

    // Prioritize selected object, active destination, science sites, then closest distance
    candidates.sort((a, b) => {
      if (a.obj.id === selectedObjectId) return -1;
      if (b.obj.id === selectedObjectId) return 1;
      if (a.isGoal !== b.isGoal) return a.isGoal ? -1 : 1;
      if (a.obj.category !== b.obj.category) return a.obj.category === 'HAZARD' ? 1 : -1;
      return a.obj.distanceMeters - b.obj.distanceMeters;
    });

    // Screen-space collision culling: keep >= 18% horizontal & 10% vertical separation
    const accepted: ProjectedTag[] = [];
    for (const c of candidates) {
      if (accepted.length >= maxLabels) break;
      const overlaps = accepted.some(
        (k) => Math.abs(k.xPct - c.xPct) < 18 && Math.abs(k.yPct - c.yPct) < 11
      );
      if (!overlaps) accepted.push(c);
    }
    return accepted;
  }, [objects, headingDeg, pitchDeg, selectedObjectId, goalId, maxLabels, hazardZoomRangeM]);

  return (
    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden select-none">
      {visible.map(({ obj, xPct, yPct, isGoal, cleanTitle }) => {
        const isSelected = obj.id === selectedObjectId;
        const isHazard = obj.category === 'HAZARD';
        const isCrew = obj.category === 'CREW';

        return (
          <div
            key={obj.id}
            style={{ left: `${xPct}%`, top: `${yPct}%`, transform: 'translate(-50%, -100%)' }}
            className="absolute pointer-events-auto"
          >
            <button
              type="button"
              onClick={() => {
                onSelectObject(obj);
                if (!isHazard && !isCrew) onOpenInformation(obj);
              }}
              onDoubleClick={() => {
                if (!isHazard && !isCrew) onSetNavigationTarget(obj);
              }}
              className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-full border backdrop-blur-md transition ${
                isSelected || isGoal
                  ? 'bg-black/85 border-[#FF3B30]/80 text-white shadow-[0_0_14px_rgba(255,59,48,0.35)]'
                  : isHazard
                  ? 'bg-red-950/75 border-amber-400/70 text-amber-100'
                  : 'bg-black/65 border-white/20 text-white/90 hover:bg-black/85'
              }`}
              title="Click for site info · double-click to navigate"
            >
              {isHazard ? (
                <TriangleAlert className="w-3 h-3 text-amber-400 shrink-0" />
              ) : isGoal ? (
                <Compass className="w-3 h-3 text-[#FF3B30] shrink-0" />
              ) : (
                <MapPin className="w-3 h-3 text-[#E5484D] shrink-0" />
              )}
              <span className="text-[11px] font-mono font-bold tracking-tight whitespace-nowrap">
                {cleanTitle}
              </span>
              <span className="text-[10px] font-mono text-[#ff8a8e] whitespace-nowrap">
                · {Math.round(obj.distanceMeters).toLocaleString()} m
              </span>
            </button>
            <div className="mx-auto w-px h-3 bg-white/30" />
          </div>
        );
      })}
    </div>
  );
};
