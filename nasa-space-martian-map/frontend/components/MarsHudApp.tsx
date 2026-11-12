'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Info, Backpack, Camera, Search, Zap, Wind, FastForward, Home, TriangleAlert, RotateCcw, Pickaxe } from 'lucide-react';
import { HudMode, VisorTint } from '../types';
import { api, getApiDisplayBase } from '../lib/api';
import { useMission } from '../lib/useMission';
import { computeCrewStates } from '../lib/crew';
import { isInResearchPond, RESEARCH_POND } from '../lib/researchPond';
import { ErrorBoundary } from './ErrorBoundary';
import { SciencePodModal } from './SciencePodModal';
import { ResearchPondModal } from './ResearchPondModal';
import { buildNavRoute, buildObjects, pathState, positionAt, quantityAt, slopeAhead } from '../lib/sim';
import { offsetM, fmtLat, fmtLon } from '../lib/geo';
import { CompassTape } from './CompassTape';
import { EnvironmentTelemetryHud, type OxygenHud } from './EnvironmentTelemetryHud';
import { HudWarnings, type HudAlert } from './HudWarnings';
import { AstronautIntro } from './AstronautIntro';
import { TurnByTurnBanner } from './TurnByTurnBanner';
import { ArGroundPath } from './ArGroundPath';
import { ArDetectionOverlay } from './ArDetectionOverlay';
import { MiniMapRadar } from './MiniMapRadar';
import { BottomNavControls } from './BottomNavControls';
import { HelmetVisorOverlay } from './HelmetVisorOverlay';
import { Mars3dSurface } from './Mars3dSurface';
import { LayeredMapModal } from './LayeredMapModal';
import { ToolsModal } from './ToolsModal';
import { InformationSidePanel } from './InformationSidePanel';
import { ResearchLab } from './ResearchLab';
import { MissionPanel } from './MissionPanel';
import { useGameProgress } from '../lib/progress';
import { realSiteById } from '../lib/jezeroReal';
import { hudSound } from '../utils/soundEffects';
import { ObjectiveTracker } from './ObjectiveTracker';
import { MissionCinematic } from './MissionCinematic';
import { PauseMenu } from './PauseMenu';
import { ToastContainer, type ToastMessage } from './ToastContainer';
import {
  MISSION_PATCHES,
  buildZapFinding,
  percyJobForMission,
  saveUiMode,
  type UiMode,
  type ZapFinding,
} from '../lib/juniorMode';
import {
  BackpackModal,
  BlueSunsetModal,
  DetectiveCaseModal,
  FriendlyRescueModal,
  PercyCompanion,
  PhotoModeModal,
  ZapCardModal,
} from './JuniorComponents';
import type { RouteResult, Site } from '../lib/missionTypes';

type HudLevel = 1 | 2 | 3;
const LEVEL_LABEL: Record<HudLevel, string> = { 1: 'ESSENTIAL', 2: 'STANDARD', 3: 'DETAIL' };

const SIM_SPEEDUP = 8;

export default function App({
  regionId = 'jezero_delta',
  initialUiMode = 'grownup',
  onQuit,
}: {
  regionId?: string;
  initialUiMode?: UiMode;
  onQuit?: () => void;
}) {
  const mission = useMission(regionId);
  const { meta, sites, hazards, demGrid, route, goal, options } = mission;

  const [uiMode, setUiMode] = useState<UiMode>(initialUiMode);
  const isJunior = uiMode === 'junior';

  const toggleUiMode = useCallback(() => {
    setUiMode((prev) => {
      const next: UiMode = prev === 'junior' ? 'grownup' : 'junior';
      saveUiMode(next);
      return next;
    });
  }, []);

  const [activeMode, setActiveMode] = useState<HudMode>('MAP');
  const [visorTint, setVisorTint] = useState<VisorTint>('clear');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [panOffset, setPanOffset] = useState(0);
  const [pitchOffset, setPitchOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const drag = useRef({ x: 0, y: 0, pan: 0, pitch: 0 });

  const [isWalking, setIsWalking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [walked, setWalked] = useState(0);
  const [stepPhase, setStepPhase] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isInformationOpen, setIsInformationOpen] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [hudLevel, setHudLevel] = useState<HudLevel>(1);
  const [labOpen, setLabOpen] = useState(false);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [podOpen, setPodOpen] = useState(false);
  const [pondOpen, setPondOpen] = useState(false);
  const [pondBanner, setPondBanner] = useState<'entered' | 'left' | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const game = useGameProgress();

  useEffect(() => {
    setNowMs(Date.now());
    if (activeMode !== 'NAVIGATION') return;
    const id = setInterval(() => setNowMs(Date.now()), 750);
    return () => clearInterval(id);
  }, [activeMode]);

  const [passedInfo, setPassedInfo] = useState<{
    missionId: string;
    title: string;
    distanceM: number;
    elevGainM: number;
    o2Remaining: number | null;
    sitesVisited: number;
  } | null>(null);
  const [failedInfo, setFailedInfo] = useState<{ missionId: string; title: string; reason: string } | null>(null);

  // Junior Astronaut modal & event states
  const [zapFinding, setZapFinding] = useState<ZapFinding | null>(null);
  const [backpackOpen, setBackpackOpen] = useState(false);
  const [detectiveOpen, setDetectiveOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [blueSunsetPatch, setBlueSunsetPatch] = useState<string | null>(null);
  const [dustStormActive, setDustStormActive] = useState(false);

  const prevArrived = useRef(false);
  const breachReported = useRef(false);

  // Toasts and Cinematics
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showCinematic, setShowCinematic] = useState(true);

  const addToast = useCallback((text: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev.slice(-3), { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    setShowCinematic(true);
  }, [game.activeMission.id]);

  const [juniorLegRoute, setJuniorLegRoute] = useState<RouteResult | null>(null);

  // Plan real ~300 m short discovery leg in Junior mode whenever route exceeds 350 m (except direct Pond arrival)
  useEffect(() => {
    if (
      !isJunior ||
      !route ||
      !route.points ||
      route.points.length < 2 ||
      (route.distance_m ?? 0) <= 350 ||
      goal?.id === RESEARCH_POND.anchorSiteId
    ) {
      setJuniorLegRoute(null);
      return;
    }
    const pts = route.points;
    let cum = 0;
    let bestPt = pts[Math.min(1, pts.length - 1)];
    let bestErr = Infinity;
    for (let i = 1; i < pts.length; i++) {
      const { dx, dy } = offsetM(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon);
      cum += Math.hypot(dx, dy);
      const err = Math.abs(cum - 300);
      if (err < bestErr) {
        bestErr = err;
        bestPt = pts[i];
      }
      if (cum > 340) break;
    }

    let cancelled = false;
    api
      .route({
        region_id: regionId,
        start: mission.start ?? { lat: pts[0].lat, lon: pts[0].lon },
        goal: { lat: bestPt.lat, lon: bestPt.lon },
        obstacles: mission.obstacles,
        ...(options ?? {}),
      })
      .then((res) => {
        if (cancelled) return;
        const match =
          res.routes.find((r) => r.found && r.strategy === route.strategy) ??
          res.routes.find((r) => r.found) ??
          null;
        setJuniorLegRoute(match);
      })
      .catch(() => {
        if (!cancelled) setJuniorLegRoute(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isJunior, route, goal?.id, regionId, mission.start, mission.obstacles, options]);

  const activeRoute = isJunior && juniorLegRoute ? juniorLegRoute : route;

  const ps = useMemo(() => pathState(activeRoute), [activeRoute]);
  const pos = useMemo(() => positionAt(activeRoute, ps, walked), [activeRoute, ps, walked]);
  const startPos = mission.start ?? null;
  const here = pos ?? (startPos ? { ...startPos, elev: NaN, slope: NaN, heading: 0 } : null);
  const navRoute = useMemo(() => buildNavRoute(activeRoute, ps, goal, walked), [activeRoute, ps, goal, walked]);
  const objects = useMemo(
    () => buildObjects(meta, sites, hazards, here),
    [meta, sites, hazards, here?.lat, here?.lon] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // new route => walk restarts at the start point
  useEffect(() => {
    setWalked(0);
    setIsWalking(false);
  }, [activeRoute]);

  const baseHeading = here?.heading ?? 0;
  const heading = (baseHeading + panOffset + 360) % 360;
  const speed = (options?.walk_speed_ms ?? 0.8) / (options?.load_factor ?? 1);
  const distanceRemaining = Math.max(0, ps.total - walked);
  const etaMin = Math.round(distanceRemaining / Math.max(speed, 0.1) / 60);

  // ---- suit model values come from the planner (activeRoute.safety), not from invented telemetry ----
  const o2 = activeRoute?.safety?.oxygen ?? null;
  const o2UsedHere = quantityAt(activeRoute, ps, walked, 'o2_used_pct');
  const arrived = ps.total > 0 && walked >= ps.total - 0.5;
  const o2Remaining = o2 && o2UsedHere != null ? 100 - o2UsedHere - (arrived ? o2.stop_used_pct : 0) : null;
  const oxygenHud: OxygenHud | null =
    o2 && o2Remaining != null
      ? {
          remainingPct: o2Remaining,
          reservePct: o2.reserve_pct,
          canReturn: o2Remaining - (o2UsedHere ?? 0) >= o2.reserve_pct,
        }
      : null;
  const elapsedMin = quantityAt(activeRoute, ps, walked, 't_min') ?? 0;

  const podDistanceM = useMemo(() => {
    if (!here) return 0;
    const { dx, dy } = offsetM(here.lat, here.lon, 18.4446, 77.4509);
    return Math.round(Math.hypot(dx, dy));
  }, [here?.lat, here?.lon]); // eslint-disable-line react-hooks/exhaustive-deps
  const nearPod = podDistanceM <= 300;
  const inPond = here ? isInResearchPond(here.lat, here.lon) : false;
  const prevInPond = useRef(false);

  useEffect(() => {
    if (inPond && !prevInPond.current) {
      setPondBanner('entered');
      addToast('You are in the Research Pond (dry ancient lakebed — zero liquid water)', 'success');
    } else if (!inPond && prevInPond.current) {
      setPondBanner('left');
      addToast('You left the Research Pond', 'info');
    }
    prevInPond.current = inPond;
  }, [inPond, addToast]);

  useEffect(() => {
    if (pondBanner !== 'left') return;
    const t = setTimeout(() => setPondBanner(null), 4000);
    return () => clearTimeout(t);
  }, [pondBanner]);

  const liveCrew = useMemo(
    () => (nowMs > 0 ? computeCrewStates(sites, here, activeRoute?.points ?? null, nowMs) : []),
    [sites, here?.lat, here?.lon, activeRoute?.points, nowMs] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Trigger a gentle dust-storm gust event if spaceWeather reports high wind/Kp or midway on sol walk
  useEffect(() => {
    if (isJunior && ps.total > 0 && walked > ps.total * 0.65 && walked < ps.total * 0.72 && !dustStormActive) {
      setDustStormActive(true);
      addToast('Storm coming — head home.', 'warning');
    }
  }, [isJunior, walked, ps.total, dustStormActive, addToast]);

  const alerts: HudAlert[] = useMemo(() => {
    const out: HudAlert[] = [];
    if (!activeRoute) return out;
    if (oxygenHud) {
      if (oxygenHud.remainingPct < oxygenHud.reservePct)
        out.push({
          id: 'o2-low',
          level: 'critical',
          text: isJunior
            ? `Air left ${Math.round(oxygenHud.remainingPct)}% — Percy is ready to give you a ride!`
            : `OXYGEN ${Math.round(oxygenHud.remainingPct)}% — below the ${oxygenHud.reservePct}% reserve (model). Return or request pickup.`,
        });
      else if (!oxygenHud.canReturn && !arrived)
        out.push({
          id: 'o2-return',
          level: 'warning',
          text: isJunior
            ? `Air left ${Math.round(oxygenHud.remainingPct)}% — time to plan our ride back soon!`
            : `Point of no return passed: ${Math.round(oxygenHud.remainingPct)}% oxygen cannot cover the walk back plus the ${oxygenHud.reservePct}% reserve (model).`,
        });
    }
    const sa = slopeAhead(activeRoute, ps, walked, 80);
    const caution = options?.caution_slope_deg ?? 12;
    if (sa && sa.slope > caution)
      out.push({
        id: 'slope',
        level: 'warning',
        text: isJunior
          ? `Steep hill ahead (${sa.slope.toFixed(1)}°) — Percy found an easier way around!`
          : `Steep section ahead: ${sa.slope.toFixed(1)}° in ${Math.round(sa.atM)} m (caution ${caution}°). Route stays under the ${options?.max_slope_deg ?? 20}° limit in the data used.`,
      });
    const hz = objects
      .filter((o) => o.category === 'HAZARD' && o.distanceMeters <= 250)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];
    if (hz)
      out.push({
        id: `hz-${hz.id}`,
        level: 'warning',
        text: `${hz.title.replace(/\s*\(measured DEM\)/gi, '')}: ${hz.distanceMeters} m away. The route steers clear of it.`,
      });
    if (arrived)
      out.push({
        id: 'arrived',
        level: 'info',
        text: isJunior
          ? juniorLegRoute
            ? `First ${Math.round(ps.total)} m stop reached! Tap Zap Rock or pick another place on the map.`
            : `Yay! We reached ${goal?.name ?? 'the target'}! Tap Zap Rock to scan it!`
          : `Arrived at ${goal?.name ?? 'destination'}. ${goal?.science_purpose ?? goal?.goal ?? ''}`,
      });
    return out;
  }, [
    activeRoute,
    ps,
    walked,
    oxygenHud?.remainingPct,
    oxygenHud?.canReturn,
    objects,
    options?.caution_slope_deg,
    options?.max_slope_deg,
    arrived,
    goal,
    isJunior,
    juniorLegRoute,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hudLevel === 3) setIsInformationOpen(true);
    if (hudLevel === 1) setIsInformationOpen(false);
  }, [hudLevel]);

  // walk loop (respects isPaused; Junior mode walks a 300 m leg as a ~60s time-lapse with synced O2)
  const walkRateMs = isJunior && juniorLegRoute ? Math.max(4.5, ps.total / 60) : speed * SIM_SPEEDUP;
  const handleSkipWalk = useCallback(() => {
    if (ps.total <= 0) return;
    setIsWalking(false);
    setWalked(ps.total);
    addToast('Skipped to arrival stop — real suit values synced!', 'info');
  }, [ps.total, addToast]);

  useEffect(() => {
    if (!isWalking || isPaused) return;
    let id: number;
    let last = performance.now();
    let phase = stepPhase;
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      phase = (phase + ((2 * Math.PI) / 1.25) * dt) % (2 * Math.PI);
      setStepPhase(phase);
      setElapsed((e) => e + dt * SIM_SPEEDUP);
      setWalked((w) => {
        const nw = Math.min(ps.total, w + walkRateMs * dt);
        if (nw >= ps.total) setIsWalking(false);
        return nw;
      });
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [isWalking, isPaused, walkRateMs, ps.total]); // eslint-disable-line react-hooks/exhaustive-deps

  // keyboard (respects text inputs!)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (podOpen) { setPodOpen(false); return; }
        if (zapFinding) { setZapFinding(null); return; }
        if (backpackOpen) { setBackpackOpen(false); return; }
        if (detectiveOpen) { setDetectiveOpen(false); return; }
        if (photoOpen) { setPhotoOpen(false); return; }
        if (blueSunsetPatch) { setBlueSunsetPatch(null); return; }
        if (labOpen) { setLabOpen(false); return; }
        if (missionsOpen) { setMissionsOpen(false); return; }
        if (isInformationOpen) { setIsInformationOpen(false); return; }
        setIsPaused((p) => !p);
        return;
      }

      if (e.key.toLowerCase() === 'e' && nearPod && !podOpen) {
        e.preventDefault();
        setPodOpen(true);
        return;
      }

      if (activeMode !== 'NAVIGATION') {
        if (e.key.toLowerCase() === 'm') setActiveMode('NAVIGATION');
        return;
      }

      const k = e.key.toLowerCase();
      if (k === '1' || k === '2' || k === '3') setHudLevel(Number(k) as HudLevel);
      else if (k === 'arrowleft' || k === 'a') setPanOffset((p) => Math.max(-50, p - 3));
      else if (k === 'arrowright' || k === 'd') setPanOffset((p) => Math.min(50, p + 3));
      else if (k === 'arrowup' || k === 'w') setPitchOffset((p) => Math.min(16, p + 2));
      else if (k === 'arrowdown' || k === 's') setPitchOffset((p) => Math.max(-16, p - 2));
      else if (k === ' ') {
        e.preventDefault();
        if (activeRoute) setIsWalking((w) => !w);
      } else if (k === 'm') setActiveMode('MAP');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    activeMode,
    activeRoute,
    labOpen,
    missionsOpen,
    podOpen,
    nearPod,
    isInformationOpen,
    zapFinding,
    backpackOpen,
    detectiveOpen,
    photoOpen,
    blueSunsetPatch,
  ]);

  useEffect(() => {
    hudSound.enabled = soundEnabled;
    if (soundEnabled) hudSound.startMartianWind();
    else hudSound.stopMartianWind();
    return () => hudSound.stopMartianWind();
  }, [soundEnabled]);

  const pnrDistanceM = useMemo(() => {
    if (!route?.points?.length || !o2) return null;
    const threshold = (100 - o2.reserve_pct) / 2;
    const pts = route.points;
    for (let i = 0; i < pts.length; i++) {
      if ((pts[i].o2_used_pct ?? 0) >= threshold) {
        return Math.round((i / Math.max(pts.length - 1, 1)) * ps.total);
      }
    }
    return null;
  }, [route, o2, ps.total]);

  const belowReserve = !!oxygenHud && oxygenHud.remainingPct < oxygenHud.reservePct;
  const isLowO2Drama = (oxygenHud?.remainingPct ?? 100) < 30;

  useEffect(() => {
    if (belowReserve && isWalking && !isJunior) hudSound.startHeartbeat();
    else hudSound.stopHeartbeat();
    return () => hudSound.stopHeartbeat();
  }, [belowReserve, isWalking, isJunior]);

  const awardPatchSunset = useCallback(
    (missionId: string) => {
      if (!isJunior) return;
      const patch = MISSION_PATCHES.find((p) => p.missionId === missionId);
      if (patch) setBlueSunsetPatch(patch.name);
    },
    [isJunior]
  );

  // Arrival
  useEffect(() => {
    if (arrived && !prevArrived.current) {
      const g = goal;
      if (g) {
        const real = realSiteById(g.id);
        game.recordArrival(g.id, ps.total, route?.elev_gain_m ?? 0, real?.zone ?? null);
        addToast(`${g.name} reached`, 'success');
        const stats = {
          distanceM: Math.round(ps.total),
          elevGainM: Math.round(route?.elev_gain_m ?? 0),
          o2Remaining: oxygenHud?.remainingPct ?? null,
          sitesVisited: game.progress.sitesReached.length + 1,
        };
        if (game.activeMission.id === 'm1_first_light' && g.id === 'western_delta') {
          game.completeMission('m1_first_light');
          hudSound.playMissionComplete();
          setPassedInfo({ missionId: 'm1_first_light', title: 'FIRST LIGHT', ...stats });
          addToast('Mission completed: FIRST LIGHT', 'success');
          awardPatchSunset('m1_first_light');
        } else if (
          game.activeMission.id === 'm2_kodiak' &&
          g.id === 'kodiak' &&
          game.progress.chemistryRead.includes('kodiak')
        ) {
          game.completeMission('m2_kodiak');
          hudSound.playMissionComplete();
          setPassedInfo({ missionId: 'm2_kodiak', title: 'KODIAK', ...stats });
          addToast('Mission completed: KODIAK', 'success');
          awardPatchSunset('m2_kodiak');
        }
      }
    }
    prevArrived.current = arrived;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrived]);

  // Mission failure (or Friendly Rescue in Junior Mode)
  useEffect(() => {
    if (
      belowReserve &&
      isWalking &&
      !breachReported.current &&
      !game.progress.completedMissionIds.includes(game.activeMission.id)
    ) {
      breachReported.current = true;
      setIsWalking(false);
      if (!isJunior) {
        game.failMission(game.activeMission.id, `oxygen dropped below the ${oxygenHud?.reservePct ?? 25}% reserve in the sim`);
      }
      setFailedInfo({
        missionId: game.activeMission.id,
        title: game.activeMission.title,
        reason: `Oxygen fell below the ${oxygenHud?.reservePct ?? 25}% reserve during the walk. The model says the walk back plus reserve no longer fits — try again with a shorter route or a lower slope limit.`,
      });
      addToast(isJunior ? 'Percy drove out to pick you up!' : 'Oxygen Reserve Breached', 'warning');
    }
    if (!belowReserve) breachReported.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [belowReserve, isWalking, isJunior]);

  // M4 Rimwalk
  useEffect(() => {
    if (
      game.activeMission.id === 'm4_rimwalk' &&
      game.progress.chemistryRead.includes('broom_point') &&
      game.progress.routesPlanned > 0 &&
      !game.progress.completedMissionIds.includes('m4_rimwalk')
    ) {
      game.completeMission('m4_rimwalk');
      hudSound.playMissionComplete();
      setPassedInfo({
        missionId: 'm4_rimwalk',
        title: 'RIMWALK',
        distanceM: Math.round(ps.total),
        elevGainM: Math.round(route?.elev_gain_m ?? 0),
        o2Remaining: oxygenHud?.remainingPct ?? null,
        sitesVisited: game.progress.sitesReached.length,
      });
      addToast('Mission completed: RIMWALK', 'success');
      awardPatchSunset('m4_rimwalk');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.progress.chemistryRead, game.progress.routesPlanned, game.activeMission.id]);

  const handleAnalysisComplete = (analysis: { id: string }) => {
    game.recordAnalysis();
    addToast('Sample analysis logged in Research Lab', 'success');
    if (game.activeMission.id === 'm3_biosignature' && !game.progress.completedMissionIds.includes('m3_biosignature')) {
      game.completeMission('m3_biosignature');
      hudSound.playMissionComplete();
      setPassedInfo({
        missionId: 'm3_biosignature',
        title: 'THE POTENTIAL BIOSIGNATURE',
        distanceM: 0,
        elevGainM: 0,
        o2Remaining: oxygenHud?.remainingPct ?? null,
        sitesVisited: game.progress.sitesReached.length,
      });
      addToast('Mission completed: THE POTENTIAL BIOSIGNATURE', 'success');
      awardPatchSunset('m3_biosignature');
    }
    void analysis;
  };

  const handleZapSite = (s: Site) => {
    game.recordChemistryRead(s.id);
    setZapFinding(buildZapFinding(s));
    if (
      game.activeMission.id === 'm2_kodiak' &&
      s.id === 'kodiak' &&
      arrived &&
      !game.progress.completedMissionIds.includes('m2_kodiak')
    ) {
      game.completeMission('m2_kodiak');
      hudSound.playMissionComplete();
      addToast('Kodiak rock zapped — Mission Complete!', 'success');
      awardPatchSunset('m2_kodiak');
    }
  };

  const onDown = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('button') || t.closest('a') || t.closest('input') || t.closest('select')) return;
    setIsDragging(true);
    drag.current = { x: e.clientX, y: e.clientY, pan: panOffset, pitch: pitchOffset };
  };

  const onMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset(Math.max(-50, Math.min(50, drag.current.pan + (e.clientX - drag.current.x) * 0.12)));
    setPitchOffset(Math.max(-16, Math.min(16, drag.current.pitch - (e.clientY - drag.current.y) * 0.1)));
  };

  const setTarget = (obj: { id: string }) => {
    setSelectedObjectId(obj.id);
    mission.setGoalId(obj.id);
    if (here) mission.setStart({ lat: here.lat, lon: here.lon });
    void mission.plan({ goalId: obj.id, start: here ? { lat: here.lat, lon: here.lon } : undefined });
    setActiveMode('NAVIGATION');
    hudSound.playTargetLock();
    addToast(`Target locked: ${obj.id}`, 'info');
  };

  const coords = here
    ? {
        lat: fmtLat(here.lat),
        lng: fmtLon(here.lon),
        elevation: Number.isFinite(here.elev) ? `${Math.round(here.elev)} m` : '—',
      }
    : { lat: '—', lng: '—', elevation: '—' };
  const nextWp = navRoute.waypoints[navRoute.currentStepIndex];

  // Real evidenced hazard or steep terrain callout strictly from route planner/data (never fabricated)
  const nearHazardObj = objects
    .filter((o) => o.category === 'HAZARD' && o.distanceMeters <= 450)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];
  const slopeWarnObj = activeRoute ? slopeAhead(activeRoute, ps, walked, 120) : null;
  const steepHazardNote =
    slopeWarnObj && slopeWarnObj.slope > (options?.caution_slope_deg ?? 12)
      ? `${slopeWarnObj.slope.toFixed(1)}° in ${Math.round(slopeWarnObj.atM)} m`
      : nearHazardObj
      ? `${Math.round(nearHazardObj.distanceMeters)} m away`
      : null;

  // Sec 8(c): Friendly recovery screen if backend/meta fails to load — never white-screen
  if (!meta && mission.loadError) {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#080304] text-white p-6 font-mono">
        <div className="max-w-lg w-full rounded-2xl border border-[#E5484D]/55 bg-[#120607]/95 p-6 space-y-4 shadow-[0_0_50px_rgba(255,59,48,0.28)]">
          <div className="flex items-center gap-3 text-[#FF3B30]">
            <TriangleAlert className="w-7 h-7 shrink-0" />
            <h2 className="text-lg font-black uppercase tracking-wider text-white">
              Can&apos;t reach the Mars server
            </h2>
          </div>
          <p className="text-xs text-white/75 break-all">
            URL tried: <span className="text-[#ff8a8e]">{getApiDisplayBase()}/api/regions/{regionId}</span>
            <br />
            Error: {mission.loadError}
          </p>
          <ul className="text-xs text-white/75 space-y-1.5 list-disc pl-5">
            <li>Is the backend running? (<code>uvicorn app.main:app --host 0.0.0.0 --port 8000</code>)</li>
            <li>If opened over Wi-Fi/LAN, is the backend bound to <code>0.0.0.0</code> and built with the latest frontend?</li>
            <li>Did Windows Defender Firewall allow Python &amp; Node on your Private network?</li>
          </ul>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#E5484D] hover:bg-[#FF3B30] text-white text-xs font-bold tracking-wider transition"
            >
              <RotateCcw className="w-4 h-4" />
              Retry Connection
            </button>
            {onQuit && (
              <button
                type="button"
                onClick={onQuit}
                className="px-5 py-2.5 rounded-full border border-white/20 bg-white/5 hover:bg-white/15 text-xs font-bold text-white transition"
              >
                Back to Title
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id="mars-eva-hud-container"
      className="relative w-screen h-screen overflow-hidden bg-black select-none cursor-grab active:cursor-grabbing font-sans"
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
    >
      {/* 3D Surface: First-Person Helmet EVA View showing measured CTX DEM terrain, Science Pod, grounded crew & horizon */}
      <ErrorBoundary label="3D Mars Surface">
        <Mars3dSurface
          isWalking={isWalking}
          walkDistance={walked}
          stepPhase={stepPhase}
          pitchOffset={pitchOffset}
          panOffset={panOffset}
          headingDeg={heading}
          visorTint={visorTint}
          viewMode="eva"
          timeOfSol="noon"
          showTopoGrid={false}
          isTourPlaying={false}
          dustDevilsActive
          onAltitudeChange={() => {}}
          zoomLevel={1}
          inPond={inPond}
          demGrid={demGrid}
          playerLat={here?.lat ?? null}
          playerLon={here?.lon ?? null}
          paused={
            activeMode !== 'NAVIGATION' ||
            isPaused ||
            podOpen ||
            pondOpen ||
            labOpen ||
            backpackOpen ||
            detectiveOpen ||
            photoOpen
          }
        />
      </ErrorBoundary>

      {/* Dust storm gentle atmospheric haze overlay (transparent center!) */}
      {dustStormActive && activeMode === 'NAVIGATION' && (
        <div
          className="absolute inset-0 z-[15] pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(217,119,6,0.06) 40%, rgba(146,64,14,0.34) 100%)',
          }}
        />
      )}

      {/* Honesty label for 3D visualization (Always kept visible) */}
      <div className="absolute top-4 left-6 z-20 font-mono text-[10px] text-white/75 tracking-wider bg-black/70 px-2.5 py-1 rounded border border-[#E5484D]/35 backdrop-blur-xs pointer-events-none">
        3D view — visualisation
      </div>

      {activeRoute && activeMode === 'NAVIGATION' && (
        <ArGroundPath
          route={navRoute}
          speedMs={speed}
          distanceRemaining={distanceRemaining}
          panOffset={panOffset}
          pitchOffset={pitchOffset}
          isWalking={isWalking}
          walkDistance={walked}
          steepHazardNote={steepHazardNote}
        />
      )}
      <ArDetectionOverlay
        objects={objects}
        headingDeg={heading}
        pitchDeg={pitchOffset}
        selectedObjectId={selectedObjectId}
        goalId={goal?.id}
        onSelectObject={(o) => setSelectedObjectId(o.id)}
        onSetNavigationTarget={setTarget}
        onOpenInformation={(o) => {
          setSelectedObjectId(o.id);
          setIsInformationOpen(true);
        }}
      />

      {/* Top Center Compass Tape + Real EVA Timer & Goal Pill */}
      <div className="absolute top-0 inset-x-0 z-30 pointer-events-none">
        <CompassTape
          headingDeg={heading}
          targetBearingDeg={nextWp?.bearing ?? heading}
          destinationName={navRoute.destinationName}
          coordinates={coords}
          elapsedMin={elapsedMin}
        />
      </div>

      {activeMode === 'NAVIGATION' && (
        <div className="absolute top-[102px] left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-none">
          <div className="px-4 py-1.5 rounded-full border border-[#E5484D]/65 bg-black/80 backdrop-blur-md text-xs font-mono text-white tracking-wider shadow-[0_0_20px_rgba(255,59,48,0.28)]">
            {isJunior && juniorLegRoute ? (
              <>
                Next: <b className="text-white font-bold">first stop</b> —{' '}
                <span className="text-[#FF3B30] font-bold">{Math.round(distanceRemaining)} m</span>
              </>
            ) : (
              <>
                Next: reach <b className="text-white font-bold">{goal?.name ?? 'Kodiak'}</b> —{' '}
                <span className="text-[#FF3B30] font-bold">{Math.round(distanceRemaining).toLocaleString()} m</span>
              </>
            )}
          </div>
          {isJunior && juniorLegRoute && route && (
            <div className="mt-1 px-2.5 py-0.5 rounded-full bg-black/75 text-[10px] font-mono text-white/70">
              {goal?.name ?? 'Kodiak'} is {Math.round(route.distance_m ?? 0).toLocaleString()} m away
            </div>
          )}
        </div>
      )}

      {/* TurnByTurnBanner on Level 2+ so Level 1 strictly obeys <= 3 panels */}
      {activeRoute && activeMode === 'NAVIGATION' && hudLevel >= 2 && (
        <TurnByTurnBanner
          route={navRoute}
          distanceRemaining={distanceRemaining}
          speedMs={speed}
          onOpenMap={() => setActiveMode('MAP')}
          objectiveLabel={`${game.activeMission.num} — ${game.activeMission.title}: ${game.activeMission.objectives[0]}`}
          pointOfNoReturnM={pnrDistanceM}
        />
      )}

      {/* Low-oxygen drama below 30% */}
      {isLowO2Drama && activeMode === 'NAVIGATION' && !isJunior && (
        <>
          <div
            className="absolute inset-0 z-[35] pointer-events-none"
            style={{
              boxShadow: 'inset 0 0 130px 45px rgba(220,38,38,0.6)',
              animation: 'lowO2Pulse 1.2s ease-in-out infinite',
            }}
            aria-hidden="true"
          />
          <div className="absolute top-32 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-xl bg-red-950/90 border border-red-500/80 text-xs font-mono font-bold text-red-200 tracking-wider animate-pulse shadow-[0_0_25px_rgba(239,68,68,0.5)]">
            Air is low — head back or reach the next stop
          </div>
        </>
      )}

      <HudWarnings alerts={alerts} />

      {hudLevel >= 2 && (
        <EnvironmentTelemetryHud
          elevationM={here && Number.isFinite(here.elev) ? here.elev : null}
          slopeDeg={here && Number.isFinite(here.slope) ? here.slope : null}
          cautionSlope={options?.caution_slope_deg ?? 12}
          maxSlope={options?.max_slope_deg ?? 20}
          distanceRemaining={distanceRemaining}
          etaMin={etaMin}
          elapsedMin={elapsedMin}
          oxygen={oxygenHud}
          detail={hudLevel === 3}
        />
      )}

      {/* Top-Right Pod Door & Air Pill (kept clear of the ROUTE visor arc) */}
      <div className="absolute top-20 right-8 z-30 flex flex-col items-end gap-2">
        {hudLevel === 1 && oxygenHud && (
          <div className="px-3 py-1 rounded-full bg-black/75 border border-[#E5484D]/45 text-[11px] font-mono pointer-events-none">
            Air left:{' '}
            <span className={oxygenHud.remainingPct < 30 ? 'text-[#FF3B30] font-bold' : 'text-white font-bold'}>
              {Math.round(oxygenHud.remainingPct)}%
            </span>{' '}
            · {Math.round(distanceRemaining)} m
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            hudSound.playClick();
            if (nearPod) {
              setPodOpen(true);
            } else {
              mission.setGoalId('octavia_butler_landing');
              if (here) mission.setStart({ lat: here.lat, lon: here.lon });
              void mission.plan({ goalId: 'octavia_butler_landing', start: here ? { lat: here.lat, lon: here.lon } : undefined });
              addToast('Routing back to Science Pod at Landing Site', 'info');
            }
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#E5484D]/75 bg-[#E5484D]/25 hover:bg-[#FF3B30]/40 text-white font-mono text-[11px] font-bold tracking-wider shadow-[0_0_16px_rgba(255,59,48,0.28)] transition active:scale-95 pointer-events-auto"
        >
          <Home className="w-3.5 h-3.5 text-[#ff8a8e]" />
          <span>{nearPod ? 'Science Pod (E)' : 'Go to Pod'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            hudSound.playClick();
            if (inPond) {
              setPondOpen(true);
            } else {
              mission.setGoalId(RESEARCH_POND.anchorSiteId);
              if (here) mission.setStart({ lat: here.lat, lon: here.lon });
              void mission.plan({ goalId: RESEARCH_POND.anchorSiteId, start: here ? { lat: here.lat, lon: here.lon } : undefined });
              addToast('Routing to Research Pond (dry lakebed at Delta Front)', 'info');
            }
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#E5484D]/65 bg-[#190709]/85 hover:bg-[#E5484D]/35 text-white font-mono text-[11px] font-bold tracking-wider transition active:scale-95 pointer-events-auto"
        >
          <Pickaxe className="w-3.5 h-3.5 text-[#ff8a8e]" />
          <span>{inPond ? 'Research Pond (Collect)' : 'Go to Pond'}</span>
        </button>
      </div>

      {/* Live Entry / Exit Zone Banner in 3D Helmet View (§11) */}
      {(inPond || pondBanner === 'left') && activeMode === 'NAVIGATION' && (
        <div
          role="status"
          className="absolute top-36 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-1.5 rounded-full border border-[#FF3B30]/75 bg-[#190709]/92 backdrop-blur-md text-xs font-mono pointer-events-auto shadow-[0_0_20px_rgba(255,59,48,0.25)]"
        >
          <span className="font-bold text-white">
            {inPond ? 'You are in the Research Pond' : 'You left the Research Pond'}
          </span>
          {inPond && (
            <button
              type="button"
              onClick={() => setPondOpen(true)}
              className="px-2.5 py-0.5 rounded-full bg-[#E5484D] hover:bg-[#FF3B30] text-white text-[11px] font-bold"
            >
              Collect Spots
            </button>
          )}
        </div>
      )}

      {/* Junior Quick Action Buttons — placed left-of-gauge so the right ROUTE arc stays completely readable */}
      {isJunior && activeMode === 'NAVIGATION' && (
        <div className="absolute top-44 right-6 sm:right-48 z-30 flex flex-col gap-2 pointer-events-auto">
          {goal && (
            <button
              onClick={() => {
                hudSound.playLaserZap();
                handleZapSite(goal);
              }}
              className="flex items-center gap-2 min-h-[42px] px-3.5 py-1.5 rounded-2xl border-2 border-emerald-400/70 bg-emerald-950/85 hover:bg-emerald-900 text-emerald-100 font-bold text-xs shadow-lg transition active:scale-95"
            >
              <Zap className="w-4 h-4 text-emerald-300" />
              Zap {goal.name}
            </button>
          )}
          <button
            onClick={() => setBackpackOpen(true)}
            className="flex items-center gap-2 min-h-[42px] px-3.5 py-1.5 rounded-2xl border-2 border-amber-400/70 bg-amber-950/85 hover:bg-amber-900 text-amber-100 font-bold text-xs shadow-lg transition active:scale-95"
          >
            <Backpack className="w-4 h-4 text-amber-300" />
            Backpack ({game.progress.inventory.length})
          </button>
          <button
            onClick={() => setDetectiveOpen(true)}
            className="flex items-center gap-2 min-h-[42px] px-3.5 py-1.5 rounded-2xl border-2 border-violet-400/70 bg-violet-950/85 hover:bg-violet-900 text-violet-100 font-bold text-xs shadow-lg transition active:scale-95"
          >
            <Search className="w-4 h-4 text-violet-300" />
            Detective Case
          </button>
          <button
            onClick={() => setPhotoOpen(true)}
            className="flex items-center gap-2 min-h-[42px] px-3.5 py-1.5 rounded-2xl border-2 border-blue-400/70 bg-blue-950/85 hover:bg-blue-900 text-blue-100 font-bold text-xs shadow-lg transition active:scale-95"
          >
            <Camera className="w-4 h-4 text-blue-300" />
            Photo
          </button>
          {activeRoute && walked < ps.total - 1 && (
            <button
              onClick={handleSkipWalk}
              className="flex items-center gap-2 min-h-[42px] px-3.5 py-1.5 rounded-2xl border-2 border-[#E5484D]/80 bg-[#E5484D]/85 hover:bg-[#FF3B30] text-white font-bold text-xs shadow-lg transition active:scale-95"
            >
              <FastForward className="w-4 h-4 text-white" />
              Skip walk
            </button>
          )}
        </div>
      )}

      {/* Panel 2 (Bottom-Left): Objective Tracker + Percy in Junior Mode */}
      <div className="absolute bottom-24 left-8 z-30 flex flex-col gap-2 pointer-events-auto">
        {isJunior && dustStormActive && (
          <div className="rounded-2xl border-2 border-amber-400 bg-amber-950/90 px-3.5 py-2 text-xs font-bold text-amber-100 flex items-center gap-2 shadow-lg animate-pulse max-w-xs">
            <Wind className="w-4 h-4 text-amber-300 shrink-0" />
            <span>Storm coming — head home!</span>
          </div>
        )}
        {isJunior ? (
          <PercyCompanion
            message={percyJobForMission(game.activeMission.id, goal?.name)}
            tips={[
              'Press Spacebar to start walking with me!',
              'Press M anytime to open the satellite photo map.',
              'Tap Zap to scan rocks for water minerals!',
            ]}
          />
        ) : (
          <ObjectiveTracker
            game={game}
            destinationName={goal?.name}
            distanceRemainingM={distanceRemaining}
          />
        )}
      </div>

      {/* Collect sample button on arrival (Grown-up view) */}
      {arrived &&
        !isJunior &&
        goal &&
        realSiteById(goal.id)?.chemistry &&
        !game.progress.inventory.some((i) => i.siteId === goal.id) && (
          <div className="absolute top-44 right-8 z-30 pointer-events-auto">
            <button
              onClick={() => {
                game.collectSample(goal.id, goal.name, realSiteById(goal.id)?.plain ?? '');
                addToast(`Sample collected at ${goal.name}`, 'success');
              }}
              className="px-3.5 py-2 rounded-full bg-emerald-600/85 hover:bg-emerald-500 border border-emerald-300/60 text-white text-xs font-mono font-bold shadow-lg transition"
            >
              Collect sample at {goal.name}
            </button>
          </div>
        )}

      {/* Panel 3 (Bottom-Right): MiniMapRadar ALWAYS visible on Level 1! */}
      <MiniMapRadar
        headingDeg={heading}
        route={navRoute}
        objects={objects}
        distanceRemaining={distanceRemaining}
        walkDistance={walked}
        isWalking={isWalking}
        onExpandMap={() => setActiveMode('MAP')}
        onSelectObject={(o) => setSelectedObjectId(o.id)}
      />

      {/* HUD Level Switcher & Sound */}
      <div
        className="absolute bottom-5 right-8 z-40 hidden md:flex items-center gap-1 rounded-full bg-slate-950/75 backdrop-blur-md border border-white/15 p-1 pointer-events-auto"
        role="group"
        aria-label="HUD information level"
      >
        <span className="pl-2 pr-1 text-[9px] font-mono tracking-widest text-white/45">HUD</span>
        {([1, 2, 3] as HudLevel[]).map((l) => (
          <button
            key={l}
            onClick={() => {
              hudSound.playClick();
              setHudLevel(l);
            }}
            aria-pressed={hudLevel === l}
            title={`Key ${l}`}
            className={`px-2 py-1 rounded-full text-[10px] font-mono tracking-wider ${
              hudLevel === l
                ? 'bg-[#FF3B30]/30 text-white border border-[#E5484D]/75'
                : 'text-white/55 hover:text-white'
            }`}
          >
            {l} {LEVEL_LABEL[l]}
          </button>
        ))}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          aria-pressed={soundEnabled}
          className={`px-2 py-1 rounded-full text-[10px] font-mono tracking-wider border ${
            soundEnabled
              ? 'bg-[#FF3B30]/30 text-white border-[#E5484D]/75'
              : 'text-white/55 border-white/15 hover:text-white'
          }`}
        >
          {soundEnabled ? 'SOUND ON' : 'SOUND OFF'}
        </button>
      </div>

      <HelmetVisorOverlay
        tint={visorTint}
        panOffset={panOffset}
        pitchOffset={pitchOffset}
        isWalking={isWalking}
        viewMode="eva"
        oxygenPct={oxygenHud?.remainingPct ?? null}
        reservePct={oxygenHud?.reservePct ?? 25}
        walkedM={walked}
        totalM={ps.total}
        distanceRemainingM={distanceRemaining}
        elapsedMin={elapsedMin}
      />

      <BottomNavControls
        activeMode={activeMode}
        onModeChange={setActiveMode}
        isWalking={isWalking}
        onToggleWalking={() => activeRoute && setIsWalking(!isWalking)}
        onResetView={() => {
          setPanOffset(0);
          setPitchOffset(0);
        }}
        isInformationOpen={isInformationOpen}
        onToggleInformation={() => setIsInformationOpen(!isInformationOpen)}
        informationCount={sites.length}
      />

      {hudLevel >= 2 && !isInformationOpen && (
        <div className="absolute left-5 top-32 z-30 pointer-events-auto flex flex-col gap-2">
          <button
            onClick={() => {
              hudSound.playClick();
              setIsInformationOpen(true);
            }}
            className="flex items-center space-x-2 px-3 py-2 rounded-full bg-black/75 hover:bg-black backdrop-blur-xl border border-[#E5484D]/45 hover:border-[#FF3B30] text-white transition-all active:scale-95"
          >
            <Info className="w-3.5 h-3.5 text-[#E5484D]" />
            <span className="font-mono text-[11px] font-bold text-white tracking-wider">
              SITES &amp; HAZARDS
            </span>
            <span className="px-1.5 rounded-full text-[9px] font-mono font-bold bg-[#FF3B30]/25 text-[#ff8a8e] border border-[#E5484D]/45">
              {sites.length}
            </span>
          </button>
          <button
            onClick={() => {
              hudSound.playClick();
              setLabOpen(true);
            }}
            className="flex items-center space-x-2 px-3 py-2 rounded-full bg-black/75 hover:bg-black backdrop-blur-xl border border-[#E5484D]/55 hover:border-[#FF3B30] text-white transition-all active:scale-95"
          >
            <span className="font-mono text-[11px] font-bold text-[#ff8a8e] tracking-wider">
              RESEARCH LAB
            </span>
          </button>
          <button
            onClick={() => {
              hudSound.playClick();
              setMissionsOpen(true);
            }}
            className="flex items-center space-x-2 px-3 py-2 rounded-full bg-black/75 hover:bg-black backdrop-blur-xl border border-amber-400/40 hover:border-amber-300/70 text-white transition-all active:scale-95"
          >
            <span className="font-mono text-[11px] font-bold text-amber-200 tracking-wider">
              MISSIONS · {game.progress.xp} XP
            </span>
          </button>
        </div>
      )}

      <InformationSidePanel
        isOpen={isInformationOpen}
        onClose={() => setIsInformationOpen(false)}
        objects={objects}
        sites={sites}
        selectedObjectId={selectedObjectId}
        onSelectObject={(o) => setSelectedObjectId(o.id)}
        onSetNavigationTarget={(o) => {
          setTarget(o);
          setIsInformationOpen(false);
        }}
      />

      {/* Layered Map View wrapped in ErrorBoundary */}
      <ErrorBoundary label="Crater Map" onReset={() => setActiveMode('NAVIGATION')}>
        <LayeredMapModal
          isOpen={activeMode === 'MAP'}
          onClose={() => setActiveMode('NAVIGATION')}
          mission={mission}
          astronaut={here ? { lat: here.lat, lon: here.lon } : null}
          onStartEva={() => setActiveMode('NAVIGATION')}
          game={game}
          onOpenLab={() => setLabOpen(true)}
          onOpenPod={() => setPodOpen(true)}
          onOpenPond={() => setPondOpen(true)}
          inPond={inPond}
          onArriveAtGoal={handleSkipWalk}
          nearPod={nearPod}
          isWalking={isWalking}
          walkDistance={walked}
          onToggleWalking={() => activeRoute && setIsWalking(!isWalking)}
          speed={speed}
          oxygenHud={oxygenHud}
          distanceRemaining={distanceRemaining}
          onOpenPauseMenu={() => setIsPaused(true)}
          onOpenMissions={() => setMissionsOpen(true)}
          uiMode={uiMode}
          onToggleUiMode={toggleUiMode}
          onZapSite={handleZapSite}
          onOpenBackpack={() => setBackpackOpen(true)}
          onOpenDetectiveCase={() => setDetectiveOpen(true)}
          onOpenPhotoMode={() => setPhotoOpen(true)}
          dustStormActive={dustStormActive}
          onToggleDustStorm={() => setDustStormActive((d) => !d)}
          routeOverride={juniorLegRoute}
          fullGoalDistanceM={juniorLegRoute && route ? route.distance_m : null}
          onSkipWalk={handleSkipWalk}
        />
      </ErrorBoundary>

      <ErrorBoundary label="Science Pod">
        <SciencePodModal
          isOpen={podOpen}
          onClose={() => setPodOpen(false)}
          game={game}
          uiMode={uiMode}
          liveCrew={liveCrew}
          goalName={goal?.name}
          onOpenLab={() => setLabOpen(true)}
          onOpenDetectiveCase={() => setDetectiveOpen(true)}
          onOpenMapTable={() => setActiveMode('MAP')}
          onOpenPhotoMode={() => setPhotoOpen(true)}
        />
      </ErrorBoundary>

      <ErrorBoundary label="Research Pond">
        <ResearchPondModal
          isOpen={pondOpen}
          onClose={() => setPondOpen(false)}
          inPond={inPond}
          game={game}
          uiMode={uiMode}
          liveCrew={liveCrew}
          onRouteToPond={() => {
            mission.setGoalId(RESEARCH_POND.anchorSiteId);
            if (here) mission.setStart({ lat: here.lat, lon: here.lon });
            void mission.plan({
              goalId: RESEARCH_POND.anchorSiteId,
              start: here ? { lat: here.lat, lon: here.lon } : undefined,
            });
            setActiveMode('MAP');
            addToast('Plotted route to Research Pond (Delta Front)', 'info');
          }}
          onOpenPod={() => setPodOpen(true)}
          onOpenPhotoMode={() => setPhotoOpen(true)}
          onToast={(txt, t) => addToast(txt, t === 'critical' ? 'warning' : t)}
        />
      </ErrorBoundary>

      {!introDone && <AstronautIntro onDone={() => setIntroDone(true)} regionName={meta?.name} />}

      <ToolsModal
        isOpen={activeMode === 'TOOLS'}
        onClose={() => setActiveMode('NAVIGATION')}
        visorTint={visorTint}
        onChangeVisorTint={setVisorTint}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
      />

      {labOpen && <ResearchLab onClose={() => setLabOpen(false)} onAnalysisComplete={handleAnalysisComplete} />}

      {missionsOpen && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-label="Missions">
          <div className="w-full max-w-lg max-h-full overflow-y-auto rounded border border-amber-400/40 bg-[#0a0610] p-4">
            <MissionPanel
              game={game}
              onClose={() => setMissionsOpen(false)}
              atBase={here ? Math.abs(here.lat - 18.4446) < 0.02 && Math.abs(here.lon - 77.4509) < 0.02 : false}
            />
          </div>
        </div>
      )}

      {/* Mission Cinematics — compact top/bottom bar in 3D view only (never covers 2D map) */}
      {introDone && showCinematic && activeMode === 'NAVIGATION' && (
        <MissionCinematic
          missionId={game.activeMission.id}
          num={game.activeMission.num}
          title={game.activeMission.title}
          objective={game.activeMission.briefingPlain}
          onFinished={() => setShowCinematic(false)}
        />
      )}

      {/* Pause Menu on Esc */}
      <PauseMenu
        isOpen={isPaused}
        onResume={() => setIsPaused(false)}
        onRestart={() => {
          setWalked(0);
          setIsWalking(false);
          setIsPaused(false);
          addToast('Traverse restarted', 'info');
        }}
        onDetails={() => {
          setIsPaused(false);
          setActiveMode('MAP');
        }}
        onQuit={() => {
          setIsPaused(false);
          onQuit?.();
        }}
        activeMissionTitle={`${game.activeMission.num} · ${game.activeMission.title}`}
        goalName={goal?.name}
        distanceRemainingM={distanceRemaining}
        oxygenPct={oxygenHud?.remainingPct}
        uiMode={uiMode}
        onToggleUiMode={toggleUiMode}
        completedMissionIds={game.progress.completedMissionIds}
      />

      {/* Junior Astronaut Modals */}
      <ZapCardModal
        finding={zapFinding}
        alreadyInBackpack={
          zapFinding ? game.progress.inventory.some((i) => i.siteId === zapFinding.siteId) : false
        }
        onCollect={() => {
          if (!zapFinding) return;
          const r = realSiteById(zapFinding.siteId);
          game.collectSample(zapFinding.siteId, zapFinding.siteName, r?.plain ?? zapFinding.plainChemistry);
          addToast(`Put ${zapFinding.siteName} rock in backpack!`, 'success');
        }}
        onClose={() => setZapFinding(null)}
      />

      <BackpackModal isOpen={backpackOpen} onClose={() => setBackpackOpen(false)} game={game} />

      <DetectiveCaseModal
        isOpen={detectiveOpen}
        onClose={() => setDetectiveOpen(false)}
        alreadySolved={game.progress.completedMissionIds.includes('m3_biosignature')}
        onSolve={() => {
          if (!game.progress.completedMissionIds.includes('m3_biosignature')) {
            game.completeMission('m3_biosignature');
            addToast('Patch earned: Spot Detective!', 'success');
            awardPatchSunset('m3_biosignature');
          }
        }}
      />

      <PhotoModeModal
        isOpen={photoOpen}
        onClose={() => setPhotoOpen(false)}
        coords={`${coords.lat} ${coords.lng}`}
        elevation={coords.elevation}
        onSaved={() => addToast('Photo saved to your wall!', 'success')}
      />

      <BlueSunsetModal
        isOpen={Boolean(blueSunsetPatch)}
        onClose={() => setBlueSunsetPatch(null)}
        patchName={blueSunsetPatch ?? 'Mars Explorer'}
      />

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />

      {/* Mission Passed Modal (Grown-up mode; Junior mode shows Blue Sunset reward!) */}
      {passedInfo && !isJunior && (
        <div className="absolute inset-0 z-[85] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-label="Mission passed">
          <div className="w-full max-w-md rounded-2xl border border-emerald-400/60 bg-[#06100a] p-6 text-center space-y-4 shadow-[0_0_50px_rgba(16,185,129,0.3)]">
            <div className="font-mono text-[10px] tracking-widest text-emerald-300 uppercase">MISSION PASSED</div>
            <div className="text-2xl font-black tracking-wider text-white" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              {passedInfo.title}
            </div>
            <dl className="grid grid-cols-2 gap-2 text-[11px] font-mono text-left">
              <div className="rounded-xl border border-white/10 bg-slate-900/50 p-2.5">
                <dt className="text-white/40">DISTANCE WALKED</dt>
                <dd className="text-sm font-bold text-white">{passedInfo.distanceM} m</dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/50 p-2.5">
                <dt className="text-white/40">CLIMB</dt>
                <dd className="text-sm font-bold text-white">{passedInfo.elevGainM} m</dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/50 p-2.5">
                <dt className="text-white/40">OXYGEN LEFT</dt>
                <dd className="text-sm font-bold text-white">
                  {passedInfo.o2Remaining == null ? '—' : `${Math.round(passedInfo.o2Remaining)}%`}
                </dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/50 p-2.5">
                <dt className="text-white/40">SITES VISITED</dt>
                <dd className="text-sm font-bold text-white">{passedInfo.sitesVisited}</dd>
              </div>
            </dl>
            <p className="text-[11px] text-white/60 leading-snug">
              Real telemetry from your walk across Jezero Crater — calculated directly from CTX topography.
            </p>
            <button
              onClick={() => setPassedInfo(null)}
              className="px-6 py-2.5 rounded-xl bg-emerald-500/25 border border-emerald-400/60 text-xs font-mono font-bold hover:bg-emerald-500/40 transition active:scale-95"
            >
              CONTINUE
            </button>
          </div>
        </div>
      )}

      {/* Friendly Rescue in Junior Mode OR Mission Failed in Grown-up Mode */}
      {failedInfo &&
        (isJunior ? (
          <FriendlyRescueModal
            isOpen
            onRetry={() => {
              setWalked(0);
              setIsWalking(false);
              setFailedInfo(null);
            }}
          />
        ) : (
          <div className="absolute inset-0 z-[85] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-label="Mission failed">
            <div className="w-full max-w-md rounded-2xl border border-red-400/60 bg-[#100606] p-6 text-center space-y-4 shadow-[0_0_50px_rgba(239,68,68,0.3)]">
              <div className="font-mono text-[10px] tracking-widest text-red-300 uppercase">MISSION FAILED</div>
              <div className="text-2xl font-black tracking-wider text-white" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                {failedInfo.title}
              </div>
              <p className="text-[12px] text-white/75 leading-snug">{failedInfo.reason}</p>
              <button
                onClick={() => {
                  setWalked(0);
                  setIsWalking(false);
                  setFailedInfo(null);
                }}
                className="px-6 py-2.5 rounded-xl bg-red-500/25 border border-red-400/60 text-xs font-mono font-bold hover:bg-red-500/40 transition active:scale-95"
              >
                TRY AGAIN
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}
