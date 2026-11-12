import React from 'react';
import { Mountain, TrendingUp, Timer, Wind, Footprints, Activity } from 'lucide-react';
import { ATMOSPHERE, ATMOSPHERE_SOURCE, MOXIE, SUIT_VS_AMBIENT, WEATHER } from '../lib/jezeroReal';
import { ExplainButton } from './ExplainButton';

export interface OxygenHud {
  remainingPct: number;   // from the route's oxygen model (assumption), not real suit telemetry
  reservePct: number;
  canReturn: boolean;     // could the crew still walk back to the start and keep the reserve?
}

interface Props {
  elevationM: number | null;
  slopeDeg: number | null;
  cautionSlope: number;
  maxSlope: number;
  distanceRemaining: number;
  etaMin: number;
  elapsedMin: number;
  oxygen: OxygenHud | null;
  nature?: string;
  /** HUD Level 3 shows the full atmosphere/weather/MOXIE science detail. */
  detail?: boolean;
}

function o2Meaning(o: OxygenHud): string {
  if (o.remainingPct < o.reservePct) return `Oxygen ${Math.round(o.remainingPct)}% — below the ${o.reservePct}% reserve. Turn back now; the model says the walk back plus reserve no longer fits.`;
  if (!o.canReturn) return `Oxygen ${Math.round(o.remainingPct)}% — enough to finish, but not enough to walk all the way back with reserve to spare.`;
  return `Oxygen ${Math.round(o.remainingPct)}% — enough to walk back with reserve to spare.`;
}

/** Top-right HUD. Three groups, clearly separated:
 *  1) values from the elevation data along the route (elevation, slope)
 *  2) the suit MODEL: travel time and oxygen computed by the planner from stated assumptions (not live suit telemetry)
 *  3) REAL Mars air (NASA NSSDC / MEDA / MOXIE) — the air outside the suit, with a plain-English meaning under every number. */
export const EnvironmentTelemetryHud: React.FC<Props> = ({ elevationM, slopeDeg, cautionSlope, maxSlope, distanceRemaining, etaMin, elapsedMin, oxygen, nature = 'STATIC DEM', detail = false }) => {
  const slopeColor = slopeDeg == null ? 'text-white/60' : slopeDeg > maxSlope ? 'text-red-400' : slopeDeg > cautionSlope ? 'text-amber-300' : 'text-emerald-300';
  const slopeMeaning = slopeDeg == null ? 'No slope data here.' : slopeDeg > maxSlope ? `Slope ${slopeDeg.toFixed(1)}° — over the ${maxSlope}° limit, so the route goes around it.` : slopeDeg > cautionSlope ? `Slope ${slopeDeg.toFixed(1)}° — steep enough to take care, but under the ${maxSlope}° limit.` : `Slope ${slopeDeg.toFixed(1)}° — gentle ground, easy walking.`;
  const o2Color = !oxygen ? 'text-white/60' : oxygen.remainingPct < oxygen.reservePct ? 'text-red-400' : !oxygen.canReturn ? 'text-amber-300' : 'text-[#ff8a8e]';
  return (
    <div id="hud-environment-telemetry" className="absolute top-20 right-8 z-30 w-60 flex flex-col space-y-2 pointer-events-auto select-none">
      <div className="rounded-xl bg-slate-950/50 backdrop-blur-lg border border-white/10 p-2.5 space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono tracking-widest text-white/60">
          <span className="flex items-center gap-1.5"><Activity className="w-3 h-3 text-[#E5484D]" />TERRAIN HERE</span>
          <span className="px-1.5 rounded border border-white/15 text-[9px]">{nature}</span>
        </div>
        <Row icon={<Mountain className="w-4 h-4 text-[#ff8a8e]" />} label="ELEVATION" value={elevationM == null ? '—' : `${Math.round(elevationM)} m`} />
        <Row icon={<TrendingUp className="w-4 h-4 text-amber-300" />} label="SLOPE" value={slopeDeg == null ? '—' : `${slopeDeg.toFixed(1)}°`} valueClass={slopeColor} />
        <p className="text-[9px] text-white/50 leading-snug">{slopeMeaning}</p>
        <Row icon={<Timer className="w-4 h-4 text-emerald-300" />} label="TO GO" value={`${Math.round(distanceRemaining)} m · ${etaMin} min`} />
      </div>
      <div className="rounded-xl bg-slate-950/40 backdrop-blur-lg border border-dashed border-white/15 p-2.5 space-y-1.5">
        <div className="text-[10px] font-mono tracking-widest text-white/45">OXYGEN LEFT (SUIT MODEL)</div>
        <Row icon={<Footprints className="w-4 h-4 text-emerald-300/80" />} label="TRAVEL TIME" value={`${Math.round(elapsedMin)} / ${Math.round(elapsedMin + etaMin)} min`} />
        <Row icon={<Wind className="w-4 h-4 text-[#ff8a8e]" />} label="OXYGEN LEFT" value={oxygen ? `${Math.round(oxygen.remainingPct)}%` : '—'} valueClass={o2Color} />
        {oxygen && (
          <>
            <div className="relative h-1.5 rounded bg-white/10 overflow-hidden" aria-label={`oxygen ${Math.round(oxygen.remainingPct)}% , reserve ${oxygen.reservePct}%`}>
              <div className={`h-full ${oxygen.remainingPct < oxygen.reservePct ? 'bg-red-500' : 'bg-[#FF3B30]'}`} style={{ width: `${Math.max(0, Math.min(100, oxygen.remainingPct))}%` }} />
              <div className="absolute top-0 bottom-0 w-[2px] bg-amber-300" style={{ left: `${oxygen.reservePct}%` }} />
            </div>
            <p className="text-[9px] text-white/55 leading-snug">{o2Meaning(oxygen)}</p>
          </>
        )}
        <p className="text-[9px] text-white/35 leading-snug">Computed from the route and stated assumptions (not live suit telemetry). Amber line = reserve. This is SUIT oxygen — Mars air itself is only 0.16% oxygen.</p>
      </div>
      {detail && (
        <div className="rounded-xl bg-slate-950/50 backdrop-blur-lg border border-white/10 p-2.5 space-y-1.5">
          <div className="text-[10px] font-mono tracking-widest text-white/60">MARS AIR — REAL <ExplainButton term="meda" /></div>
          {ATMOSPHERE.map((g) => (
            <div key={g.formula} className="flex justify-between text-[11px] font-mono"><span className="text-white/60">{g.gas} ({g.formula})</span><span>{g.volPct}%</span></div>
          ))}
          <p className="text-[9px] text-white/50 leading-snug">CO₂ 95.1% — almost all the air is carbon dioxide. You cannot breathe it. O₂ 0.16% — almost no oxygen in the air; that is why you wear a suit.</p>
          <p className="text-[9px] text-white/35 leading-snug">{ATMOSPHERE_SOURCE}</p>
          <div className="border-t border-white/10 pt-1.5 space-y-1 text-[11px] font-mono">
            <div className="flex justify-between"><span className="text-white/60">Pressure</span><span>{WEATHER.pressurePa} Pa</span></div>
            <p className="text-[9px] font-sans text-white/50 leading-snug">{WEATHER.pressurePlain}</p>
            <div className="flex justify-between"><span className="text-white/60">Temperature</span><span>{WEATHER.tempHighC} / {WEATHER.tempLowC} °C</span></div>
            <p className="text-[9px] font-sans text-white/50 leading-snug">{WEATHER.tempHighC} °C is the daytime high, {WEATHER.tempLowC} °C the night low (MEDA, sols 43–44). Even the warmest part of the day is colder than a freezer.</p>
            <div className="flex justify-between"><span className="text-white/60">Wind gusts</span><span>{WEATHER.windGustMs} m/s</span></div>
            <div className="flex justify-between"><span className="text-white/60">MOXIE oxygen made</span><span>{MOXIE.totalO2g} g · {MOXIE.runs} runs</span></div>
            <p className="text-[9px] font-sans text-white/50 leading-snug">{MOXIE.plain} <ExplainButton term="moxie" /></p>
            <p className="text-[9px] font-sans text-white/50 leading-snug">Suit air is {SUIT_VS_AMBIENT.suitO2Pct}% oxygen — that is SUIT air, not Mars air. Habitat pressure {SUIT_VS_AMBIENT.habitatKPa} kPa is inside a habitat; Mars outside is {SUIT_VS_AMBIENT.ambientPa} Pa.</p>
            <p className="text-[9px] text-white/35 leading-snug">Sources: {WEATHER.source}; {MOXIE.source}.</p>
          </div>
        </div>
      )}
    </div>
  );
};

const Row = ({ icon, label, value, valueClass = 'text-white' }: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) => (
  <div className="flex items-center justify-between rounded-lg bg-slate-900/40 border border-white/5 px-2.5 py-1.5">
    <span className="flex items-center gap-2 text-[10px] font-mono text-white/55 tracking-wider">{icon}{label}</span>
    <span className={`text-sm font-mono font-bold ${valueClass}`}>{value}</span>
  </div>
);
