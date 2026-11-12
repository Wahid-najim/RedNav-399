'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Layers,
  Route as RouteIcon,
  MapPin,
  TriangleAlert,
  Crosshair,
  Ban,
  Play,
  Pause,
  Database,
  Trash2,
  ShieldAlert,
  ClipboardList,
  Trophy,
  Compass,
  Sliders,
  Eye,
  Camera,
  Zap,
  Backpack,
  Search,
  Wind,
  Plus,
  Minus,
  LocateFixed,
  ChevronLeft,
  ChevronRight,
  FastForward,
  Navigation,
  Users,
  Home,
  Pickaxe,
} from 'lucide-react';
import type { Mission } from '../lib/useMission';
import type { LayerName, Nature, RouteResult, Site } from '../lib/missionTypes';
import { api } from '../lib/api';
import { fmtLat, fmtLon, fracToLatLon, latLonToFrac, offsetM } from '../lib/geo';
import { hudSound } from '../utils/soundEffects';
import { RouteAnalysisWindow } from './RouteAnalysisWindow';
import { SafetyContextPanel } from './SafetyContextPanel';
import { MissionPanel } from './MissionPanel';
import { ExplainButton } from './ExplainButton';
import { CHEYAVA, realSiteById } from '../lib/jezeroReal';
import { hazardLevel } from '../lib/missions';
import type { GameProgress } from '../lib/progress';
import {
  catmullRomPath,
  buildSlopeSegments,
  calculateDistanceFlags,
  type Point2D,
} from '../lib/spline';
import { pathState, positionAt } from '../lib/sim';
import type { OxygenHud } from './EnvironmentTelemetryHud';
import { percyJobForMission, type UiMode } from '../lib/juniorMode';
import { PercyCompanion } from './JuniorComponents';
import { computeCrewStates, type LiveCrewMember } from '../lib/crew';
import {
  CURRENT_SIM_SOL,
  POND_SPOTS,
  RESEARCH_POND,
  isInResearchPond,
  pondPerimeterVertices,
  pondSpotCoords,
} from '../lib/researchPond';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mission: Mission;
  astronaut: { lat: number; lon: number } | null;
  onStartEva: () => void;
  game?: GameProgress;
  onOpenLab?: () => void;
  onOpenPod?: () => void;
  onOpenPond?: () => void;
  inPond?: boolean;
  onArriveAtGoal?: () => void;
  nearPod?: boolean;
  isWalking?: boolean;
  walkDistance?: number;
  onToggleWalking?: () => void;
  speed?: number;
  oxygenHud?: OxygenHud | null;
  distanceRemaining?: number;
  onOpenPauseMenu?: () => void;
  onOpenMissions?: () => void;
  uiMode?: UiMode;
  onToggleUiMode?: () => void;
  onZapSite?: (site: Site) => void;
  onOpenBackpack?: () => void;
  onOpenDetectiveCase?: () => void;
  onOpenPhotoMode?: () => void;
  dustStormActive?: boolean;
  onToggleDustStorm?: () => void;
  /** Optional shortened leg route used in Junior Astronaut mode (~300 m per step). */
  routeOverride?: RouteResult | null;
  /** Full goal distance shown quietly alongside Junior 300 m first-stop label. */
  fullGoalDistanceM?: number | null;
  onSkipWalk?: () => void;
}

type LayerPreset = 'imagery' | 'terrain' | 'hazards';

const LAYER_PRESETS: { id: LayerPreset; label: string }[] = [
  { id: 'imagery', label: 'Imagery' },
  { id: 'terrain', label: 'Terrain' },
  { id: 'hazards', label: 'Hazards' },
];

const NATURE: Record<Nature, { label: string; cls: string }> = {
  static: { label: 'STATIC', cls: 'bg-slate-500/20 text-slate-200 border-slate-400/30' },
  historical: { label: 'HISTORICAL', cls: 'bg-amber-500/20 text-amber-200 border-amber-400/30' },
  current: { label: 'CURRENT', cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30' },
  predicted: { label: 'PREDICTED', cls: 'bg-violet-500/20 text-violet-200 border-violet-400/30' },
};

const STRATEGY: Record<string, { label: string; juniorLabel: string; color: string }> = {
  balanced: { label: 'Balanced', juniorLabel: 'Best mix', color: '#E5484D' },
  safest: { label: 'Gentlest slopes', juniorLabel: 'Easiest ground', color: '#fb923c' },
  shortest_feasible: { label: 'Shortest feasible', juniorLabel: 'Quickest path', color: '#fbbf24' },
};

const LAYER_ROWS: { key: LayerName; label: string; juniorLabel: string; kind: string }[] = [
  { key: 'imagery', label: 'Surface imagery', juniorLabel: 'Mars satellite photo', kind: 'optical' },
  { key: 'hillshade', label: 'Terrain shading', juniorLabel: '3D-style shadows', kind: 'topographic' },
  { key: 'slope', label: 'Slope classes', juniorLabel: 'Steepness colors', kind: 'topographic' },
  { key: 'hazard', label: 'Too steep to walk', juniorLabel: 'Too steep', kind: 'topographic' },
  { key: 'chemical', label: 'Chemical index', juniorLabel: 'Water minerals', kind: 'chemical' },
];

const GEO_COLOR: Record<string, string> = {
  delta: '#E5484D',
  crater_rim: '#f472b6',
  lakebed: '#a78bfa',
  boxwork: '#facc15',
  ejecta: '#fb923c',
};

type ClickMode = 'inspect' | 'start' | 'obstacle';
type Tab = 'route' | 'site' | 'safety' | 'data' | 'missions';

const MIN_ZOOM = 0.55;
const MAX_ZOOM = 3.0;

const Badge = ({ n }: { n: Nature }) => (
  <span className={`px-1.5 py-0.5 rounded border text-[9px] font-mono tracking-wider ${NATURE[n].cls}`}>
    {NATURE[n].label}
  </span>
);

export const LayeredMapModal: React.FC<Props> = ({
  isOpen,
  onClose,
  mission: m,
  astronaut,
  onStartEva,
  game,
  onOpenLab,
  onOpenPod,
  onOpenPond,
  inPond,
  onArriveAtGoal,
  nearPod = true,
  isWalking = false,
  walkDistance = 0,
  onToggleWalking,
  oxygenHud,
  distanceRemaining,
  onOpenPauseMenu,
  uiMode = 'grownup',
  onToggleUiMode,
  onZapSite,
  onOpenBackpack,
  onOpenDetectiveCase,
  onOpenPhotoMode,
  dustStormActive = false,
  onToggleDustStorm,
  routeOverride = null,
  fullGoalDistanceM = null,
  onSkipWalk,
}) => {
  const isJunior = uiMode === 'junior';
  const activeRoute = routeOverride ?? m.route;

  const [layerPreset, setLayerPreset] = useState<LayerPreset>('imagery');
  const [on, setOn] = useState<Record<string, boolean>>({
    imagery: true,
    hillshade: true,
    slope: false,
    hazard: false,
    chemical: false,
    geology: false,
    rover: true,
    sites: true,
    route: true,
  });

  const applyLayerPreset = (preset: LayerPreset) => {
    setLayerPreset(preset);
    if (preset === 'imagery') {
      setOn((prev) => ({ ...prev, imagery: true, hillshade: true, slope: false, hazard: false }));
    } else if (preset === 'terrain') {
      setOn((prev) => ({ ...prev, imagery: false, hillshade: true, slope: true, hazard: false }));
    } else {
      setOn((prev) => ({ ...prev, imagery: true, hillshade: true, slope: false, hazard: true }));
    }
  };

  const [mode, setMode] = useState<ClickMode>('inspect');
  const [tab, setTab] = useState<Tab>('route');
  const [siteId, setSiteId] = useState<string | null>(null);
  const [placeCardSiteId, setPlaceCardSiteId] = useState<string | null>(null);
  const [podCardOpen, setPodCardOpen] = useState(false);
  const [pondCardOpen, setPondCardOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [obsRadius, setObsRadius] = useState(150);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [leftRailOpen, setLeftRailOpen] = useState(true);
  const [rightRailOpen, setRightRailOpen] = useState(true);
  const [followAstronaut, setFollowAstronaut] = useState(false);
  const [showKeysHint, setShowKeysHint] = useState(true);
  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null);

  // Wall clock ticker (750ms) so live crewmates keep moving smoothly without burning CPU
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => setNowMs(Date.now()), 750);
    return () => clearInterval(id);
  }, [isOpen]);

  // Image loading / error / 0x0 guard state so map NEVER silently fails to black
  const [imgStatus, setImgStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [boxCollapseError, setBoxCollapseError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Laser zap visual beam in Junior Mode
  const [laserBeam, setLaserBeam] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Camera state for smooth WASD pan, zoom, and fly-to animations
  const [cam, setCam] = useState({ x: 0, y: 0, zoom: 1 });
  const flyTargetRef = useRef<{ x: number; y: number; zoom: number } | null>(null);
  const velRef = useRef({ vx: 0, vy: 0, vz: 0 });
  const keysDown = useRef<Record<string, boolean>>({});
  const isDraggingMap = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, camX: 0, camY: 0 });
  const touchPinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportPx, setViewportPx] = useState({ w: 1280, h: 800 });

  const meta = m.meta;
  const site = m.sites.find((s) => s.id === siteId) ?? null;
  const placeCardSite = m.sites.find((s) => s.id === placeCardSiteId) ?? null;
  const prov = (kind: string) => meta?.layers.find((l) => l.kind === kind);
  const imageryUrl = meta?.layer_urls?.imagery ? api.assetUrl(meta.layer_urls.imagery) : '';

  // Base square dimension fills full viewport edge-to-edge on load
  const mapBasePx = Math.max(viewportPx.w, viewportPx.h, 640);

  // Auto-collapse side rails on narrow viewports so map stays clean
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth < 1024) {
      setLeftRailOpen(false);
      setRightRailOpen(false);
    }
  }, []);

  // Measure viewport & run permanent E1 non-zero map container guard
  useEffect(() => {
    if (!isOpen) return;
    const syncSize = () => {
      const vp = viewportRef.current;
      if (vp) {
        setViewportPx({ w: vp.clientWidth || 1280, h: vp.clientHeight || 800 });
      }
      const el = mapRef.current;
      if (el) {
        const w = el.clientWidth;
        const h = el.clientHeight;
        if (w <= 0 || h <= 0) {
          setBoxCollapseError(`Map container collapsed to ${w}×${h} px.`);
        } else {
          setBoxCollapseError(null);
        }
      }
    };
    const raf = requestAnimationFrame(syncSize);
    const timer = setTimeout(syncSize, 250);
    window.addEventListener('resize', syncSize);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      window.removeEventListener('resize', syncSize);
    };
  }, [isOpen, meta]);

  // Check imagery load status cleanly
  useEffect(() => {
    if (!imageryUrl) {
      setImgStatus('error');
      return;
    }
    const img = imgRef.current;
    if (img && img.complete) {
      setImgStatus(img.naturalWidth > 0 ? 'loaded' : 'error');
    } else {
      setImgStatus('loading');
    }
  }, [imageryUrl, isOpen]);

  useEffect(() => {
    const timer = setTimeout(() => setShowKeysHint(false), 5500);
    return () => clearTimeout(timer);
  }, []);

  const pos = useMemo(() => {
    if (!meta) return null;
    return (lat: number, lon: number) => {
      const { fx, fy } = latLonToFrac(meta, lat, lon);
      return { x: fx * 1000, y: fy * 1000 };
    };
  }, [meta]);

  const cleanTitle = useMemo(() => {
    if (!meta) return 'Jezero Crater';
    return (
      meta.name
        .replace(/\s*-\s*Western Delta\s*\(PRIMARY\)/i, '')
        .replace(/\s*\(PRIMARY\)/i, '')
        .replace(/region/gi, '')
        .trim() || 'Jezero Crater'
    );
  }, [meta]);

  const ps = useMemo(() => pathState(activeRoute), [activeRoute]);

  const routePoints2D: Point2D[] = useMemo(() => {
    if (!activeRoute?.points || !pos) return [];
    return activeRoute.points.map((p) => {
      const q = pos(p.lat, p.lon);
      return {
        x: q.x,
        y: q.y,
        lat: p.lat,
        lon: p.lon,
        slope_deg: p.slope_deg,
        elev_m: p.elev_m,
      };
    });
  }, [activeRoute, pos]);

  const smoothMainRoute = useMemo(() => catmullRomPath(routePoints2D), [routePoints2D]);
  const slopeSegments = useMemo(
    () => buildSlopeSegments(routePoints2D, m.options?.caution_slope_deg ?? 12),
    [routePoints2D, m.options?.caution_slope_deg]
  );

  const distanceFlags = useMemo(() => {
    if (!activeRoute || !routePoints2D.length) return [];
    return calculateDistanceFlags(routePoints2D, ps.cum);
  }, [activeRoute, routePoints2D, ps.cum]);

  const liveAstronaut = useMemo(() => {
    if (!activeRoute || !pos) return null;
    const p = positionAt(activeRoute, ps, walkDistance);
    if (!p) return null;
    const q = pos(p.lat, p.lon);
    return { ...p, x: q.x, y: q.y };
  }, [activeRoute, ps, walkDistance, pos]);

  const playerLatLon = liveAstronaut
    ? { lat: liveAstronaut.lat, lon: liveAstronaut.lon }
    : astronaut ?? m.start ?? null;

  // Live non-player Martian crewmates updating continuously on wall-clock time
  const liveCrew: LiveCrewMember[] = useMemo(
    () => computeCrewStates(m.sites, playerLatLon, activeRoute?.points ?? null, nowMs),
    [m.sites, playerLatLon, activeRoute?.points, nowMs]
  );

  const playerInPond = inPond ?? (playerLatLon ? isInResearchPond(playerLatLon.lat, playerLatLon.lon) : false);

  const pondVerts2D = useMemo(() => {
    if (!pos) return [];
    return pondPerimeterVertices(12).map((v) => pos(v.lat, v.lon));
  }, [pos]);

  const pondSpots2D = useMemo(() => {
    if (!pos) return [];
    return POND_SPOTS.map((spot) => {
      const c = pondSpotCoords(spot);
      return { spot, ...pos(c.lat, c.lon) };
    });
  }, [pos]);

  // Strict collision-free label placement for 2D map (max 3 site labels unless zoomed >= 1.65x; Pond/Pod/Flags/Crew never collide)
  const labelLayout = useMemo(() => {
    const empty = {
      pondBox: null as { x: number; y: number; w: number; h: number } | null,
      podBox: null as { x: number; y: number; w: number; h: number } | null,
      siteBoxes: new Map<string, { x: number; y: number; w: number; h: number }>(),
      visibleFlags: new Set<number>(),
      crewBoxes: new Map<string, { x: number; y: number; w: number; h: number }>(),
    };
    if (!pos) return empty;

    const placed: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    const pad = 4;
    const fits = (x: number, y: number, w: number, h: number) => {
      const b = { x1: x - pad, y1: y - pad, x2: x + w + pad, y2: y + h + pad };
      for (const p of placed) {
        if (b.x1 < p.x2 && b.x2 > p.x1 && b.y1 < p.y2 && b.y2 > p.y1) return false;
      }
      placed.push(b);
      return true;
    };

    // 1. Research Pond label at outer perimeter edge (never inside pin pile or under header)
    const pondC = pos(RESEARCH_POND.lat, RESEARCH_POND.lon);
    const pondW = 104;
    const pondH = 14;
    const pondCandidates = [
      { x: pondC.x - pondW / 2, y: pondC.y - 42 },
      { x: pondC.x - pondW / 2, y: pondC.y + 28 },
    ];
    for (const c of pondCandidates) {
      if (fits(c.x, c.y, pondW, pondH)) {
        empty.pondBox = { x: c.x, y: c.y, w: pondW, h: pondH };
        break;
      }
    }

    // Reserve pin circle footprints & live player YOU label first so labels never collide with them
    if (playerLatLon) {
      const pSvg = pos(playerLatLon.lat, playerLatLon.lon);
      placed.push({ x1: pSvg.x - 36, y1: pSvg.y - 10, x2: pSvg.x + 14, y2: pSvg.y + 24 });
    }
    const plotted = m.sites.filter((s) => s.lat != null && s.lon != null);
    for (const s of plotted) {
      const q = pos(s.lat as number, s.lon as number);
      placed.push({ x1: q.x - 11, y1: q.y - 23, x2: q.x + 11, y2: q.y + 4 });
    }

    // 2. Priority-sorted sites: Selected -> Goal -> Nearest to player
    const sorted = [...plotted].sort((a, b) => {
      const aSel = a.id === placeCardSiteId ? 0 : a.id === m.goalId ? 1 : 2;
      const bSel = b.id === placeCardSiteId ? 0 : b.id === m.goalId ? 1 : 2;
      if (aSel !== bSel) return aSel - bSel;
      if (!playerLatLon) return 0;
      const da = offsetM(playerLatLon.lat, playerLatLon.lon, a.lat as number, a.lon as number);
      const db = offsetM(playerLatLon.lat, playerLatLon.lon, b.lat as number, b.lon as number);
      return Math.hypot(da.dx, da.dy) - Math.hypot(db.dx, db.dy);
    });

    const maxSites = cam.zoom >= 1.65 ? sorted.length : 3;
    for (const s of sorted) {
      if (empty.siteBoxes.size >= maxSites) break;
      const q = pos(s.lat as number, s.lon as number);
      const w = Math.max(52, s.name.length * 5.6 + 12);
      const h = 15;
      const slots = [
        { x: q.x + 11, y: q.y - 20 },
        { x: q.x - w - 11, y: q.y - 20 },
        { x: q.x - w / 2, y: q.y + 8 },
      ];
      for (const sl of slots) {
        if (fits(sl.x, sl.y, w, h)) {
          empty.siteBoxes.set(s.id, { x: sl.x, y: sl.y, w, h });
          break;
        }
      }
    }

    // 3. Science Pod compact pill (never overlapping Landing/Séítah)
    const pq = pos(18.4446, 77.4509);
    const podW = 68;
    const podH = 15;
    for (const sl of [
      { x: pq.x + 24, y: pq.y - 18 },
      { x: pq.x + 24, y: pq.y + 4 },
      { x: pq.x - podW - 6, y: pq.y + 4 },
    ]) {
      if (fits(sl.x, sl.y, podW, podH)) {
        empty.podBox = { x: sl.x, y: sl.y, w: podW, h: podH };
        break;
      }
    }

    // 4. Route km flags (hidden if colliding with Pond/Pod/Site labels)
    for (const flag of distanceFlags) {
      if (fits(flag.x + 5, flag.y - 11, 30, 13)) {
        empty.visibleFlags.add(flag.km);
      }
    }

    // 5. Compact first-name NPC tags (never collide with anything else)
    for (const crew of liveCrew) {
      const q = pos(crew.lat, crew.lon);
      const w = Math.max(42, crew.firstName.length * 6.2 + 10);
      const h = 14;
      for (const sl of [
        { x: q.x + 8, y: q.y - 7 },
        { x: q.x - w - 8, y: q.y - 7 },
        { x: q.x - w / 2, y: q.y + 10 },
      ]) {
        if (fits(sl.x, sl.y, w, h)) {
          empty.crewBoxes.set(crew.id, { x: sl.x, y: sl.y, w, h });
          break;
        }
      }
    }

    return empty;
  }, [pos, m.sites, m.goalId, placeCardSiteId, playerLatLon, cam.zoom, distanceFlags, liveCrew]);

  // Smooth camera helper to fly to a given 1000x1000 SVG point
  const flyToSvgPoint = (svgX: number, svgY: number, zoom = 1.75) => {
    setFollowAstronaut(false);
    const scalePx = mapBasePx / 1000;
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    flyTargetRef.current = {
      x: (500 - svgX) * scalePx * z,
      y: (500 - svgY) * scalePx * z,
      zoom: z,
    };
  };

  const handleRecenter = () => {
    hudSound.playClick();
    if (liveAstronaut) {
      flyToSvgPoint(liveAstronaut.x, liveAstronaut.y, 1.35);
    } else if (m.start && pos) {
      const q = pos(m.start.lat, m.start.lon);
      flyToSvgPoint(q.x, q.y, 1.25);
    } else {
      flyTargetRef.current = { x: 0, y: 0, zoom: 1 };
    }
  };

  const adjustZoom = (delta: number) => {
    flyTargetRef.current = null;
    setCam((c) => {
      const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, c.zoom + delta));
      const ratio = nextZoom / Math.max(0.01, c.zoom);
      return {
        x: Math.max(-1800, Math.min(1800, c.x * ratio)),
        y: Math.max(-1800, Math.min(1800, c.y * ratio)),
        zoom: nextZoom,
      };
    });
  };

  const followRef = useRef(followAstronaut);
  followRef.current = followAstronaut;
  const astronautRef = useRef(liveAstronaut);
  astronautRef.current = liveAstronaut;
  const mapBaseRef = useRef(mapBasePx);
  mapBaseRef.current = mapBasePx;

  // Keyboard & Animation Loop (WASD pan + Follow cam + Smooth fly-to + M/Space/Esc)
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const k = e.key.toLowerCase();
      keysDown.current[e.key] = true;
      keysDown.current[k] = true;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (analysisOpen) {
          setAnalysisOpen(false);
          return;
        }
        if (detailsOpen) {
          setDetailsOpen(false);
          return;
        }
        onOpenPauseMenu?.();
      } else if (k === ' ') {
        e.preventDefault();
        onToggleWalking?.();
      } else if (k === 'm') {
        e.preventDefault();
        onClose();
      } else if (k === 'f') {
        e.preventDefault();
        setFollowAstronaut((f) => !f);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      delete keysDown.current[e.key];
      delete keysDown.current[k];
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let animId: number;
    const updateMotion = () => {
      const keys = keysDown.current;
      const shift = keys['Shift'] ? 2.4 : 1.0;
      const panStep = 5.5 * shift;
      const zoomStep = 0.022 * shift;

      let manualInput = false;
      if (keys['w'] || keys['arrowup']) {
        velRef.current.vy += panStep;
        manualInput = true;
      }
      if (keys['s'] || keys['arrowdown']) {
        velRef.current.vy -= panStep;
        manualInput = true;
      }
      if (keys['a'] || keys['arrowleft']) {
        velRef.current.vx += panStep;
        manualInput = true;
      }
      if (keys['d'] || keys['arrowright']) {
        velRef.current.vx -= panStep;
        manualInput = true;
      }
      if (keys['q'] || keys['-'] || keys['_']) {
        velRef.current.vz -= zoomStep;
        manualInput = true;
      }
      if (keys['e'] || keys['+'] || keys['=']) {
        velRef.current.vz += zoomStep;
        manualInput = true;
      }

      if (manualInput) {
        flyTargetRef.current = null;
        if (followRef.current) setFollowAstronaut(false);
      }

      velRef.current.vx *= 0.85;
      velRef.current.vy *= 0.85;
      velRef.current.vz *= 0.85;

      const hasVel =
        Math.abs(velRef.current.vx) > 0.01 ||
        Math.abs(velRef.current.vy) > 0.01 ||
        Math.abs(velRef.current.vz) > 0.001;

      if (hasVel || flyTargetRef.current || (followRef.current && astronautRef.current)) {
        setCam((c) => {
          if (flyTargetRef.current && !hasVel) {
            const ft = flyTargetRef.current;
            const nx = c.x + (ft.x - c.x) * 0.16;
            const ny = c.y + (ft.y - c.y) * 0.16;
            const nz = c.zoom + (ft.zoom - c.zoom) * 0.16;
            if (Math.hypot(ft.x - nx, ft.y - ny) < 1 && Math.abs(ft.zoom - nz) < 0.01) {
              flyTargetRef.current = null;
              return ft;
            }
            return { x: nx, y: ny, zoom: nz };
          }

          const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, c.zoom + velRef.current.vz));
          const maxPan = Math.max(700, mapBaseRef.current * nextZoom * 0.65);
          let nextX = Math.max(-maxPan, Math.min(maxPan, c.x + velRef.current.vx));
          let nextY = Math.max(-maxPan, Math.min(maxPan, c.y + velRef.current.vy));

          if (followRef.current && astronautRef.current && !manualInput) {
            const scalePx = mapBaseRef.current / 1000;
            const targetX = (500 - astronautRef.current.x) * scalePx * nextZoom;
            const targetY = (500 - astronautRef.current.y) * scalePx * nextZoom;
            nextX = c.x + (targetX - c.x) * 0.12;
            nextY = c.y + (targetY - c.y) * 0.12;
          }

          return { x: nextX, y: nextY, zoom: nextZoom };
        });
      }

      animId = requestAnimationFrame(updateMotion);
    };

    animId = requestAnimationFrame(updateMotion);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      cancelAnimationFrame(animId);
    };
  }, [isOpen, analysisOpen, detailsOpen, onOpenPauseMenu, onToggleWalking, onClose]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'inspect') return;
    if ((e.target as HTMLElement).closest('button, a, input, select, aside, header, footer, [data-map-ui="true"]')) return;
    flyTargetRef.current = null;
    isDraggingMap.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, camX: cam.x, camY: cam.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingMap.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const maxPan = Math.max(700, mapBasePx * cam.zoom * 0.65);
    setFollowAstronaut(false);
    setCam((c) => ({
      ...c,
      x: Math.max(-maxPan, Math.min(maxPan, dragStart.current.camX + dx)),
      y: Math.max(-maxPan, Math.min(maxPan, dragStart.current.camY + dy)),
    }));
  };

  const handleMouseUp = () => {
    isDraggingMap.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if ((e.target as HTMLElement).closest('aside, [data-scrollable="true"]')) return;
    const step = e.ctrlKey ? -e.deltaY * 0.008 : e.deltaY < 0 ? 0.14 : -0.14;
    adjustZoom(step);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (mode !== 'inspect') return;
    if ((e.target as HTMLElement).closest('button, a, input, select, aside, [data-map-ui="true"]')) return;
    adjustZoom(0.55);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input, select, aside, header, footer, [data-map-ui="true"]')) return;
    if (e.touches.length === 1) {
      isDraggingMap.current = true;
      dragStart.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        camX: cam.x,
        camY: cam.y,
      };
      touchPinchRef.current = null;
    } else if (e.touches.length === 2) {
      isDraggingMap.current = false;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchPinchRef.current = { dist, zoom: cam.zoom };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDraggingMap.current) {
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;
      setFollowAstronaut(false);
      setCam((c) => ({
        ...c,
        x: Math.max(-1800, Math.min(1800, dragStart.current.camX + dx)),
        y: Math.max(-1800, Math.min(1800, dragStart.current.camY + dy)),
      }));
    } else if (e.touches.length === 2 && touchPinchRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / Math.max(touchPinchRef.current.dist, 1);
      setCam((c) => ({
        ...c,
        zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, touchPinchRef.current!.zoom * ratio)),
      }));
    }
  };

  const handleTouchEnd = () => {
    isDraggingMap.current = false;
    touchPinchRef.current = null;
  };

  const nearbyPlotted = useMemo(() => {
    return m.sites
      .filter((s) => s.lat != null && s.lon != null)
      .map((s) => {
        const d =
          playerLatLon != null
            ? Math.round(
                Math.hypot(
                  offsetM(playerLatLon.lat, playerLatLon.lon, s.lat as number, s.lon as number).dx,
                  offsetM(playerLatLon.lat, playerLatLon.lon, s.lat as number, s.lon as number).dy
                )
              )
            : null;
        return { site: s, distM: d };
      })
      .sort((a, b) => (a.distM ?? 999999) - (b.distM ?? 999999));
  }, [m.sites, playerLatLon]);

  const placeCardDistM = useMemo(() => {
    if (!placeCardSite || placeCardSite.lat == null || placeCardSite.lon == null || !playerLatLon) return null;
    const { dx, dy } = offsetM(playerLatLon.lat, playerLatLon.lon, placeCardSite.lat, placeCardSite.lon);
    return Math.round(Math.hypot(dx, dy));
  }, [placeCardSite, playerLatLon]);

  if (!isOpen) return null;

  if (!meta || !pos) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#06040a] text-slate-200 font-mono text-sm">
        {m.loadError ? (
          <div className="max-w-md text-center space-y-2 p-6 rounded-2xl border border-red-500/40 bg-red-950/30">
            <TriangleAlert className="w-6 h-6 mx-auto text-red-400" />
            <div>Could not load map data</div>
            <div className="text-xs text-red-300/80">{m.loadError}</div>
            <button className="mt-3 px-4 py-2 rounded border border-white/20" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          'Loading the Mars map…'
        )}
      </div>
    );
  }

  const runPlan = (o?: Parameters<typeof m.plan>[0]) => {
    game?.recordRoutePlanned(o?.goalId ?? m.goalId ?? null);
    return m.plan(o).then((ok) => ok);
  };

  // Dynamic zoom-adjusted real scale bar (picks a step yielding ~55–150 px at current zoom)
  const pxPerMeter = (mapBasePx * cam.zoom) / (meta.grid.width * meta.grid.cell_m);
  const scaleStepsM = [100, 250, 500, 1000, 2000, 5000];
  const scaleStepM = scaleStepsM.reduce(
    (best, meters) =>
      Math.abs(meters * pxPerMeter - 90) < Math.abs(best * pxPerMeter - 90) ? meters : best,
    1000
  );
  const scaleBarWidthPx = Math.max(32, Math.min(180, scaleStepM * pxPerMeter));
  const scaleBarLabel = scaleStepM >= 1000 ? `${scaleStepM / 1000} km` : `${scaleStepM} m`;
  const mPerUnit = (meta.grid.width * meta.grid.cell_m) / 1000;

  // Live map-center lat/lon computed directly from camera pan & zoom
  const centerFx = Math.max(0, Math.min(1, 0.5 - cam.x / Math.max(1, mapBasePx * cam.zoom)));
  const centerFy = Math.max(0, Math.min(1, 0.5 - cam.y / Math.max(1, mapBasePx * cam.zoom)));
  const mapCenterLatLon = fracToLatLon(meta, centerFx, centerFy);

  const openResearchPondCard = () => {
    if (!pos) return;
    hudSound.playClick();
    setPlaceCardSiteId(null);
    setPodCardOpen(false);
    setPondCardOpen(true);
    const q = pos(RESEARCH_POND.lat, RESEARCH_POND.lon);
    flyToSvgPoint(q.x, q.y, Math.max(cam.zoom, 1.85));
  };

  // Search filtering across all 10 real sites (plus marked Research Pond game zone at Delta Front)
  const qNorm = searchQuery.trim().toLowerCase();
  const pondMatches =
    qNorm.length > 0 &&
    ('research pond'.includes(qNorm) || 'pond'.includes(qNorm) || 'lakebed'.includes(qNorm));
  const matchingSites = qNorm
    ? m.sites.filter(
        (s) =>
          s.name.toLowerCase().includes(qNorm) ||
          s.id.toLowerCase().includes(qNorm) ||
          (s.goal ?? '').toLowerCase().includes(qNorm)
      )
    : [];

  const handleSelectSearchSite = (s: Site) => {
    setSearchQuery(s.name);
    setSearchDropdownOpen(false);
    setSearchMessage(null);
    setSiteId(s.id);
    setPlaceCardSiteId(s.id);
    if (s.lat != null && s.lon != null) {
      const p = pos(s.lat, s.lon);
      flyToSvgPoint(p.x, p.y, 1.85);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qNorm) {
      setSearchMessage(null);
      setSearchDropdownOpen(false);
      return;
    }
    if (pondMatches && matchingSites.length === 0) {
      setSearchQuery(RESEARCH_POND.name);
      setSearchDropdownOpen(false);
      setSearchMessage(null);
      openResearchPondCard();
    } else if (matchingSites.length > 0) {
      handleSelectSearchSite(matchingSites[0]);
    } else {
      setSearchMessage('No place with that name on this map.');
      setSearchDropdownOpen(true);
    }
  };

  const onMapClick = (e: React.MouseEvent) => {
    if (mode === 'inspect' || !mapRef.current) return;
    const r = mapRef.current.getBoundingClientRect();
    const { lat, lon } = fracToLatLon(meta, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    hudSound.playClick();
    if (mode === 'start') {
      m.setStart({ lat, lon });
      runPlan({ start: { lat, lon } });
    } else {
      const next = [...m.obstacles, { lat, lon, radius_m: obsRadius, name: 'user obstacle' }];
      m.setObstacles(next);
      runPlan({ obstacles: next });
    }
    setMode('inspect');
  };

  const removeObstacle = (i: number) => {
    const next = m.obstacles.filter((_, k) => k !== i);
    m.setObstacles(next);
    runPlan({ obstacles: next });
  };

  const fireZapAtSite = (s: Site, q: { x: number; y: number }) => {
    hudSound.playLaserZap();
    const origin = liveAstronaut ?? (m.start ? pos(m.start.lat, m.start.lon) : { x: 500, y: 500 });
    setLaserBeam({ x1: origin.x, y1: origin.y, x2: q.x, y2: q.y - 16 });
    setTimeout(() => {
      setLaserBeam(null);
      onZapSite?.(s);
    }, 380);
  };

  const selectSite = (s: Site, q?: { x: number; y: number }) => {
    hudSound.playClick();
    setSiteId(s.id);
    setPlaceCardSiteId(s.id);
    setSelectedCrewId(null);
    game?.recordChemistryRead(s.id);
    if (q) {
      flyToSvgPoint(q.x, q.y, Math.max(cam.zoom, 1.45));
    }
  };

  const setOpt = (k: keyof NonNullable<typeof m.options>, v: number) =>
    m.options && m.setOptions({ ...m.options, [k]: v });

  const Slider = ({
    label,
    k,
    min,
    max,
    step,
    unit,
  }: {
    label: string;
    k: keyof NonNullable<typeof m.options>;
    min: number;
    max: number;
    step: number;
    unit: string;
  }) => (
    <label className="block">
      <div className="flex justify-between text-[10px] font-mono text-white/60">
        <span>{label}</span>
        <span className="text-[#ff8a8e]">
          {m.options?.[k]} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={m.options?.[k] ?? min}
        onChange={(e) => setOpt(k, Number(e.target.value))}
        className="w-full accent-[#E5484D]"
      />
    </label>
  );

  const goalObj = m.sites.find((s) => s.id === m.goalId) ?? null;
  const currentGoalName = goalObj?.name ?? 'Kodiak';
  const remainingDist = distanceRemaining ?? Math.max(0, ps.total - walkDistance);

  const hzInfo = hazardLevel(
    activeRoute?.max_slope_deg ?? null,
    m.options?.caution_slope_deg ?? 12,
    m.options?.max_slope_deg ?? 20,
    (activeRoute?.explanation?.obstacles?.near_route?.length ?? 0) > 0
  );

  const arrivalO2Pct =
    oxygenHud?.remainingPct ?? activeRoute?.safety?.oxygen?.remaining_on_arrival_pct ?? null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#08050a] text-slate-100 select-none cursor-default font-sans overflow-hidden"
      role="dialog"
      aria-label="Mars satellite map and traverse navigator"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ─────────────────────────────────────────────────────────────
          FULL-BLEED MAP VIEWPORT (Edge-to-edge Google Maps canvas)
      ───────────────────────────────────────────────────────────── */}
      <div
        ref={viewportRef}
        className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#120907]"
      >
        <div
          ref={mapRef}
          id="mars-map-canvas-container"
          onClick={onMapClick}
          className={`relative shrink-0 overflow-hidden bg-transparent transition-transform duration-75 ease-out ${
            mode !== 'inspect' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
          }`}
          style={{
            width: `${mapBasePx}px`,
            height: `${mapBasePx}px`,
            transform: `translate3d(${cam.x}px, ${cam.y}px, 0px) scale(${cam.zoom})`,
            transformOrigin: 'center center',
          }}
        >
          {/* 1. Primary Measured CTX Photo-Map */}
          {imageryUrl && on.imagery && (
            <img
              ref={imgRef}
              src={imageryUrl}
              alt="Jezero Crater measured CTX surface imagery"
              onLoad={() => setImgStatus('loaded')}
              onError={() => setImgStatus('error')}
              className="absolute inset-0 z-[1] w-full h-full object-fill [image-rendering:auto]"
              draggable={false}
            />
          )}

          {/* 2. Hillshade Overlay */}
          {meta.layer_urls.hillshade && on.hillshade && (
            <img
              src={api.assetUrl(meta.layer_urls.hillshade)}
              alt="Terrain shading"
              className="absolute inset-0 z-[2] w-full h-full object-fill pointer-events-none"
              style={{
                mixBlendMode: imageryUrl && on.imagery ? 'multiply' : 'normal',
                opacity: imageryUrl && on.imagery ? 0.65 : 1,
              }}
              draggable={false}
            />
          )}

          {/* 3. Thematic Raster Layers (Slope / Hazards / Chemistry) */}
          {meta.layer_urls.slope && on.slope && (
            <img
              src={api.assetUrl(meta.layer_urls.slope)}
              alt="Slope classes"
              className="absolute inset-0 z-[3] w-full h-full object-fill pointer-events-none"
              style={{ opacity: on.imagery ? 0.65 : 0.92 }}
              draggable={false}
            />
          )}
          {meta.layer_urls.chemical && on.chemical && (
            <img
              src={api.assetUrl(meta.layer_urls.chemical)}
              alt="Chemical index"
              className="absolute inset-0 z-[3] w-full h-full object-fill pointer-events-none"
              draggable={false}
            />
          )}
          {meta.layer_urls.hazard && on.hazard && !on.slope && (
            <img
              src={api.assetUrl(meta.layer_urls.hazard)}
              alt={isJunior ? 'Too steep' : 'Too steep to walk'}
              className="absolute inset-0 z-[3] w-full h-full object-fill pointer-events-none"
              style={{ opacity: 0.72 }}
              draggable={false}
            />
          )}

          {/* 4. SVG Overlay: Smooth Route Trail, km Flags, Site Pins, Player, Living Crew */}
          <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="absolute inset-0 z-[4] w-full h-full">
            {/* Geological Polygons */}
            {on.geology &&
              m.geology.map((g) => {
                const pts = g.polygon
                  .map(([la, lo]) => {
                    const q = pos(la, lo);
                    return `${q.x.toFixed(1)},${q.y.toFixed(1)}`;
                  })
                  .join(' ');
                const c0 = g.polygon.reduce(
                  (a, [la, lo]) => {
                    const q = pos(la, lo);
                    return { x: a.x + q.x / g.polygon.length, y: a.y + q.y / g.polygon.length };
                  },
                  { x: 0, y: 0 }
                );
                const col = GEO_COLOR[g.type] ?? '#e5e7eb';
                return (
                  <g key={g.id} className="pointer-events-none">
                    <polygon
                      points={pts}
                      fill={col}
                      fillOpacity={g.type === 'boxwork' ? 0.08 : 0.16}
                      stroke={col}
                      strokeWidth="2.5"
                      strokeDasharray={g.type === 'boxwork' ? '3 5' : undefined}
                    />
                    <text
                      x={c0.x}
                      y={c0.y}
                      textAnchor="middle"
                      fill={col}
                      fontSize="14"
                      fontFamily="monospace"
                      stroke="#000"
                      strokeWidth="3"
                      paintOrder="stroke"
                    >
                      {g.name}
                    </text>
                  </g>
                );
              })}

            {/* Evidenced Hazards */}
            {m.hazards.map((h) => {
              const q = pos(h.lat, h.lon);
              return (
                <circle
                  key={h.id}
                  cx={q.x}
                  cy={q.y}
                  r={Math.max(6, h.radius_m / mPerUnit)}
                  fill="rgba(239,68,68,0.22)"
                  stroke="#f87171"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
              );
            })}

            {/* User Obstacles */}
            {m.obstacles.map((o, i) => {
              const q = pos(o.lat, o.lon);
              return (
                <circle
                  key={i}
                  cx={q.x}
                  cy={q.y}
                  r={Math.max(6, o.radius_m / mPerUnit)}
                  fill="rgba(239,68,68,0.35)"
                  stroke="#fecaca"
                  strokeWidth="2"
                />
              );
            })}

            {/* Alternate Routes (when not overridden by short Junior leg) */}
            {on.route &&
              !routeOverride &&
              m.foundRoutes.map((r, i) => {
                if (i === m.routeIdx) return null;
                const pts2d = (r.points ?? []).map((p) => pos(p.lat, p.lon));
                const smoothAlt = catmullRomPath(pts2d);
                return (
                  <path
                    key={r.strategy}
                    d={smoothAlt}
                    fill="none"
                    stroke={STRATEGY[r.strategy].color}
                    strokeOpacity="0.45"
                    strokeWidth="3"
                    strokeDasharray="8 6"
                  />
                );
              })}

            {/* Primary Planned Route: Mars Red Glowing Catmull-Rom Trail + km Flags */}
            {on.route && activeRoute && smoothMainRoute && (
              <g>
                <path
                  d={smoothMainRoute}
                  fill="none"
                  stroke="rgba(255, 59, 48, 0.25)"
                  strokeWidth="13"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={smoothMainRoute}
                  fill="none"
                  stroke="rgba(229, 72, 77, 0.58)"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {slopeSegments.map((seg) => (
                  <path
                    key={seg.index}
                    d={seg.d}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}

                {distanceFlags
                  .filter((flag) => labelLayout.visibleFlags.has(flag.km))
                  .map((flag) => (
                    <g key={flag.km} className="pointer-events-none select-none">
                      <circle cx={flag.x} cy={flag.y} r="2.8" fill="#ffffff" stroke="#E5484D" strokeWidth="1.4" />
                      <rect
                        x={flag.x + 5}
                        y={flag.y - 11}
                        width="30"
                        height="13"
                        rx="3"
                        fill="rgba(16, 6, 8, 0.9)"
                        stroke="#E5484D"
                        strokeWidth="1"
                      />
                      <text
                        x={flag.x + 20}
                        y={flag.y - 1.5}
                        textAnchor="middle"
                        fill="#ff8a8e"
                        fontSize="8.5"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {flag.km} km
                      </text>
                    </g>
                  ))}
              </g>
            )}

            {/* Start Pin Dot (keeps map clean beside Science Pod & Landing labels) */}
            {m.start &&
              (() => {
                const q = pos(m.start.lat, m.start.lon);
                return (
                  <g className="pointer-events-none select-none">
                    <ellipse cx={q.x} cy={q.y + 5} rx="9" ry="3.5" fill="rgba(0,0,0,0.55)" />
                    <circle cx={q.x} cy={q.y} r="6.5" fill="#E5484D" stroke="#ffffff" strokeWidth="1.8" />
                  </g>
                );
              })()}

            {/* Research Pond Closed Field Zone at Delta Front (18.441 N, 77.412 E — Dry Ancient Lakebed) */}
            {pondVerts2D.length > 0 &&
              (() => {
                const center = pos(RESEARCH_POND.lat, RESEARCH_POND.lon);
                const polyPts = pondVerts2D.map((v) => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(' ');
                return (
                  <g
                    id="research-pond-map-zone"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (playerInPond && onOpenPond) {
                        onOpenPond();
                      } else {
                        openResearchPondCard();
                      }
                    }}
                    className="cursor-pointer select-none"
                  >
                    <polygon
                      points={polyPts}
                      fill={playerInPond ? 'rgba(255, 59, 48, 0.22)' : 'rgba(229, 72, 77, 0.13)'}
                      stroke="#FF3B30"
                      strokeWidth="2.2"
                      strokeDasharray="6 4"
                    />
                    {/* Perimeter Boundary Beacons (marked exploration zone, not a real fence) */}
                    {pondVerts2D.map((v, idx) => (
                      <rect
                        key={`pond-beacon-${idx}`}
                        x={v.x - 2.6}
                        y={v.y - 2.6}
                        width="5.2"
                        height="5.2"
                        transform={`rotate(45 ${v.x} ${v.y})`}
                        fill={idx % 2 === 0 ? '#FF3B30' : '#fbbf24'}
                        stroke="#120608"
                        strokeWidth="0.9"
                      />
                    ))}
                    {/* 6 Real Collect Spots inside the Research Pond */}
                    {pondSpots2D.map(({ spot, x, y }) => {
                      const collected = game?.progress.inventory.some(
                        (i) =>
                          i.siteId === spot.id &&
                          (i.collectedSol == null || i.collectedSol === CURRENT_SIM_SOL)
                      );
                      return (
                        <g
                          key={spot.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (playerInPond && onOpenPond) onOpenPond();
                            else openResearchPondCard();
                          }}
                        >
                          <circle
                            cx={x}
                            cy={y}
                            r="4"
                            fill={collected ? '#34d399' : '#fbbf24'}
                            stroke="#120608"
                            strokeWidth="1.2"
                          />
                        </g>
                      );
                    })}
                    {/* Research Pond Edge Label (collision-free) */}
                    {labelLayout.pondBox && (
                      <g>
                        <rect
                          x={labelLayout.pondBox.x}
                          y={labelLayout.pondBox.y}
                          width={labelLayout.pondBox.w}
                          height={labelLayout.pondBox.h}
                          rx="4"
                          fill="rgba(24, 6, 8, 0.94)"
                          stroke="#FF3B30"
                          strokeWidth="1.1"
                        />
                        <text
                          x={labelLayout.pondBox.x + labelLayout.pondBox.w / 2}
                          y={labelLayout.pondBox.y + 10}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="7.8"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          RESEARCH POND (DRY)
                        </text>
                      </g>
                    )}
                  </g>
                );
              })()}

            {/* Science Pod Habitat Marker at Octavia E. Butler Landing Site (18.4446 N, 77.4509 E) */}
            {(() => {
              const pq = pos(18.4446, 77.4509);
              return (
                <g
                  onClick={(e) => {
                    e.stopPropagation();
                    hudSound.playClick();
                    setPlaceCardSiteId(null);
                    setPodCardOpen(true);
                    flyToSvgPoint(pq.x, pq.y, Math.max(cam.zoom, 1.55));
                  }}
                  className="cursor-pointer select-none"
                >
                  <circle cx={pq.x + 12} cy={pq.y - 12} r="15" fill="none" stroke="#FF3B30" strokeWidth="1.3" opacity="0.55" />
                  <polygon
                    points={`${pq.x + 12},${pq.y - 22} ${pq.x + 20},${pq.y - 17} ${pq.x + 20},${pq.y - 7} ${pq.x + 12},${pq.y - 2} ${pq.x + 4},${pq.y - 7} ${pq.x + 4},${pq.y - 17}`}
                    fill="#FF3B30"
                    stroke="#ffffff"
                    strokeWidth="1.8"
                  />
                  {labelLayout.podBox && (
                    <g>
                      <rect
                        x={labelLayout.podBox.x}
                        y={labelLayout.podBox.y}
                        width={labelLayout.podBox.w}
                        height={labelLayout.podBox.h}
                        rx="4"
                        fill="rgba(24, 6, 8, 0.94)"
                        stroke="#FF3B30"
                        strokeWidth="1.1"
                      />
                      <text
                        x={labelLayout.podBox.x + labelLayout.podBox.w / 2}
                        y={labelLayout.podBox.y + 10.5}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="8"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        Science Pod
                      </text>
                    </g>
                  )}
                </g>
              );
            })()}

            {/* Site Markers (pins always clickable; labels strictly capped & collision-culled via labelLayout) */}
            {on.sites &&
              m.sites
                .filter((s) => s.lat != null && s.lon != null)
                .map((s) => {
                  const q = pos(s.lat as number, s.lon as number);
                  const isGoal = s.id === m.goalId;
                  const isSelected = s.id === placeCardSiteId;
                  const lbox = labelLayout.siteBoxes.get(s.id);

                  return (
                    <g
                      key={s.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectSite(s, q);
                      }}
                      className="cursor-pointer"
                    >
                      <ellipse cx={q.x} cy={q.y + 5} rx="9" ry="3.5" fill="rgba(0,0,0,0.5)" />
                      <line
                        x1={q.x}
                        y1={q.y}
                        x2={q.x}
                        y2={q.y - 12}
                        stroke={isGoal ? '#facc15' : '#f97316'}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                      <circle
                        cx={q.x}
                        cy={q.y - 12}
                        r={isJunior ? 10 : isSelected ? 10 : 8}
                        fill={isGoal ? '#facc15' : isSelected ? '#FF3B30' : '#E5484D'}
                        stroke="#ffffff"
                        strokeWidth="1.8"
                      />
                      {isGoal && (
                        <circle
                          cx={q.x}
                          cy={q.y - 12}
                          r="14"
                          fill="none"
                          stroke="#facc15"
                          strokeWidth="1.4"
                          opacity="0.75"
                        />
                      )}
                      {lbox && (
                        <g>
                          <rect
                            x={lbox.x}
                            y={lbox.y}
                            width={lbox.w}
                            height={lbox.h}
                            rx="4"
                            fill="rgba(16, 8, 10, 0.9)"
                            stroke={isGoal ? '#facc15' : isSelected ? '#FF3B30' : 'rgba(255,255,255,0.28)'}
                            strokeWidth="1"
                          />
                          <text
                            x={lbox.x + 6}
                            y={lbox.y + 10.5}
                            fill="#ffffff"
                            fontSize="8.5"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {s.name}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

            {/* Living Martian Crewmates (Compact first-name tags only; full task & greeting in Crew Rail) */}
            {liveCrew.map((crew) => {
              const q = pos(crew.lat, crew.lon);
              const cbox = labelLayout.crewBoxes.get(crew.id);
              return (
                <g
                  key={crew.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCrewId(crew.id);
                    flyToSvgPoint(q.x, q.y, Math.max(cam.zoom, 1.55));
                  }}
                  className="cursor-pointer select-none"
                >
                  <circle cx={q.x} cy={q.y} r="8.5" fill={crew.color} fillOpacity="0.22" />
                  <circle cx={q.x} cy={q.y} r="5.5" fill={crew.color} stroke="#ffffff" strokeWidth="1.6" />
                  {cbox && (
                    <g>
                      <rect
                        x={cbox.x}
                        y={cbox.y}
                        width={cbox.w}
                        height={cbox.h}
                        rx="4"
                        fill="rgba(8, 12, 22, 0.9)"
                        stroke={crew.color}
                        strokeOpacity="0.75"
                        strokeWidth="1"
                      />
                      <text
                        x={cbox.x + 5}
                        y={cbox.y + 10}
                        fill="#f8fafc"
                        fontSize="8"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {crew.firstName}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Walking Player Marker (Mars Red) */}
            {liveAstronaut && (
              <g className="pointer-events-none select-none">
                <circle
                  cx={liveAstronaut.x}
                  cy={liveAstronaut.y}
                  r="15"
                  fill="none"
                  stroke="#FF3B30"
                  strokeWidth="1.5"
                  opacity="0.8"
                >
                  <animate attributeName="r" values="8;19;8" dur="1.8s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0.1;0.9" dur="1.8s" repeatCount="indefinite" />
                </circle>
                <ellipse cx={liveAstronaut.x} cy={liveAstronaut.y + 4} rx="7.5" ry="3.2" fill="rgba(0,0,0,0.65)" />
                <circle cx={liveAstronaut.x} cy={liveAstronaut.y} r="7" fill="#E5484D" stroke="#ffffff" strokeWidth="2.5" />
                <text
                  x={liveAstronaut.x - 10}
                  y={liveAstronaut.y + 18}
                  textAnchor="end"
                  fill="#ff8a8e"
                  fontSize="9.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  stroke="#000"
                  strokeWidth="2.5"
                  paintOrder="stroke"
                >
                  {isJunior ? 'YOU & PERCY' : 'YOU'}
                </text>
              </g>
            )}

            {/* SuperCam Laser Zap Beam (Junior Mode) */}
            {laserBeam && (
              <g className="pointer-events-none">
                <line
                  x1={laserBeam.x1}
                  y1={laserBeam.y1}
                  x2={laserBeam.x2}
                  y2={laserBeam.y2}
                  stroke="#34d399"
                  strokeWidth="8"
                  strokeOpacity="0.45"
                  strokeLinecap="round"
                />
                <line
                  x1={laserBeam.x1}
                  y1={laserBeam.y1}
                  x2={laserBeam.x2}
                  y2={laserBeam.y2}
                  stroke="#a7f3d0"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx={laserBeam.x2} cy={laserBeam.y2} r="18" fill="#34d399" fillOpacity="0.55" />
              </g>
            )}
          </svg>

          {/* Subtle Dust Storm Haze (transparent center) */}
          {dustStormActive && (
            <div
              className="absolute inset-0 z-[5] pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(217,119,6,0.08) 40%, rgba(180,83,9,0.34) 100%)',
              }}
            />
          )}

          {/* Loading State while CTX image downloads */}
          {imgStatus === 'loading' && on.imagery && (
            <div className="absolute inset-0 z-[6] flex items-center justify-center bg-slate-900/60 font-mono text-xs text-rose-200 tracking-widest pointer-events-none">
              Loading the Mars map…
            </div>
          )}

          {/* E1 Guard: Visible Error Box on Imagery Failure OR 0x0 Container Collapse */}
          {(imgStatus === 'error' || boxCollapseError) && (
            <div className="absolute inset-0 z-[8] flex flex-col items-center justify-center p-6 text-center bg-red-950/85 border border-red-500/50 font-mono text-xs text-red-100 space-y-2">
              <TriangleAlert className="w-7 h-7 text-red-300" />
              <div className="font-bold text-sm">Could not load the Mars surface image</div>
              {boxCollapseError && <div className="text-amber-200">{boxCollapseError}</div>}
              <div className="text-[11px] text-red-200/80 break-all max-w-md">
                Failed URL: {imageryUrl || 'missing layer_urls.imagery'}
              </div>
            </div>
          )}

          {m.planning && (
            <div className="absolute inset-0 z-[7] bg-black/50 flex items-center justify-center font-mono text-xs text-[#ff8a8e] tracking-widest animate-pulse">
              PLANNING TRAVERSE…
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TOP FLOATING GOOGLE MAPS HEADER (Search + Layer Switcher + Top Actions)
      ───────────────────────────────────────────────────────────── */}
      <header
        data-map-ui="true"
        className="relative z-30 flex flex-wrap items-center justify-between gap-2.5 px-3 sm:px-5 pt-3 pointer-events-none"
      >
        {/* Left: Google Maps Style Search Bar */}
        <div className="relative pointer-events-auto w-full sm:w-80 md:w-96">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <Search className="w-4 h-4 text-[#E5484D] absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchDropdownOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchMessage(null);
                setSearchDropdownOpen(true);
              }}
              placeholder="Search a place on Mars..."
              aria-label="Search a place on Mars"
              className="w-full pl-10 pr-8 py-2.5 rounded-full bg-[#090d16]/88 border border-white/20 focus:border-[#E5484D] focus:outline-none text-xs sm:text-sm text-white placeholder-white/50 shadow-[0_8px_28px_rgba(0,0,0,0.55)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchMessage(null);
                  setSearchDropdownOpen(false);
                }}
                className="absolute right-3 text-white/60 hover:text-white text-sm"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </form>

          {/* Search Suggestions / Honest "No place with that name" Feedback */}
          {qNorm && searchDropdownOpen && (searchMessage || matchingSites.length >= 0) && (
            <div className="mt-1.5 rounded-2xl bg-[#090d16]/95 border border-white/15 shadow-2xl overflow-hidden max-h-60 overflow-y-auto" data-scrollable="true">
              {pondMatches && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery(RESEARCH_POND.name);
                    setSearchDropdownOpen(false);
                    setSearchMessage(null);
                    openResearchPondCard();
                  }}
                  className="w-full px-4 py-2.5 text-left hover:bg-white/10 flex items-center justify-between gap-2 border-b border-white/10 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate">Research Pond (Dry Lakebed)</div>
                    <div className="text-[11px] text-[#ff8a8e] truncate">Delta Front · 6 real rock spots · zero liquid water today</div>
                  </div>
                </button>
              )}
              {matchingSites.length > 0 ? (
                matchingSites.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectSearchSite(s)}
                    className="w-full px-4 py-2.5 text-left hover:bg-white/10 flex items-center justify-between gap-2 border-b border-white/5 last:border-0 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">{s.name}</div>
                      <div className="text-[11px] text-white/55 truncate">{s.goal}</div>
                    </div>
                    {s.lat == null && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-200 shrink-0">
                        Not plotted
                      </span>
                    )}
                  </button>
                ))
              ) : !pondMatches ? (
                <div className="px-4 py-3 text-xs font-mono text-amber-200">
                  No place with that name on this map.
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Center: Clean Mars Red Next-Stop Goal Chip */}
        <div className="hidden xl:flex flex-col items-center pointer-events-auto px-4 py-1.5 rounded-2xl border border-[#E5484D]/55 bg-[#0f0607]/85 shadow-lg">
          <div className="flex items-center gap-2 text-xs font-mono text-white">
            <Compass className="w-4 h-4 text-[#FF3B30]" />
            {isJunior && routeOverride ? (
              <span>
                Next: <b className="text-white">first stop</b> —{' '}
                <span className="text-[#FF3B30] font-bold">{Math.round(remainingDist)} m</span>
              </span>
            ) : (
              <span>
                Next: reach <b className="text-white">{currentGoalName}</b> —{' '}
                <span className="text-[#FF3B30] font-bold">{Math.round(remainingDist).toLocaleString()} m</span>
              </span>
            )}
          </div>
          {isJunior && fullGoalDistanceM != null && (
            <div className="text-[10px] font-mono text-white/60">
              {currentGoalName} is {Math.round(fullGoalDistanceM).toLocaleString()} m away
            </div>
          )}
        </div>

        {/* Right: 3-Choice Layer Toggle + Pod + Mode + 3D + Details */}
        <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
          {/* 3-Choice Google Maps Style Layer Pill */}
          <div
            className="flex items-center rounded-full bg-[#0f0607]/88 border border-white/20 p-1 shadow-lg"
            role="group"
            aria-label="Map layer mode"
          >
            {LAYER_PRESETS.map((lp) => (
              <button
                key={lp.id}
                type="button"
                onClick={() => {
                  hudSound.playClick();
                  applyLayerPreset(lp.id);
                }}
                aria-pressed={layerPreset === lp.id}
                className={`px-2.5 py-1 rounded-full text-[11px] font-mono transition ${
                  layerPreset === lp.id
                    ? 'bg-[#E5484D] text-white font-bold shadow-[0_0_12px_rgba(255,59,48,0.45)]'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                {lp.label}
              </button>
            ))}
          </div>

          {onOpenPod && (
            <button
              type="button"
              onClick={onOpenPod}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E5484D]/75 bg-[#E5484D]/25 hover:bg-[#FF3B30]/40 text-xs font-mono font-bold text-white transition active:scale-95"
            >
              <Home className="w-3.5 h-3.5 text-[#ff8a8e]" />
              <span>Science Pod</span>
            </button>
          )}

          {onToggleUiMode && (
            <button
              onClick={onToggleUiMode}
              title="Switch Grown-up / Junior Astronaut mode"
              className={`px-3 py-1.5 rounded-full border text-xs font-bold transition active:scale-95 ${
                isJunior
                  ? 'border-[#E5484D] bg-[#E5484D]/30 text-white'
                  : 'border-white/20 bg-[#0f0607]/85 text-white/85 hover:border-white/40'
              }`}
            >
              {isJunior ? 'Junior Mode' : 'Grown-up'}
            </button>
          )}

          {onOpenLab && !isJunior && (
            <button
              onClick={onOpenLab}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E5484D]/65 bg-[#1a080a]/85 text-[11px] font-mono text-[#ff8a8e] hover:bg-[#E5484D]/30 transition"
            >
              RESEARCH LAB
            </button>
          )}

          <button
            onClick={onStartEva}
            title="Switch to 3D View (M)"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E5484D]/75 bg-[#E5484D]/25 text-xs font-mono text-white hover:bg-[#FF3B30]/40 transition active:scale-95 ${
              isJunior ? 'min-h-[40px] font-bold' : ''
            }`}
          >
            <Eye className="w-4 h-4 text-[#ff8a8e]" />
            <span className="font-bold">3D VIEW</span>
          </button>

          <button
            onClick={() => setDetailsOpen(!detailsOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-mono transition active:scale-95 ${
              isJunior ? 'min-h-[40px]' : ''
            } ${
              detailsOpen
                ? 'border-violet-400 bg-violet-600/35 text-white'
                : 'border-white/20 bg-[#090d16]/85 text-slate-200 hover:border-white/40'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-violet-300" />
            <span>{isJunior ? 'Tools' : 'Details'}</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-full border border-white/20 bg-[#090d16]/85 hover:border-red-400 text-white/75 hover:text-white transition"
            aria-label="Close map (M)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Live Entry Zone Banner when astronaut stands inside The Research Pond (§11) — sits cleanly below header, never overlapping map center or header buttons */}
      {playerInPond && (
        <div className="relative z-30 flex justify-center px-3 mt-1.5 pointer-events-none">
          <div
            role="status"
            data-map-ui="true"
            className="pointer-events-auto flex flex-wrap items-center gap-3 px-4 py-1.5 rounded-full border border-[#FF3B30]/75 bg-[#190709]/95 shadow-lg"
          >
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-[#FF3B30]" />
              <span className="font-bold text-white">You are in the Research Pond</span>
              <span className="hidden sm:inline text-[10px] text-amber-200">
                · {isJunior ? RESEARCH_POND.juniorPercyLine : RESEARCH_POND.honestyTitle}
              </span>
            </div>
            {onOpenPond && (
              <button
                type="button"
                onClick={() => {
                  hudSound.playClick();
                  onOpenPond();
                }}
                className="px-3 py-1 rounded-full bg-[#E5484D] hover:bg-[#FF3B30] text-white text-[11px] font-mono font-bold transition"
              >
                Open Collect Spots
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          LEFT RAIL: Mission Card + Nearby Places (Collapsible)
      ───────────────────────────────────────────────────────────── */}
      {leftRailOpen ? (
        <aside
          data-map-ui="true"
          data-scrollable="true"
          className="fixed left-3 sm:left-4 top-20 bottom-24 z-20 w-64 max-w-[78vw] flex flex-col gap-2.5 pointer-events-auto overflow-y-auto pr-0.5"
        >
          {/* Current Leg / Next Goal Card */}
          <div className="rounded-2xl bg-[#0c0709]/92 border border-white/15 p-3.5 shadow-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#E5484D] font-bold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                {cleanTitle}
              </span>
              <button
                type="button"
                onClick={() => setLeftRailOpen(false)}
                className="p-1 rounded hover:bg-white/10 text-white/55 hover:text-white"
                aria-label="Collapse left panel"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm font-bold text-white leading-tight">
              {isJunior && routeOverride ? `First 300 m leg` : `Route to ${currentGoalName}`}
            </div>
            {game?.activeMission && (
              <p className="text-[11px] text-white/65 leading-snug">
                <b className="text-[#ff8a8e] font-mono uppercase">{game.activeMission.num}: {game.activeMission.title}</b> — {game.activeMission.briefingPlain}
              </p>
            )}
            {isJunior && fullGoalDistanceM != null && (
              <div className="text-[11px] font-mono text-white/60">
                {currentGoalName} is {Math.round(fullGoalDistanceM).toLocaleString()} m away
              </div>
            )}
            <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono pt-1">
              <div className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5">
                <div className="text-[9px] text-white/50">DISTANCE</div>
                <div className="font-bold text-white">{Math.round(ps.total).toLocaleString()} m</div>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5">
                <div className="text-[9px] text-white/50">AIR ON ARRIVAL</div>
                <div className="font-bold text-[#ff8a8e]">
                  {activeRoute?.safety?.oxygen?.remaining_on_arrival_pct != null
                    ? `${activeRoute.safety.oxygen.remaining_on_arrival_pct}%`
                    : '—'}
                </div>
              </div>
            </div>
            {onOpenPod && (
              <button
                type="button"
                onClick={() => {
                  if (nearPod) onOpenPod();
                  else {
                    m.setGoalId('octavia_butler_landing');
                    runPlan({ goalId: 'octavia_butler_landing' });
                  }
                }}
                className="w-full mt-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E5484D]/25 hover:bg-[#FF3B30]/40 border border-[#E5484D]/60 text-xs font-mono font-bold text-white transition"
              >
                <Home className="w-3.5 h-3.5 text-[#ff8a8e]" />
                <span>{nearPod ? 'Enter Science Pod' : 'Go to the Pod'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (playerInPond && onOpenPond) onOpenPond();
                else openResearchPondCard();
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1a080a]/90 hover:bg-[#E5484D]/30 border border-[#E5484D]/55 text-xs font-mono font-bold text-white transition"
            >
              <Pickaxe className="w-3.5 h-3.5 text-[#ff8a8e]" />
              <span>{playerInPond ? 'Research Pond (Open Spots)' : 'Research Pond (Dry Lakebed)'}</span>
            </button>
          </div>

          {/* Nearby Real Places */}
          <div className="rounded-2xl bg-[#090d16]/82 border border-white/15 p-3 shadow-xl space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-widest text-white/60 font-bold">
              Nearby places ({nearbyPlotted.length})
            </div>
            <ul className="space-y-1 max-h-52 overflow-y-auto pr-1">
              {nearbyPlotted.map(({ site: s, distM }) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => selectSite(s, pos(s.lat as number, s.lon as number))}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl border text-xs transition flex items-center justify-between gap-2 ${
                      s.id === placeCardSiteId || s.id === m.goalId
                        ? 'bg-[#E5484D]/25 border-[#E5484D]/75 text-white'
                        : 'bg-white/5 border-white/5 text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <span className="truncate font-medium">{s.name}</span>
                    <span className="text-[10px] font-mono text-[#ff8a8e] shrink-0">
                      {distM != null ? `${distM.toLocaleString()} m` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {isJunior && (
            <PercyCompanion
              message={percyJobForMission(game?.activeMission.id ?? 'm1_first_light', currentGoalName)}
              tips={[
                'Tap any pin to see real rover photos and zap the rock!',
                'Press Walk below or Spacebar to walk a 300 m step with me!',
              ]}
            />
          )}
        </aside>
      ) : (
        <button
          data-map-ui="true"
          type="button"
          onClick={() => setLeftRailOpen(true)}
          className="fixed left-3 top-20 z-20 px-3 py-2 rounded-full bg-[#090d16]/85 border border-white/20 text-xs font-mono text-white shadow-lg flex items-center gap-1 hover:bg-white/10"
        >
          <ChevronRight className="w-3.5 h-3.5 text-[#E5484D]" />
          <span>Places</span>
        </button>
      )}

      {/* ─────────────────────────────────────────────────────────────
          RIGHT TRANSLUCENT RAIL: Living Crewmates + Air/Suit Strip + Junior Buttons
      ───────────────────────────────────────────────────────────── */}
      {rightRailOpen ? (
        <aside
          data-map-ui="true"
          data-scrollable="true"
          className="fixed right-3 sm:right-4 top-20 bottom-28 z-20 w-64 max-w-[78vw] flex flex-col gap-2.5 pointer-events-auto overflow-y-auto pl-0.5"
        >
          {/* Living Crewmates Status Panel */}
          <div className="rounded-2xl bg-[#090d16]/82 border border-white/15 p-3.5 shadow-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-300 font-bold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Crew on site ({liveCrew.length})
              </span>
              <button
                type="button"
                onClick={() => setRightRailOpen(false)}
                className="p-1 rounded hover:bg-white/10 text-white/55 hover:text-white"
                aria-label="Collapse right panel"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <ul className="space-y-1.5">
              {liveCrew.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      const q = pos(c.lat, c.lon);
                      setSelectedCrewId(c.id);
                      flyToSvgPoint(q.x, q.y, 1.7);
                    }}
                    className="w-full text-left rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 p-2 transition space-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-1.5 text-xs">
                      <span className="font-bold text-white flex items-center gap-1.5 truncate">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        {c.label}
                      </span>
                      {c.distToPlayerM != null && (
                        <span className="text-[10px] font-mono text-[#ff8a8e] shrink-0">{c.distToPlayerM} m</span>
                      )}
                    </div>
                    <div className="text-[11px] text-white/65 truncate">{c.task}</div>
                    {c.nearPlayer && (
                      <div className="text-[10px] text-amber-200 italic truncate">&ldquo;{c.greeting}&rdquo;</div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Air & Terrain Safety Strip */}
          <div className="rounded-2xl bg-[#090d16]/82 border border-white/15 p-3 shadow-xl space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-[11px]">Air left</span>
              <span className={(arrivalO2Pct ?? 100) < 30 ? 'text-[#FF3B30] font-black' : 'text-white font-bold'}>
                {arrivalO2Pct != null ? `${Math.round(arrivalO2Pct)}%` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-[11px]">{isJunior ? 'Ground' : 'Safety'}</span>
              <span
                className={
                  hzInfo.level === 'HIGH'
                    ? 'text-[#FF3B30] font-bold'
                    : hzInfo.level === 'CAUTION'
                    ? 'text-amber-300 font-bold'
                    : 'text-emerald-300 font-bold'
                }
              >
                {isJunior
                  ? hzInfo.level === 'HIGH'
                    ? 'TOO STEEP'
                    : hzInfo.level === 'CAUTION'
                    ? 'BUMPY'
                    : 'SMOOTH'
                  : hzInfo.level}
              </span>
            </div>
          </div>

          {/* Junior Quick Tools tucked cleanly into Right Rail */}
          {isJunior && (
            <div className="rounded-2xl bg-[#090d16]/82 border border-white/15 p-2.5 shadow-xl flex flex-col gap-1.5">
              {onOpenBackpack && (
                <button
                  onClick={onOpenBackpack}
                  className="flex items-center gap-2 min-h-[42px] px-3 py-1.5 rounded-xl bg-amber-950/75 border border-amber-400/50 text-amber-100 font-bold text-xs"
                >
                  <Backpack className="w-4 h-4 text-amber-300" />
                  Backpack ({game?.progress.inventory.length ?? 0})
                </button>
              )}
              {onOpenDetectiveCase && (
                <button
                  onClick={onOpenDetectiveCase}
                  className="flex items-center gap-2 min-h-[42px] px-3 py-1.5 rounded-xl bg-violet-950/75 border border-violet-400/50 text-violet-100 font-bold text-xs"
                >
                  <Search className="w-4 h-4 text-violet-300" />
                  Detective Case
                </button>
              )}
              {onOpenPhotoMode && (
                <button
                  onClick={onOpenPhotoMode}
                  className="flex items-center gap-2 min-h-[42px] px-3 py-1.5 rounded-xl bg-blue-950/80 border border-blue-400/50 text-blue-100 font-bold text-xs"
                >
                  <Camera className="w-4 h-4 text-blue-300" />
                  Photo
                </button>
              )}
            </div>
          )}
        </aside>
      ) : (
        <button
          data-map-ui="true"
          type="button"
          onClick={() => setRightRailOpen(true)}
          className="fixed right-3 top-20 z-20 px-3 py-2 rounded-full bg-[#090d16]/85 border border-white/20 text-xs font-mono text-white shadow-lg flex items-center gap-1 hover:bg-white/10"
        >
          <Users className="w-3.5 h-3.5 text-amber-300" />
          <span>Crew</span>
        </button>
      )}

      {/* ─────────────────────────────────────────────────────────────
          BOTTOM-LEFT: REAL ZOOM-ADJUSTED SCALE BAR + MAP CENTER COORDS
      ───────────────────────────────────────────────────────────── */}
      <div
        data-map-ui="true"
        className="fixed left-3 sm:left-4 bottom-20 z-20 flex flex-wrap items-center gap-2.5 text-[10px] font-mono text-white bg-[#090d16]/85 rounded-xl px-3 py-1.5 border border-white/15 pointer-events-none"
      >
        <span className="inline-block h-[3px] bg-white rounded-full" style={{ width: `${scaleBarWidthPx}px` }} />
        <span>{scaleBarLabel} · north ↑</span>
        <span className="text-white/40">|</span>
        <span className="text-[#ff8a8e]">
          {fmtLat(mapCenterLatLon.lat)} {fmtLon(mapCenterLatLon.lon)}
        </span>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          BOTTOM-RIGHT: GOOGLE MAPS + / - ZOOM + RECENTER CONTROLS
      ───────────────────────────────────────────────────────────── */}
      <div
        data-map-ui="true"
        className="fixed right-3 sm:right-4 bottom-20 z-20 flex flex-col items-end gap-1.5 pointer-events-auto"
      >
        {cam.zoom >= MAX_ZOOM - 0.05 && (
          <div className="px-2.5 py-1 rounded-lg bg-amber-950/90 border border-amber-400/50 text-[10px] font-mono text-amber-100 shadow-lg">
            Sharpest real photo we have
          </div>
        )}
        <button
          type="button"
          onClick={handleRecenter}
          title="Recenter on explorer"
          aria-label="Recenter map"
          className="w-9 h-9 rounded-full bg-[#090d16]/90 border border-white/20 hover:border-[#FF3B30] flex items-center justify-center text-[#E5484D] shadow-lg transition"
        >
          <LocateFixed className="w-4 h-4" />
        </button>
        <div className="flex flex-col rounded-xl overflow-hidden bg-[#090d16]/90 border border-white/20 shadow-lg">
          <button
            type="button"
            onClick={() => adjustZoom(0.35)}
            disabled={cam.zoom >= MAX_ZOOM - 0.01}
            aria-label="Zoom in"
            className="w-9 h-8 flex items-center justify-center hover:bg-white/10 text-white disabled:opacity-35 transition border-b border-white/10"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => adjustZoom(-0.35)}
            disabled={cam.zoom <= MIN_ZOOM + 0.01}
            aria-label="Zoom out"
            className="w-9 h-8 flex items-center justify-center hover:bg-white/10 text-white disabled:opacity-35 transition"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SCIENCE POD BOTTOM-SHEET PLACE CARD (TAP POD PIN)
      ───────────────────────────────────────────────────────────── */}
      {podCardOpen && !placeCardSite && (
        <div
          data-map-ui="true"
          className="fixed left-1/2 -translate-x-1/2 bottom-20 z-30 w-[94vw] max-w-lg rounded-2xl bg-[#100608]/95 border border-[#E5484D]/65 p-4 shadow-[0_15px_50px_rgba(0,0,0,0.85)]"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">Science Pod — Jezero Base</h3>
              <p className="text-xs text-white/80 mt-1">
                Home base at Octavia E. Butler Landing Site (18.4446°N, 77.4509°E) with 6 stations: Sample Lab, Biosignature Bench, Weather, Oxygen Plant, Map Table &amp; Collection Wall.
              </p>
              <p className="text-[11px] font-mono text-amber-200 mt-1">
                The pod is our game base — the science inside is real NASA data.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPodCardOpen(false)}
              className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 shrink-0"
              aria-label="Close science pod card"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-3">
            {onOpenPod && nearPod && (
              <button
                type="button"
                onClick={() => {
                  setPodCardOpen(false);
                  onOpenPod();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#E5484D] hover:bg-[#FF3B30] text-white font-mono text-xs font-bold transition"
              >
                <Home className="w-3.5 h-3.5" />
                Enter Science Pod
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                hudSound.playTargetLock();
                m.setGoalId('octavia_butler_landing');
                runPlan({ goalId: 'octavia_butler_landing' });
                setPodCardOpen(false);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-[#E5484D]/65 bg-[#E5484D]/20 hover:bg-[#FF3B30]/35 text-white font-mono text-xs font-bold transition"
            >
              <Navigation className="w-3.5 h-3.5" />
              Go to the Pod
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          RESEARCH POND BOTTOM-SHEET CARD (DRY LAKEBED AT DELTA FRONT)
      ───────────────────────────────────────────────────────────── */}
      {pondCardOpen && !placeCardSite && !podCardOpen && (
        <div
          data-map-ui="true"
          className="fixed left-1/2 -translate-x-1/2 bottom-20 z-30 w-[94vw] max-w-lg rounded-2xl bg-[#100608]/95 border border-[#E5484D]/65 p-4 shadow-[0_15px_50px_rgba(0,0,0,0.85)]"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                {isJunior ? 'Old Lakebed Pond — Research Pond' : 'Research Pond — Dry Ancient Lakebed'}
              </h3>
              <p className="text-xs text-white/80 mt-1">
                {isJunior ? RESEARCH_POND.juniorPercyLine : RESEARCH_POND.honestyDetail}
              </p>
              {liveCrew.some((c) => c.inPond) && (
                <p className="text-[11px] font-mono text-[#ff9b9e] mt-1">
                  Active crew here: {liveCrew.filter((c) => c.inPond).map((c) => c.label).join(' · ')}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPondCardOpen(false)}
              className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 shrink-0"
              aria-label="Close research pond card"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-3">
            {onOpenPond && playerInPond ? (
              <button
                type="button"
                onClick={() => {
                  setPondCardOpen(false);
                  onOpenPond();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#E5484D] hover:bg-[#FF3B30] text-white font-mono text-xs font-bold transition"
              >
                <Pickaxe className="w-3.5 h-3.5" />
                Open Collect Spots ({POND_SPOTS.length})
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    hudSound.playTargetLock();
                    m.setGoalId(RESEARCH_POND.anchorSiteId);
                    runPlan({ goalId: RESEARCH_POND.anchorSiteId });
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#E5484D] hover:bg-[#FF3B30] text-white font-mono text-xs font-bold transition"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Route to Research Pond
                </button>
                {m.goalId === RESEARCH_POND.anchorSiteId && onArriveAtGoal && (
                  <button
                    type="button"
                    onClick={() => {
                      onArriveAtGoal();
                      setPondCardOpen(false);
                      onOpenPond?.();
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-[#E5484D]/75 bg-[#FF3B30]/20 hover:bg-[#FF3B30]/40 text-white font-mono text-xs font-bold transition"
                  >
                    <FastForward className="w-3.5 h-3.5 text-[#ff8a8e]" />
                    Enter Research Pond (Arrive)
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          GOOGLE MAPS COMPACT BOTTOM-SHEET PLACE CARD (ON PIN TAP)
      ───────────────────────────────────────────────────────────── */}
      {placeCardSite && (
        <div
          data-map-ui="true"
          className="fixed left-1/2 -translate-x-1/2 bottom-20 z-30 w-[94vw] max-w-lg rounded-2xl bg-[#100608]/95 border border-[#E5484D]/55 p-4 shadow-[0_15px_50px_rgba(0,0,0,0.85)]"
        >
          <div className="flex items-start gap-3">
            {placeCardSite.pov_images?.[0] && (
              <div className="w-24 h-24 rounded-xl overflow-hidden border border-white/15 shrink-0 bg-black">
                <img
                  src={placeCardSite.pov_images[0].url}
                  alt={placeCardSite.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white leading-tight">
                  {placeCardSite.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setPlaceCardSiteId(null)}
                  className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 shrink-0"
                  aria-label="Close place card"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-white/80 leading-snug">
                {realSiteById(placeCardSite.id)?.plain ?? placeCardSite.description}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[#ff8a8e] pt-0.5">
                {placeCardDistM != null ? (
                  <span>{placeCardDistM.toLocaleString()} m from current spot</span>
                ) : (
                  <span className="text-amber-300">Location not published</span>
                )}
                {placeCardSite.pov_images?.[0] && (
                  <span className="text-white/45">
                    · {placeCardSite.pov_images[0].rover} Sol {placeCardSite.pov_images[0].sol}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {placeCardSite.lat != null && placeCardSite.lon != null && (
                  <button
                    type="button"
                    onClick={() => {
                      hudSound.playTargetLock();
                      m.setGoalId(placeCardSite.id);
                      runPlan({ goalId: placeCardSite.id });
                      setPlaceCardSiteId(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#E5484D] hover:bg-[#FF3B30] text-white font-mono text-xs font-bold transition active:scale-95"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Navigate here
                  </button>
                )}
                {isJunior && onZapSite && (
                  <button
                    type="button"
                    onClick={() => {
                      if (placeCardSite.lat != null && placeCardSite.lon != null) {
                        fireZapAtSite(placeCardSite, pos(placeCardSite.lat, placeCardSite.lon));
                      } else {
                        onZapSite(placeCardSite);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono text-xs font-bold transition"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Zap Rock
                  </button>
                )}
                <ExplainButton term="oxygen on arrival" juniorMode={isJunior} placement="up" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard fade hint */}
      <div
        className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-10 pointer-events-none transition-opacity duration-1000 font-mono text-[10px] text-white/75 bg-black/75 border border-white/10 px-3 py-1 rounded-full ${
          showKeysHint ? 'opacity-100' : 'opacity-0'
        }`}
      >
        WASD / Drag = Pan · +/- or Wheel = Zoom · Space = Walk · M = 3D · Esc = Menu
      </div>

      {/* ─────────────────────────────────────────────────────────────
          BOTTOM FLOATING CONTROLS & DIRECTIONS BAR
      ───────────────────────────────────────────────────────────── */}
      <footer
        data-map-ui="true"
        className="fixed bottom-3 inset-x-3 sm:inset-x-5 z-30 flex flex-wrap items-center justify-between gap-2 px-4 py-2 rounded-2xl border border-white/15 bg-[#090d16]/90 shadow-2xl"
      >
        {/* Left: Compact Air + Follow */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl border border-white/15 bg-white/5 text-xs font-mono">
            <span className="text-white/60 text-[11px]">Air:</span>
            <span
              className={`font-bold ${
                (arrivalO2Pct ?? 100) < 30 ? 'text-red-400 font-black' : 'text-emerald-300'
              }`}
            >
              {arrivalO2Pct != null ? `${Math.round(arrivalO2Pct)}%` : '—'}
            </span>
          </div>

          <button
            onClick={() => setFollowAstronaut(!followAstronaut)}
            title="Follow Camera (F)"
            className={`hidden md:flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-mono transition ${
              followAstronaut
                ? 'border-[#E5484D] bg-[#E5484D]/25 text-white'
                : 'border-white/15 bg-white/5 text-white/65 hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Follow {followAstronaut ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Center: Primary Mars Red Walk / Pause + Skip Walk (Junior Mode) */}
        <div className="flex items-center gap-2.5">
          {activeRoute && (
            <button
              onClick={onToggleWalking}
              className={`flex items-center gap-2 px-5 py-2 rounded-full font-mono text-xs sm:text-sm font-bold tracking-wider transition active:scale-95 shadow-lg ${
                isJunior ? 'min-h-[42px]' : ''
              } ${
                isWalking
                  ? 'border border-amber-400/75 bg-amber-500/30 text-amber-100 hover:bg-amber-500/45'
                  : 'bg-[#E5484D] hover:bg-[#FF3B30] text-white shadow-[0_0_20px_rgba(255,59,48,0.45)]'
              }`}
            >
              {isWalking ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>
                {isWalking ? 'PAUSE' : isJunior ? 'WALK WITH PERCY' : 'WALK THE ROUTE'}
              </span>
            </button>
          )}

          {isJunior && onSkipWalk && activeRoute && walkDistance < ps.total - 1 && (
            <button
              type="button"
              onClick={onSkipWalk}
              className="flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-full border border-[#E5484D]/70 bg-[#1a080a]/85 hover:bg-[#FF3B30]/35 text-white font-mono text-xs font-bold transition"
            >
              <FastForward className="w-3.5 h-3.5 text-[#ff8a8e]" />
              <span>Skip walk</span>
            </button>
          )}

          <div className="hidden lg:flex flex-col text-[10px] font-mono text-white/70">
            <span>
              <b className="text-white">{Math.round(walkDistance)}</b> / {Math.round(ps.total)} m
            </span>
            <div className="w-28 h-1.5 bg-black/70 rounded-full overflow-hidden mt-0.5">
              <div
                className="h-full bg-[#FF3B30] transition-all duration-150"
                style={{ width: `${Math.min(100, (walkDistance / Math.max(1, ps.total)) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: Directions Cards with real Distance, Walk Time & O2 */}
        <div className="flex items-center gap-1.5">
          {m.resp?.routes?.map((r) => {
            const idx = m.foundRoutes.findIndex((x) => x.strategy === r.strategy);
            const sel = idx === m.routeIdx && r.found;
            const meta_ = STRATEGY[r.strategy];
            const distLabel = r.found && r.distance_m != null ? `${Math.round(r.distance_m)}m` : null;
            const timeLabel = r.found && r.walk_time_min != null ? `${Math.round(r.walk_time_min)} min` : null;
            const o2Label = r.found && r.safety?.oxygen?.remaining_on_arrival_pct != null ? `${r.safety.oxygen.remaining_on_arrival_pct}% O₂` : null;
            return (
              <button
                key={r.strategy}
                disabled={!r.found}
                onClick={() => m.setRouteIdx(idx)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-mono border transition text-left ${
                  sel
                    ? 'border-[#FF3B30] bg-[#E5484D]/25 text-white font-bold shadow-[0_0_12px_rgba(255,59,48,0.28)]'
                    : 'border-white/10 bg-white/5 text-white/65 hover:text-white'
                } ${!r.found ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div>{isJunior ? meta_.juniorLabel : meta_.label}</div>
                {distLabel && !routeOverride && (
                  <div className="text-[9px] text-white/70 font-normal">
                    {distLabel} · {timeLabel} · {o2Label}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </footer>

      {/* ─────────────────────────────────────────────────────────────
          DETAILS DRAWER (Level 3 behind ONE button)
      ───────────────────────────────────────────────────────────── */}
      {detailsOpen && (
        <aside
          data-map-ui="true"
          data-scrollable="true"
          className="fixed inset-y-0 right-0 z-40 w-96 max-w-[92vw] flex flex-col bg-[#08060f]/95 border-l border-white/15 p-5 overflow-y-auto space-y-4 shadow-[0_0_60px_rgba(0,0,0,0.8)]"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="font-mono text-xs font-bold tracking-widest text-white uppercase flex items-center gap-2">
              <Sliders className="w-4 h-4 text-violet-300" />
              <span>{isJunior ? 'EXPLORER TOOLS' : 'SCIENCE & DATA DETAILS'}</span>
            </div>
            <button
              onClick={() => setDetailsOpen(false)}
              className="p-1 rounded-full border border-white/15 hover:border-white text-white/60 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-1">
            {(
              [
                ['route', 'Route', RouteIcon],
                ['site', 'Site', MapPin],
                ['safety', 'Safety', ShieldAlert],
                ['data', 'Data', Database],
                ['missions', 'Missions', Trophy],
              ] as const
            ).map(([k, label, Icon]) => (
              <button
                key={k}
                onClick={() => setTab(k as Tab)}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[11px] font-mono border ${
                  tab === k ? 'border-[#FF3B30] bg-[#E5484D]/25 text-white' : 'border-white/10 text-white/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {tab === 'missions' && game && <MissionPanel game={game} />}

          {tab === 'route' && (
            <div className="space-y-4">
              {onToggleDustStorm && (
                <button
                  onClick={onToggleDustStorm}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-mono transition ${
                    dustStormActive
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                      : 'border-white/15 bg-slate-900/50 text-white/80'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Wind className="w-4 h-4 text-amber-300" />
                    Mars Dust Gust Event
                  </span>
                  <span>{dustStormActive ? 'ACTIVE' : 'CALM'}</span>
                </button>
              )}

              {!isJunior && (
                <section className="space-y-3 rounded-xl border border-white/10 bg-slate-900/40 p-3">
                  <h3 className="font-mono text-[11px] tracking-widest text-white/50 flex items-center justify-between">
                    TRAVERSE LIMITS <span className="text-amber-300 text-[9px]">ASSUMPTIONS</span>
                  </h3>
                  <Slider label="Steep slope limit" k="max_slope_deg" min={5} max={45} step={1} unit="°" />
                  <Slider label="Caution slope" k="caution_slope_deg" min={2} max={40} step={1} unit="°" />
                  <Slider label="Walking speed" k="walk_speed_ms" min={0.3} max={2} step={0.1} unit="m/s" />
                  <Slider label="Cargo load factor" k="load_factor" min={1} max={2.5} step={0.1} unit="×" />
                  <p className="text-[10px] text-white/40 leading-relaxed">
                    These thresholds are team assumptions, disclosed per NASA brief rules.
                  </p>
                </section>
              )}

              <section className="space-y-2 rounded-xl border border-white/10 bg-slate-900/40 p-3">
                <h3 className="font-mono text-[11px] tracking-widest text-white/50">PLANNING</h3>
                <div className="text-[11px] font-mono text-white/60">
                  Start: {m.start ? `${fmtLat(m.start.lat)} ${fmtLon(m.start.lon)}` : '—'}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMode(mode === 'start' ? 'inspect' : 'start')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border text-[11px] font-mono ${
                      mode === 'start' ? 'border-[#FF3B30] bg-[#E5484D]/20' : 'border-white/15'
                    }`}
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    Pick start
                  </button>
                  <button
                    onClick={() => setMode(mode === 'obstacle' ? 'inspect' : 'obstacle')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border text-[11px] font-mono ${
                      mode === 'obstacle' ? 'border-red-400 bg-red-500/20' : 'border-white/15'
                    }`}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Add obstacle
                  </button>
                </div>
                {mode === 'obstacle' && (
                  <label className="block mt-2">
                    <div className="text-[10px] font-mono text-white/60">
                      Obstacle radius: {obsRadius} m — click the map to place
                    </div>
                    <input
                      type="range"
                      min={30}
                      max={800}
                      step={10}
                      value={obsRadius}
                      onChange={(e) => setObsRadius(Number(e.target.value))}
                      className="w-full accent-red-400"
                    />
                  </label>
                )}
                {m.obstacles.length > 0 && (
                  <ul className="space-y-1 mt-2">
                    {m.obstacles.map((o, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between text-[11px] font-mono bg-red-950/30 border border-red-500/20 rounded px-2 py-1"
                      >
                        <span>
                          Obstacle {i + 1} · {o.radius_m} m
                        </span>
                        <button onClick={() => removeObstacle(i)} aria-label="Remove obstacle">
                          <Trash2 className="w-3.5 h-3.5 text-red-300" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <label className="block text-[10px] font-mono text-white/60 mt-2">
                  Destination — sites with published coordinates only
                  <select
                    value={m.goalId ?? ''}
                    onChange={(e) => {
                      m.setGoalId(e.target.value);
                      runPlan({ goalId: e.target.value });
                    }}
                    className="mt-1 w-full bg-slate-900 border border-white/15 rounded px-2 py-1.5 text-xs text-white"
                  >
                    {m.sites
                      .filter((s) => s.lat != null && s.lon != null)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </label>
              </section>

              {m.route?.explanation && !isJunior && (
                <button
                  onClick={() => setAnalysisOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-violet-500/20 border border-violet-400/50 text-xs font-mono font-bold hover:bg-violet-500/35 transition"
                >
                  <ClipboardList className="w-4 h-4 text-violet-300" />
                  ROUTE ANALYSIS (5 NASA Questions)
                </button>
              )}

              <section className="space-y-2 rounded-xl border border-white/10 bg-slate-900/40 p-3">
                <h3 className="font-mono text-[11px] tracking-widest text-white/50">DATA LAYERS</h3>
                <ul className="space-y-1.5">
                  {LAYER_ROWS.map((l) => {
                    const have = !!meta.layer_urls[l.key];
                    const p = prov(l.kind);
                    return (
                      <li
                        key={l.key}
                        className={`rounded border px-2.5 py-1.5 ${
                          have ? 'border-white/10 bg-slate-900/50' : 'border-red-500/30 bg-red-950/20'
                        }`}
                      >
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={!have}
                            checked={have && on[l.key]}
                            onChange={(e) => setOn({ ...on, [l.key]: e.target.checked })}
                            className="accent-[#E5484D]"
                          />
                          <span className="flex-1">{isJunior ? l.juniorLabel : l.label}</span>
                          {have && p ? <Badge n={p.nature} /> : <span className="text-[9px] font-mono text-red-300">MISSING</span>}
                        </label>
                      </li>
                    );
                  })}
                  {[
                    ['geology', 'Geological features'],
                    ['sites', 'Science sites'],
                    ['route', 'Routes'],
                  ].map(([k, label]) => (
                    <li key={k} className="rounded border border-white/10 bg-slate-900/50 px-2.5 py-1.5">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={on[k]}
                          onChange={(e) => setOn({ ...on, [k]: e.target.checked })}
                          className="accent-[#E5484D]"
                        />
                        <span>{label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}

          {tab === 'site' &&
            (site ? (
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-bold text-white">{site.name}</div>
                  <div className="text-[11px] text-orange-300">{site.goal}</div>
                </div>
                {(() => {
                  const real = realSiteById(site.id);
                  return real ? <p className="text-xs text-white/80 leading-relaxed">{real.plain}</p> : null;
                })()}
                <p className="text-xs text-white/75 leading-relaxed">{site.description}</p>
                {site.id === 'cheyava_falls' && (
                  <p className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-400/30 rounded p-2">
                    Cheyava Falls: {CHEYAVA.sizeM} m rock, sol {CHEYAVA.sol}. Sapphire Canyon core sol{' '}
                    {CHEYAVA.sapphireCanyonSol}, {CHEYAVA.sapphireCanyonCm} cm. {CHEYAVA.status} — {CHEYAVA.statusPlain}
                  </p>
                )}
                <div className="text-[11px]">
                  <span className="text-white/45">Chemistry: </span>
                  {site.chemistry ?? realSiteById(site.id)?.chemistry ?? <span className="font-mono text-red-300">MISSING</span>}
                </div>
                {site.lat != null && site.lon != null ? (
                  <button
                    onClick={() => {
                      m.setGoalId(site.id);
                      runPlan({ goalId: site.id });
                      setTab('route');
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#E5484D]/25 hover:bg-[#FF3B30]/40 border border-[#E5484D]/70 text-xs font-mono font-bold text-white"
                  >
                    ROUTE TO THIS SITE
                  </button>
                ) : (
                  <p className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-400/30 rounded p-2">
                    No route can be planned to this site — its location is not published. Read its record here instead.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-white/50">Click an orange marker on the map to inspect science data.</div>
              </div>
            ))}

          {tab === 'safety' && (
            <SafetyContextPanel
              oxygen={activeRoute?.safety?.oxygen}
              radiation={activeRoute?.safety?.radiation}
              weather={m.spaceWeather}
              suit={meta.suit_assumptions}
            />
          )}

          {tab === 'data' && (
            <div className="space-y-3">
              <p className="text-[11px] text-white/60 leading-relaxed">
                Every layer discloses its origin, resolution, and sensor heritage per NASA Space Apps honesty directives.
              </p>
              {meta.layers.map((l, i) => (
                <div key={i} className="rounded-xl border border-white/10 p-2.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold">{l.name}</span>
                    <Badge n={l.nature} />
                  </div>
                  <div className="text-[11px] font-mono text-white/60">
                    {l.mission} · {l.instrument}
                  </div>
                  <div className="text-[11px] text-amber-200/90">Limit: {l.limitation}</div>
                </div>
              ))}
            </div>
          )}
        </aside>
      )}

      {analysisOpen && m.route?.explanation && (
        <RouteAnalysisWindow
          route={m.route}
          strategyLabel={STRATEGY[m.route.strategy].label}
          insights={m.resp?.insights ?? []}
          onClose={() => setAnalysisOpen(false)}
        />
      )}
    </div>
  );
};
