'use client';

import { useCallback, useEffect, useState } from 'react';
import { MISSIONS, XP_RULES, xpForWalk } from './missions';
import { sampleChemistryForSite } from './jezeroReal';

/**
 * Game progress (§6): missions, XP log, inventory, save stations.
 * Progress is kept in memory and restored ONLY from an explicit
 * SAVE at the base (save station) — saving is a deliberate action
 * with a small ceremony, not silent autosave. The save lives in
 * localStorage under REDNAV_SAVE_KEY.
 */

export interface XpEvent {
  at: string;
  xp: number;
  cause: string;
}

export interface InventoryItem {
  id: string;
  siteId: string;
  siteName: string;
  collectedAt: string;
  collectedSol?: number;
  chemistry: string | null;
  plain: string;
}

export interface FieldNoteRecord {
  id: string;
  siteId: string;
  siteName: string;
  note: string;
  sol: number;
  at: string;
}

export interface SaveRecord {
  savedAt: string;
  savedAtSite: string;
  xp: number;
  missionsCompleted: string[];
  inventoryCount: number;
}

export interface ProgressState {
  activeMissionId: string;
  completedMissionIds: string[];
  failedMissionIds: string[];
  xp: number;
  xpLog: XpEvent[];
  inventory: InventoryItem[];
  fieldNotes: FieldNoteRecord[];
  zonesVisited: string[];
  sitesReached: string[];
  chemistryRead: string[];
  analysesRun: number;
  routesPlanned: number;
  lastSave: SaveRecord | null;
}

const SAVE_KEY = 'rednav-jezero-save-v1';

export const INITIAL_PROGRESS: ProgressState = {
  activeMissionId: 'm1_first_light',
  completedMissionIds: [],
  failedMissionIds: [],
  xp: 0,
  xpLog: [],
  inventory: [],
  fieldNotes: [],
  zonesVisited: [],
  sitesReached: [],
  chemistryRead: [],
  analysesRun: 0,
  routesPlanned: 0,
  lastSave: null,
};

function loadSave(): ProgressState {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(SAVE_KEY) : null;
    if (!raw) return INITIAL_PROGRESS;
    const parsed = JSON.parse(raw) as ProgressState;
    return {
      ...INITIAL_PROGRESS,
      ...parsed,
      xpLog: parsed.xpLog ?? [],
      inventory: parsed.inventory ?? [],
      fieldNotes: parsed.fieldNotes ?? [],
    };
  } catch {
    return INITIAL_PROGRESS;
  }
}

export function useGameProgress() {
  const [progress, setProgress] = useState<ProgressState>(INITIAL_PROGRESS);
  const [loaded, setLoaded] = useState(false);
  const [saveFlash, setSaveFlash] = useState<SaveRecord | null>(null);

  useEffect(() => {
    setProgress(loadSave());
    setLoaded(true);
  }, []);

  const update = useCallback((fn: (p: ProgressState) => ProgressState) => {
    setProgress((prev) => fn(prev));
  }, []);

  const addXp = useCallback((xp: number, cause: string) => {
    if (xp <= 0) return;
    update((p) => ({ ...p, xp: p.xp + xp, xpLog: [...p.xpLog, { at: new Date().toISOString(), xp, cause }] }));
  }, [update]);

  const activeMission = MISSIONS.find((m) => m.id === progress.activeMissionId) ?? MISSIONS[0];
  const isCompleted = (id: string) => progress.completedMissionIds.includes(id);
  const isUnlocked = (id: string) => {
    const idx = MISSIONS.findIndex((m) => m.id === id);
    if (idx <= 0) return true;
    return progress.completedMissionIds.includes(MISSIONS[idx - 1].id);
  };

  const completeMission = useCallback((id: string) => {
    update((p) => {
      if (p.completedMissionIds.includes(id)) return p;
      const mission = MISSIONS.find((m) => m.id === id);
      const nextIdx = MISSIONS.findIndex((m) => m.id === id) + 1;
      return {
        ...p,
        completedMissionIds: [...p.completedMissionIds, id],
        xp: p.xp + (mission?.xpReward ?? 0),
        xpLog: [...p.xpLog, { at: new Date().toISOString(), xp: mission?.xpReward ?? 0, cause: `Mission complete: ${mission?.title ?? id}` }],
        activeMissionId: nextIdx < MISSIONS.length ? MISSIONS[nextIdx].id : p.activeMissionId,
      };
    });
  }, [update]);

  const failMission = useCallback((id: string, reason: string) => {
    update((p) => (p.failedMissionIds.includes(id) ? p : {
      ...p,
      failedMissionIds: [...p.failedMissionIds, id],
      xpLog: [...p.xpLog, { at: new Date().toISOString(), xp: 0, cause: `Mission failed: ${id} — ${reason}` }],
    }));
  }, [update]);

  const recordRoutePlanned = useCallback((goalSiteId: string | null) => {
    update((p) => ({ ...p, routesPlanned: p.routesPlanned + 1 }));
    return goalSiteId;
  }, [update]);

  /** Called when the HUD sim arrives at a site. Awards site + walk XP once per arrival. */
  const recordArrival = useCallback((siteId: string, distanceM: number, elevGainM: number, zoneId: string | null) => {
    const walkXp = xpForWalk(distanceM, elevGainM);
    update((p) => {
      const firstVisit = !p.sitesReached.includes(siteId);
      const newZone = zoneId && !p.zonesVisited.includes(zoneId);
      return {
        ...p,
        sitesReached: firstVisit ? [...p.sitesReached, siteId] : p.sitesReached,
        zonesVisited: newZone && zoneId ? [...p.zonesVisited, zoneId] : p.zonesVisited,
        xp: p.xp + walkXp + (firstVisit ? XP_RULES.siteReached : 0) + (newZone ? XP_RULES.zoneVisited : 0),
        xpLog: [
          ...p.xpLog,
          { at: new Date().toISOString(), xp: walkXp, cause: `Walked ${Math.round(distanceM)} m (+${Math.round(elevGainM)} m climb)` },
          ...(firstVisit ? [{ at: new Date().toISOString(), xp: XP_RULES.siteReached, cause: `Reached ${siteId} in the HUD sim` }] : []),
          ...(newZone && zoneId ? [{ at: new Date().toISOString(), xp: XP_RULES.zoneVisited, cause: `First visit to zone ${zoneId}` }] : []),
        ],
      };
    });
  }, [update]);

  const recordChemistryRead = useCallback((siteId: string) => {
    update((p) => (p.chemistryRead.includes(siteId) ? p : { ...p, chemistryRead: [...p.chemistryRead, siteId] }));
  }, [update]);

  const recordAnalysis = useCallback(() => {
    update((p) => ({
      ...p,
      analysesRun: p.analysesRun + 1,
      xp: p.xp + XP_RULES.analysisCompleted,
      xpLog: [...p.xpLog, { at: new Date().toISOString(), xp: XP_RULES.analysisCompleted, cause: 'Research Lab analysis completed' }],
    }));
  }, [update]);

  const collectSample = useCallback((siteId: string, siteName: string, plain: string, sol = 1212) => {
    const chemistry = sampleChemistryForSite(siteId);
    update((p) => {
      if (p.inventory.some((i) => i.siteId === siteId && (i.collectedSol == null || i.collectedSol === sol))) {
        return p;
      }
      return {
        ...p,
        inventory: [
          ...p.inventory,
          {
            id: `${siteId}-sol${sol}-${Date.now()}`,
            siteId,
            siteName,
            collectedAt: new Date().toISOString(),
            collectedSol: sol,
            chemistry,
            plain,
          },
        ],
        xp: p.xp + XP_RULES.sampleCollected,
        xpLog: [...p.xpLog, { at: new Date().toISOString(), xp: XP_RULES.sampleCollected, cause: `Sample collected at ${siteName} (Sol ${sol})` }],
      };
    });
  }, [update]);

  const addFieldNote = useCallback((siteId: string, siteName: string, note: string, sol = 1212) => {
    const trimmed = note.trim();
    if (!trimmed) return;
    update((p) => ({
      ...p,
      fieldNotes: [
        ...(p.fieldNotes ?? []),
        {
          id: `note-${siteId}-${Date.now()}`,
          siteId,
          siteName,
          note: trimmed.slice(0, 140),
          sol,
          at: new Date().toISOString(),
        },
      ],
      xp: p.xp + 20,
      xpLog: [...p.xpLog, { at: new Date().toISOString(), xp: 20, cause: `Logged field note at ${siteName}` }],
    }));
  }, [update]);

  /** SAVE STATION: deliberate save at the base. Writes the save record. */
  const saveAtBase = useCallback(() => {
    const record: SaveRecord = {
      savedAt: new Date().toISOString(),
      savedAtSite: 'Octavia E. Butler Landing',
      xp: progress.xp,
      missionsCompleted: progress.completedMissionIds,
      inventoryCount: progress.inventory.length,
    };
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({ ...progress, lastSave: record }));
    } catch { /* storage unavailable — the ceremony still shows, save is not claimed */ }
    update((p) => ({ ...p, lastSave: record }));
    setSaveFlash(record);
    return record;
  }, [progress, update]);

  const dismissSaveFlash = useCallback(() => setSaveFlash(null), []);

  const exportInventory = useCallback(() => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), xp: progress.xp, inventory: progress.inventory, xpLog: progress.xpLog }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jezero-sample-case.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [progress]);

  return {
    progress, loaded, activeMission, isCompleted, isUnlocked,
    addXp, completeMission, failMission, recordRoutePlanned, recordArrival,
    recordChemistryRead, recordAnalysis, collectSample, addFieldNote,
    saveAtBase, saveFlash, dismissSaveFlash, exportInventory,
    setActiveMission: (id: string) => update((p) => ({ ...p, activeMissionId: id })),
  };
}

export type GameProgress = ReturnType<typeof useGameProgress>;
