'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GoogleEarthViewMode, TimeOfSol, VisorTint } from '../types';
import { CREW_ROSTER } from '../lib/crew';
import { offsetM } from '../lib/geo';
import type { DemGrid } from '../lib/missionTypes';

interface Mars3dSurfaceProps {
  isWalking: boolean;
  walkDistance: number;
  stepPhase: number;
  pitchOffset: number;
  panOffset: number;
  headingDeg: number;
  visorTint: VisorTint;
  viewMode: GoogleEarthViewMode;
  timeOfSol: TimeOfSol;
  showTopoGrid: boolean;
  isTourPlaying: boolean;
  dustDevilsActive: boolean;
  onAltitudeChange?: (alt: number) => void;
  zoomLevel: number;
  inPond?: boolean;
  demGrid?: DemGrid | null;
  playerLat?: number | null;
  playerLon?: number | null;
  paused?: boolean;
}

interface SquadAstronautRig {
  id: string;
  group: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  offsetLateral: number;
  offsetAhead: number;
  phaseOffset: number;
}

const LANDING_LAT = 18.4446;
const LANDING_LON = 77.4509;
const LANDING_DATUM_M = -2569;

/** Deterministic pseudo-noise micro-relief (0.45 m pebbles/undulations so close ground never reads flat). */
function microRelief(x: number, z: number): number {
  return (
    Math.sin(x * 0.085 + z * 0.062) * 0.42 +
    Math.cos(x * 0.21 - z * 0.17) * 0.22 +
    Math.sin(x * 0.53 + z * 0.47) * 0.08
  );
}

/** Synchronous procedural Mars gravel/regolith texture (0 ms load, works offline & on CPU laptops). */
function createRegolithTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#a44d2a';
    ctx.fillRect(0, 0, size, size);

    // Deterministic seeded blotches, wind ripples, and pebbles (so terrain reads sharply at 1 m–200 m)
    let seed = 1337;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let y = 0; y < size; y += 6) {
      ctx.fillStyle = y % 12 === 0 ? 'rgba(65, 22, 10, 0.14)' : 'rgba(225, 138, 92, 0.12)';
      ctx.fillRect(0, y, size, 3);
    }

    for (let i = 0; i < 2200; i++) {
      const px = rnd() * size;
      const py = rnd() * size;
      const r = 0.5 + rnd() * 1.4;
      const dark = rnd() > 0.44;
      ctx.fillStyle = dark
        ? `rgba(${56 + Math.floor(rnd() * 24)}, ${24 + Math.floor(rnd() * 12)}, 12, ${0.14 + rnd() * 0.16})`
        : `rgba(${198 + Math.floor(rnd() * 32)}, ${124 + Math.floor(rnd() * 24)}, 84, ${0.14 + rnd() * 0.16})`;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(28, 28);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Synchronous Martian dusty sky dome gradient texture (warm horizon -> darker sky zenith). */
function createMarsSkyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, '#2a120d');
    grad.addColorStop(0.45, '#7e3b25');
    grad.addColorStop(0.78, '#c7754f');
    grad.addColorStop(0.95, '#e19a74');
    grad.addColorStop(1.0, '#c6734d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const Mars3dSurface: React.FC<Mars3dSurfaceProps> = ({
  isWalking,
  walkDistance,
  stepPhase,
  pitchOffset,
  panOffset,
  headingDeg,
  visorTint,
  viewMode,
  timeOfSol,
  showTopoGrid,
  isTourPlaying,
  dustDevilsActive,
  onAltitudeChange,
  zoomLevel,
  inPond = false,
  demGrid = null,
  playerLat = null,
  playerLon = null,
  paused = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const startLoopRef = useRef<(() => void) | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  const stateRef = useRef({
    isWalking,
    walkDistance,
    stepPhase,
    pitchOffset,
    panOffset,
    headingDeg,
    visorTint,
    viewMode,
    timeOfSol,
    showTopoGrid,
    isTourPlaying,
    dustDevilsActive,
    zoomLevel,
    inPond,
    playerLat,
    playerLon,
    paused,
  });

  stateRef.current = {
    isWalking,
    walkDistance,
    stepPhase,
    pitchOffset,
    panOffset,
    headingDeg,
    visorTint,
    viewMode,
    timeOfSol,
    showTopoGrid,
    isTourPlaying,
    dustDevilsActive,
    zoomLevel,
    inPond,
    playerLat,
    playerLon,
    paused,
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    setWebglError(null);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xc97b56);
    scene.fog = new THREE.FogExp2(0xd2855f, 0.00016);

    const camera = new THREE.PerspectiveCamera(
      56,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.2,
      14000
    );

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: 'high-performance',
        alpha: false,
        preserveDrawingBuffer: true,
      });
    } catch {
      setWebglError('WebGL is unavailable on this browser.');
      return;
    }

    // Detect CPU-only / software WebGL (SwiftShader / llvmpipe) to keep laptop FPS smooth
    let isSoftwareGl = false;
    try {
      const gl = renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const rName = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
      isSoftwareGl = /swiftshader|llvmpipe|microsoft basic/i.test(rName);
    } catch {}

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('3D graphics context paused on low memory.');
    };
    const handleContextRestored = () => {
      setWebglError(null);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    // Sun + warm Martian hemisphere bounce light (no expensive shadow map pass)
    const sunLight = new THREE.DirectionalLight(0xffe6cc, 2.8);
    sunLight.position.set(-180, 140, -120);
    scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0xb86642, 0.95);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xf3ae85, 0x5c2311, 0.85);
    scene.add(hemiLight);

    // Sky Dome (follows camera XZ cleanly so horizon & sky stay visible at any crater coordinate)
    const skyTex = createMarsSkyTexture();
    const skyDomeGeo = new THREE.SphereGeometry(9000, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.56);
    skyDomeGeo.scale(-1, 1, 1);
    const skyDomeMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false });
    const skyDomeMesh = new THREE.Mesh(skyDomeGeo, skyDomeMat);
    scene.add(skyDomeMesh);

    // Real CTX DEM sampler anchored to Landing Datum (-2569 m -> local y=0)
    const gridCorners = demGrid
      ? (() => {
          const nw = offsetM(LANDING_LAT, LANDING_LON, demGrid.grid.north_lat, demGrid.grid.west_lon);
          const se = offsetM(LANDING_LAT, LANDING_LON, demGrid.grid.south_lat, demGrid.grid.east_lon);
          return { minX: nw.dx, maxX: se.dx, minZ: nw.dy, maxZ: se.dy };
        })()
      : { minX: -10000, maxX: 10000, minZ: -10000, maxZ: 10000 };

    const sampleDemRaw = (wx: number, wz: number): number => {
      if (demGrid && demGrid.rows > 1 && demGrid.cols > 1) {
        const fx = Math.max(0, Math.min(1, (wx - gridCorners.minX) / Math.max(1, gridCorners.maxX - gridCorners.minX)));
        const fy = Math.max(0, Math.min(1, (wz - gridCorners.minZ) / Math.max(1, gridCorners.maxZ - gridCorners.minZ)));
        const cF = fx * (demGrid.cols - 1);
        const rF = fy * (demGrid.rows - 1);
        const c0 = Math.floor(cF);
        const r0 = Math.floor(rF);
        const c1 = Math.min(demGrid.cols - 1, c0 + 1);
        const r1 = Math.min(demGrid.rows - 1, r0 + 1);
        const tx = cF - c0;
        const ty = rF - r0;
        const z00 = demGrid.elev_m[r0][c0];
        const z10 = demGrid.elev_m[r0][c1];
        const z01 = demGrid.elev_m[r1][c0];
        const z11 = demGrid.elev_m[r1][c1];
        const zTop = z00 + (z10 - z00) * tx;
        const zBot = z01 + (z11 - z01) * tx;
        const elev = zTop + (zBot - zTop) * ty;
        return (elev - LANDING_DATUM_M) * 1.35;
      }
      // Realistic western delta escarpment & crater rim rise fallback if DEM still streaming
      const westRise = wx < -1600 ? Math.min(340, Math.pow((-1600 - wx) / 280, 1.3) * 12) : 0;
      const bowl = Math.sin(wx * 0.0009) * 18 + Math.cos(wz * 0.0011) * 14;
      return westRise + bowl;
    };

    const terrainHeight = (wx: number, wz: number) => sampleDemRaw(wx, wz) + microRelief(wx, wz);

    // 1. Macro Jezero Crater DEM Mesh (low-poly 63x63 = 7,938 tris covering entire crater)
    const spanW = Math.max(8000, gridCorners.maxX - gridCorners.minX);
    const spanL = Math.max(8000, gridCorners.maxZ - gridCorners.minZ);
    const macroGeo = new THREE.PlaneGeometry(spanW, spanL, 62, 62);
    macroGeo.rotateX(-Math.PI / 2);
    const cxCenter = (gridCorners.minX + gridCorners.maxX) * 0.5;
    const czCenter = (gridCorners.minZ + gridCorners.maxZ) * 0.5;
    macroGeo.translate(cxCenter, 0, czCenter);
    const mPos = macroGeo.attributes.position;
    for (let i = 0; i < mPos.count; i++) {
      const wx = mPos.getX(i);
      const wz = mPos.getZ(i);
      mPos.setY(i, sampleDemRaw(wx, wz) - 0.18);
    }
    macroGeo.computeVertexNormals();

    const macroTex = createRegolithTexture();
    macroTex.repeat.set(90, 90);
    const macroMat = new THREE.MeshStandardMaterial({
      map: macroTex,
      roughness: 0.96,
      metalness: 0.02,
      color: 0xdca082,
    });
    const macroMesh = new THREE.Mesh(macroGeo, macroMat);
    scene.add(macroMesh);

    // 2. Local High-Detail Footbed Patch (40x40 = 3,200 tris centered around player so ground under boots always has real micro-relief)
    const localSize = 180;
    const localGeo = new THREE.PlaneGeometry(localSize, localSize, 40, 40);
    localGeo.rotateX(-Math.PI / 2);
    const localTex = createRegolithTexture();
    localTex.repeat.set(16, 16);
    const localMat = new THREE.MeshStandardMaterial({
      map: localTex,
      bumpMap: localTex,
      bumpScale: 0.09,
      roughness: 0.93,
      metalness: 0.02,
      color: 0xeeb99c,
    });
    const localMesh = new THREE.Mesh(localGeo, localMat);
    scene.add(localMesh);

    let lastPatchX = NaN;
    let lastPatchZ = NaN;
    const syncLocalPatch = (wx: number, wz: number) => {
      const snapX = Math.round(wx / 18) * 18;
      const snapZ = Math.round(wz / 18) * 18;
      if (snapX === lastPatchX && snapZ === lastPatchZ) return;
      lastPatchX = snapX;
      lastPatchZ = snapZ;
      localMesh.position.set(snapX, 0, snapZ);
      const pAttr = localGeo.attributes.position;
      for (let i = 0; i < pAttr.count; i++) {
        const lx = snapX + pAttr.getX(i);
        const lz = snapZ + pAttr.getZ(i);
        pAttr.setY(i, terrainHeight(lx, lz));
      }
      pAttr.needsUpdate = true;
      localGeo.computeVertexNormals();
    };

    // 3. Scattered Real Jezero Basalt Rocks & Pebbles (2 lightweight InstancedMeshes around player)
    const boulderGeo = new THREE.DodecahedronGeometry(0.9, 1);
    boulderGeo.scale(1.25, 0.62, 1.05);
    const boulderMat = new THREE.MeshStandardMaterial({ color: 0x6a2c17, roughness: 0.94 });
    const boulderCount = 42;
    const boulderInst = new THREE.InstancedMesh(boulderGeo, boulderMat, boulderCount);
    scene.add(boulderInst);

    const pebbleGeo = new THREE.DodecahedronGeometry(0.28, 0);
    pebbleGeo.scale(1.2, 0.5, 1.0);
    const pebbleMat = new THREE.MeshStandardMaterial({ color: 0x522110, roughness: 0.96 });
    const pebbleCount = 96;
    const pebbleInst = new THREE.InstancedMesh(pebbleGeo, pebbleMat, pebbleCount);
    scene.add(pebbleInst);

    let lastRockX = NaN;
    let lastRockZ = NaN;
    const dummyObj = new THREE.Object3D();
    const syncLocalRocks = (wx: number, wz: number) => {
      const snapX = Math.round(wx / 24) * 24;
      const snapZ = Math.round(wz / 24) * 24;
      if (snapX === lastRockX && snapZ === lastRockZ) return;
      lastRockX = snapX;
      lastRockZ = snapZ;

      for (let i = 0; i < boulderCount; i++) {
        const ang = i * 2.39996;
        const rad = 18 + ((i * 7.3) % 68);
        const rx = snapX + Math.cos(ang) * rad;
        const rz = snapZ + Math.sin(ang) * rad;
        const sc = 0.45 + ((i * 0.37) % 1.15);
        dummyObj.position.set(rx, terrainHeight(rx, rz) + sc * 0.14, rz);
        dummyObj.rotation.set((i % 5) * 0.12, ang, (i % 3) * 0.1);
        dummyObj.scale.set(sc, sc, sc);
        dummyObj.updateMatrix();
        boulderInst.setMatrixAt(i, dummyObj.matrix);
      }
      boulderInst.instanceMatrix.needsUpdate = true;

      for (let i = 0; i < pebbleCount; i++) {
        const ang = i * 1.71;
        const rad = 3 + ((i * 4.1) % 45);
        const rx = snapX + Math.cos(ang) * rad;
        const rz = snapZ + Math.sin(ang) * rad;
        const sc = 0.55 + ((i * 0.29) % 0.9);
        dummyObj.position.set(rx, terrainHeight(rx, rz) + 0.05, rz);
        dummyObj.rotation.set(0, ang * 2, 0);
        dummyObj.scale.set(sc, sc, sc);
        dummyObj.updateMatrix();
        pebbleInst.setMatrixAt(i, dummyObj.matrix);
      }
      pebbleInst.instanceMatrix.needsUpdate = true;
    };

    // 4. Science Pod Domed Research Base near Octavia Butler Landing Site (~28 m NW of grid-cell start so view SW stays clear)
    const podGroup = new THREE.Group();
    const podX = -14;
    const podZ = -34;
    podGroup.position.set(podX, terrainHeight(podX, podZ) - 0.1, podZ);
    const podHullMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.55, metalness: 0.25 });
    const podTrimMat = new THREE.MeshStandardMaterial({ color: 0xe5484d, roughness: 0.4, metalness: 0.2 });
    const podBaseGeo = new THREE.CylinderGeometry(4.2, 4.6, 2.3, 18);
    const podDomeGeo = new THREE.SphereGeometry(4.15, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const podRingGeo = new THREE.TorusGeometry(4.28, 0.14, 8, 24);
    const podAirlockGeo = new THREE.BoxGeometry(2.1, 2.0, 2.8);
    const podBase = new THREE.Mesh(podBaseGeo, podHullMat);
    podBase.position.y = 1.15;
    const podDome = new THREE.Mesh(podDomeGeo, podHullMat);
    podDome.position.y = 2.25;
    const podRing = new THREE.Mesh(podRingGeo, podTrimMat);
    podRing.rotation.x = Math.PI / 2;
    podRing.position.y = 2.25;
    const podAirlock = new THREE.Mesh(podAirlockGeo, podHullMat);
    podAirlock.position.set(-4.3, 1.0, 0);
    const podShadow = new THREE.Mesh(
      new THREE.CircleGeometry(5.6, 20),
      new THREE.MeshBasicMaterial({ color: 0x220d06, transparent: true, opacity: 0.42, depthWrite: false })
    );
    podShadow.rotation.x = -Math.PI / 2;
    podShadow.position.y = 0.08;
    podGroup.add(podBase, podDome, podRing, podAirlock, podShadow);
    scene.add(podGroup);

    // 5. Real Kodiak Flat-Topped Butte placed at real published offset from Landing Site
    const kodiakOff = offsetM(LANDING_LAT, LANDING_LON, 18.4124, 77.382);
    const kodiakGroup = new THREE.Group();
    const kodiakGroundY = sampleDemRaw(kodiakOff.dx, kodiakOff.dy);
    kodiakGroup.position.set(kodiakOff.dx, kodiakGroundY, kodiakOff.dy);
    const kodiakMat = new THREE.MeshStandardMaterial({ color: 0x9b4b2d, roughness: 0.95 });
    const kodiakBaseGeo = new THREE.CylinderGeometry(160, 260, 140, 10);
    const kodiakCapGeo = new THREE.CylinderGeometry(120, 165, 36, 10);
    const kBase = new THREE.Mesh(kodiakBaseGeo, kodiakMat);
    kBase.position.y = 45;
    const kCap = new THREE.Mesh(kodiakCapGeo, kodiakMat);
    kCap.position.y = 115;
    kodiakGroup.add(kBase, kCap);
    scene.add(kodiakGroup);

    // 6. Research Pond Boundary Stakes anchored at real Delta Front coordinates (dry ground, zero water)
    const pondOff = offsetM(LANDING_LAT, LANDING_LON, 18.441, 77.412);
    const pondBeacons = new THREE.Group();
    const stakeGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.6, 8);
    const tipGeo = new THREE.SphereGeometry(0.22, 8, 8);
    const stakeMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.6 });
    const tipMat = new THREE.MeshStandardMaterial({
      color: 0xff3b30,
      emissive: 0xff3b30,
      emissiveIntensity: 0.9,
    });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const bx = pondOff.dx + Math.cos(a) * 28;
      const bz = pondOff.dy + Math.sin(a) * 28;
      const by = terrainHeight(bx, bz);
      const stake = new THREE.Mesh(stakeGeo, stakeMat);
      stake.position.set(bx, by + 0.8, bz);
      const tip = new THREE.Mesh(tipGeo, tipMat);
      tip.position.set(bx, by + 1.7, bz);
      pondBeacons.add(stake, tip);
    }
    scene.add(pondBeacons);

    // 7. Grounded Low-Poly Astronaut Rig Builder (feet sit at y=0 with dark contact shadow)
    const suitClothMat = new THREE.MeshStandardMaterial({ color: 0xe7dfd5, roughness: 0.78 });
    const darkTrimMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.65 });
    const visorGoldMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.85,
      roughness: 0.2,
    });
    const plssMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.6 });
    const badgeTextures: THREE.Texture[] = [];

    const torsoGeo = new THREE.BoxGeometry(0.46, 0.56, 0.3);
    const plssGeo = new THREE.BoxGeometry(0.44, 0.64, 0.24);
    const helmetGeo = new THREE.SphereGeometry(0.22, 14, 12);
    const visorGeo = new THREE.SphereGeometry(0.18, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
    visorGeo.rotateX(Math.PI / 2);
    const limbGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.68, 8);
    const bootGeo = new THREE.BoxGeometry(0.16, 0.12, 0.26);
    const armGeo = new THREE.CylinderGeometry(0.065, 0.06, 0.52, 8);

    const buildAstronautRig = (
      id: string,
      firstName: string,
      role: string,
      accentHex: number,
      offsetLateral: number,
      offsetAhead: number,
      phaseOffset: number
    ): SquadAstronautRig => {
      const group = new THREE.Group();
      const accentMat = new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.45 });

      // Contact shadow right on the terrain under boots
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.55, 16),
        new THREE.MeshBasicMaterial({ color: 0x1d0b04, transparent: true, opacity: 0.55, depthWrite: false })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(0, 0.04, 0);
      group.add(shadow);

      // Torso & Backpack
      const torso = new THREE.Mesh(torsoGeo, suitClothMat);
      torso.position.set(0, 1.12, 0);
      const plss = new THREE.Mesh(plssGeo, plssMat);
      plss.position.set(0, 1.18, -0.22);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.07, 0.31), accentMat);
      stripe.position.set(0, 1.24, 0);
      group.add(torso, plss, stripe);

      // Helmet & Gold Visor
      const helmet = new THREE.Mesh(helmetGeo, suitClothMat);
      helmet.position.set(0, 1.62, 0);
      const visor = new THREE.Mesh(visorGeo, visorGoldMat);
      visor.position.set(0, 1.62, 0.06);
      group.add(helmet, visor);

      // Legs (bottom of boot sits at y = 0.0)
      const leftLeg = new THREE.Group();
      leftLeg.position.set(-0.14, 0.82, 0);
      const lLegMesh = new THREE.Mesh(limbGeo, suitClothMat);
      lLegMesh.position.set(0, -0.38, 0);
      const lBoot = new THREE.Mesh(bootGeo, darkTrimMat);
      lBoot.position.set(0, -0.76, 0.04);
      leftLeg.add(lLegMesh, lBoot);

      const rightLeg = new THREE.Group();
      rightLeg.position.set(0.14, 0.82, 0);
      const rLegMesh = new THREE.Mesh(limbGeo, suitClothMat);
      rLegMesh.position.set(0, -0.38, 0);
      const rBoot = new THREE.Mesh(bootGeo, darkTrimMat);
      rBoot.position.set(0, -0.76, 0.04);
      rightLeg.add(rLegMesh, rBoot);
      group.add(leftLeg, rightLeg);

      // Arms
      const leftArm = new THREE.Group();
      leftArm.position.set(-0.31, 1.34, 0);
      const lArmMesh = new THREE.Mesh(armGeo, suitClothMat);
      lArmMesh.position.set(0, -0.24, 0);
      leftArm.add(lArmMesh);

      const rightArm = new THREE.Group();
      rightArm.position.set(0.31, 1.34, 0);
      const rArmMesh = new THREE.Mesh(armGeo, suitClothMat);
      rArmMesh.position.set(0, -0.24, 0);
      rightArm.add(rArmMesh);
      group.add(leftArm, rightArm);

      // Compact first-name + role badge above helmet
      const badgeCanvas = document.createElement('canvas');
      badgeCanvas.width = 256;
      badgeCanvas.height = 56;
      const bctx = badgeCanvas.getContext('2d');
      if (bctx) {
        bctx.fillStyle = 'rgba(14, 6, 8, 0.86)';
        bctx.strokeStyle = `#${accentHex.toString(16).padStart(6, '0')}`;
        bctx.lineWidth = 2.5;
        bctx.beginPath();
        bctx.roundRect(6, 6, 244, 44, 14);
        bctx.fill();
        bctx.stroke();
        bctx.fillStyle = '#ffffff';
        bctx.font = 'bold 18px monospace';
        bctx.textAlign = 'center';
        bctx.textBaseline = 'middle';
        bctx.fillText(`${firstName} · ${role}`, 128, 28);
      }
      const bTex = new THREE.CanvasTexture(badgeCanvas);
      bTex.colorSpace = THREE.SRGBColorSpace;
      badgeTextures.push(bTex);
      const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: bTex, transparent: true }));
      badge.scale.set(1.5, 0.34, 1);
      badge.position.set(0, 2.2, 0);
      group.add(badge);

      scene.add(group);
      return {
        id,
        group,
        leftLeg,
        rightLeg,
        leftArm,
        rightArm,
        offsetLateral,
        offsetAhead,
        phaseOffset,
      };
    };

    // Keep squad standing on solid ground 11–17 m ahead cleanly in the lower half of the EVA frame
    const crewLateral = [-4.5, 0.8, 5.2];
    const crewAhead = [11.0, 14.0, 16.5];
    const squadMembers = CREW_ROSTER.map((c, idx) =>
      buildAstronautRig(
        c.id,
        c.firstName,
        c.role,
        parseInt(c.color.replace('#', ''), 16) || 0xe5484d,
        crewLateral[idx] ?? 0,
        crewAhead[idx] ?? 18,
        idx * 2.1
      )
    );

    // Subtle atmospheric dust motes (low particle count = fast CPU frame time)
    const dustCount = 44;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 40;
      dustPos[i * 3 + 1] = Math.random() * 6;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({ color: 0xfba05a, size: 0.08, transparent: true, opacity: 0.35 });
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    scene.add(dustPoints);

    let rafId = 0;
    const clock = new THREE.Clock();
    let tourProgress = 0;
    let lastAltUpdate = 0;

    const animate = () => {
      const st = stateRef.current;
      if (st.paused) {
        rafId = 0;
        return;
      }
      rafId = requestAnimationFrame(animate);

      const dt = Math.min(clock.getDelta(), 0.08);
      const time = clock.getElapsedTime();

      // Player position anchored in true Jezero Crater metre coordinates
      let playerX = -(st.walkDistance * 0.14);
      let playerZ = -st.walkDistance * 0.4;
      if (st.playerLat != null && st.playerLon != null && Number.isFinite(st.playerLat) && Number.isFinite(st.playerLon)) {
        const off = offsetM(LANDING_LAT, LANDING_LON, st.playerLat, st.playerLon);
        playerX = off.dx;
        playerZ = off.dy;
      }

      syncLocalPatch(playerX, playerZ);
      syncLocalRocks(playerX, playerZ);

      const playerGroundY = terrainHeight(playerX, playerZ);
      const stepBobY = st.isWalking ? Math.abs(Math.sin(st.stepPhase * 2)) * 0.05 : 0;

      // Compass heading to camera yaw: headingDeg 0=North (-Z), 90=East (+X), 180=South (+Z), 270=West (-X)
      const radHeading = (st.headingDeg * Math.PI) / 180;
      const fwdX = Math.sin(radHeading);
      const fwdZ = -Math.cos(radHeading);
      const rightX = Math.cos(radHeading);
      const rightZ = Math.sin(radHeading);

      if (st.viewMode === 'flyover' || st.isTourPlaying) {
        tourProgress += dt * 0.1;
        const r = 75;
        camera.position.set(
          Math.sin(tourProgress) * r,
          terrainHeight(0, 0) + 22 + Math.cos(tourProgress * 0.7) * 4,
          Math.cos(tourProgress) * r - 30
        );
        camera.lookAt(0, terrainHeight(0, -10) + 3, -10);
      } else {
        // First-person helmet EVA view: pitched downward (-0.22 rad) so terrain, rocks,
        // grounded crew (lower half), and horizon crater rim fill the visor cleanly
        camera.position.set(playerX, playerGroundY + 1.85 + stepBobY, playerZ);
        camera.rotation.order = 'YXZ';
        camera.rotation.set(-0.22 + (st.pitchOffset * Math.PI) / 180, -radHeading, 0);
      }

      skyDomeMesh.position.set(camera.position.x, camera.position.y - 220, camera.position.z);
      dustPoints.position.set(camera.position.x, terrainHeight(camera.position.x, camera.position.z), camera.position.z);

      // Update grounded crewmates ahead of player view cone (feet firmly on terrainHeight)
      const wallSec = performance.now() / 1000;
      squadMembers.forEach((m) => {
        const patrol = wallSec * 0.35 + m.phaseOffset;
        const driftFwd = Math.sin(patrol) * 2.2;
        const driftLat = Math.cos(patrol * 0.7) * 1.8;
        const distA = m.offsetAhead + driftFwd;
        const distL = m.offsetLateral + driftLat;
        const ax = playerX + fwdX * distA + rightX * distL;
        const az = playerZ + fwdZ * distA + rightZ * distL;
        const ay = terrainHeight(ax, az);
        m.group.position.set(ax, ay, az);
        m.group.rotation.y = Math.atan2(-fwdX, -fwdZ) + Math.sin(patrol) * 0.4;
        const walkSwing = Math.sin(wallSec * 2.6 + m.phaseOffset) * 0.28;
        m.leftLeg.rotation.x = walkSwing;
        m.rightLeg.rotation.x = -walkSwing;
        m.leftArm.rotation.x = -walkSwing * 0.7;
        m.rightArm.rotation.x = walkSwing * 0.7;
      });

      if (onAltitudeChange && time - lastAltUpdate > 0.35) {
        lastAltUpdate = time;
        onAltitudeChange(Math.round(LANDING_DATUM_M + playerGroundY));
      }

      if (st.visorTint === 'gold-polar') renderer.toneMappingExposure = 1.05;
      else if (st.visorTint === 'thermal-lidar') renderer.toneMappingExposure = 1.42;
      else renderer.toneMappingExposure = 1.22;

      renderer.render(scene, camera);
    };

    const startLoop = () => {
      if (!rafId && !stateRef.current.paused) {
        clock.getDelta();
        animate();
      }
    };
    startLoopRef.current = startLoop;
    startLoop();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      startLoopRef.current = null;
      window.removeEventListener('resize', handleResize);
      if (rafId) cancelAnimationFrame(rafId);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      skyGeoDispose(skyDomeGeo, skyTex, skyDomeMat);
      macroGeo.dispose();
      macroTex.dispose();
      macroMat.dispose();
      localGeo.dispose();
      localTex.dispose();
      localMat.dispose();
      boulderGeo.dispose();
      boulderMat.dispose();
      pebbleGeo.dispose();
      pebbleMat.dispose();
      podBaseGeo.dispose();
      podDomeGeo.dispose();
      podRingGeo.dispose();
      podAirlockGeo.dispose();
      podHullMat.dispose();
      podTrimMat.dispose();
      kodiakBaseGeo.dispose();
      kodiakCapGeo.dispose();
      kodiakMat.dispose();
      stakeGeo.dispose();
      tipGeo.dispose();
      stakeMat.dispose();
      tipMat.dispose();
      torsoGeo.dispose();
      plssGeo.dispose();
      helmetGeo.dispose();
      visorGeo.dispose();
      limbGeo.dispose();
      bootGeo.dispose();
      armGeo.dispose();
      suitClothMat.dispose();
      darkTrimMat.dispose();
      visorGoldMat.dispose();
      plssMat.dispose();
      dustGeo.dispose();
      dustMat.dispose();
      badgeTextures.forEach((t) => t.dispose());
    };
    // Rebuild only when measured CTX DEM grid changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demGrid]);

  useEffect(() => {
    if (!paused) startLoopRef.current?.();
  }, [paused]);

  return (
    <div id="mars-3d-webgl-canvas" className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" />
      {webglError && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center font-mono text-white"
          style={{
            background: 'linear-gradient(#5b2316 0%, #c26e48 48%, #7a3319 52%, #3a140a 100%)',
          }}
        >
          <div className="max-w-md rounded-2xl border border-[#E5484D]/60 bg-[#120608]/92 p-5 space-y-2">
            <div className="text-xs font-bold uppercase tracking-widest text-[#FF3B30]">
              3D view — visualisation fallback
            </div>
            <p className="text-xs text-white/80">{webglError}</p>
          </div>
        </div>
      )}
    </div>
  );
};

function skyGeoDispose(g: THREE.BufferGeometry, t: THREE.Texture, m: THREE.Material) {
  g.dispose();
  t.dispose();
  m.dispose();
}
