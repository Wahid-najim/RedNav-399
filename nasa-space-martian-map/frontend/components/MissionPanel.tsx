'use client';

import React, { useState } from 'react';
import { Trophy, Backpack, Save, Download, Lock, Check, X } from 'lucide-react';
import { MISSIONS, nextRankForXp, rankForXp } from '../lib/missions';
import type { GameProgress } from '../lib/progress';
import { hudSound } from '../utils/soundEffects';

/** Missions / rank / inventory / save station panel (GTA mission
 *  select + RE item box + RE typewriter save). Progress only counts
 *  when the real thing happened in the app. */
export const MissionPanel: React.FC<{
  game: GameProgress;
  onClose?: () => void;
  onSelectMission?: (id: string) => void;
  atBase?: boolean;
}> = ({ game, onClose, onSelectMission, atBase = false }) => {
  const { progress, activeMission, isCompleted, isUnlocked, setActiveMission, saveAtBase, saveFlash, dismissSaveFlash, exportInventory } = game;
  const [briefingId, setBriefingId] = useState<string | null>(null);
  const rank = rankForXp(progress.xp);
  const next = nextRankForXp(progress.xp);
  const briefing = MISSIONS.find((m) => m.id === briefingId) ?? null;

  return (
    <div className="space-y-3">
      <div className="rounded border border-white/10 p-2.5 space-y-1.5">
        <div className="flex items-center gap-2 text-xs font-bold"><Trophy className="w-4 h-4 text-amber-300" />Rank: {rank} <span className="ml-auto font-mono text-[11px] text-[#ff8a8e]">{progress.xp} XP</span></div>
        {next && <div className="text-[10px] font-mono text-white/50">Next rank {next.name} at {next.minXp} XP — {next.minXp - progress.xp} XP to go.</div>}
        <div className="text-[10px] text-white/45 leading-snug">XP comes only from real things you did: walking, reaching a site, collecting a sample, running an analysis. Every XP event is listed below with its cause.</div>
      </div>

      <div>
        <h3 className="font-mono text-[11px] tracking-widest text-white/50 mb-2">MISSIONS — unlock in order</h3>
        <ul className="space-y-1.5">
          {MISSIONS.map((m) => {
            const done = isCompleted(m.id);
            const unlocked = isUnlocked(m.id);
            const active = activeMission.id === m.id;
            return (
              <li key={m.id}>
                <button
                  disabled={!unlocked}
                  onClick={() => { setBriefingId(m.id); if (unlocked && !done) setActiveMission(m.id); onSelectMission?.(m.id); }}
                  className={`w-full text-left rounded border p-2.5 ${active ? 'border-[#E5484D]/70 bg-[#E5484D]/10' : 'border-white/10 bg-slate-900/40'} ${!unlocked ? 'opacity-50' : 'hover:border-[#E5484D]/50'}`}
                >
                  <div className="flex items-center gap-2 text-xs font-bold">
                    {done ? <Check className="w-4 h-4 text-emerald-300" /> : !unlocked ? <Lock className="w-4 h-4 text-white/40" /> : null}
                    <span>{m.num} — {m.title}</span>
                    {active && !done && <span className="ml-auto text-[9px] font-mono text-[#ff8a8e] border border-[#E5484D]/50 rounded px-1">ACTIVE</span>}
                    {done && <span className="ml-auto text-[9px] font-mono text-emerald-300 border border-emerald-400/40 rounded px-1">PASSED</span>}
                  </div>
                  <div className="text-[11px] text-white/70 mt-0.5">{m.briefingPlain}</div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {briefing && (
        <div className="rounded border border-[#E5484D]/50 bg-[#E5484D]/5 p-3 space-y-2" role="dialog" aria-label={`Briefing: ${briefing.title}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-bold">{briefing.num} — {briefing.title}</div>
            <button onClick={() => setBriefingId(null)} aria-label="Close briefing"><X className="w-4 h-4 text-white/60" /></button>
          </div>
          <p className="text-[12px] leading-snug">{briefing.briefingPlain}</p>
          <p className="text-[11px] text-white/60 leading-snug">{briefing.briefingScience}</p>
          <ul className="text-[11px] space-y-0.5">{briefing.objectives.map((o, i) => <li key={i}>☐ {o}</li>)}</ul>
          <div className="text-[10px] font-mono text-white/50">Reward: {briefing.xpReward} XP on completion — only when the real thing happens in the app.</div>
        </div>
      )}

      <div>
        <h3 className="font-mono text-[11px] tracking-widest text-white/50 mb-2 flex items-center gap-1.5"><Backpack className="w-3.5 h-3.5" />SAMPLE CASE — {progress.inventory.length} item{progress.inventory.length === 1 ? '' : 's'}</h3>
        {progress.inventory.length === 0 ? (
          <p className="text-[11px] text-white/50">Empty. Collect a sample at a site during a walk and it appears here with its real chemistry.</p>
        ) : (
          <ul className="space-y-1.5">{progress.inventory.map((item) => (
            <li key={item.id} className="rounded border border-white/10 bg-slate-900/40 p-2 text-[11px]">
              <div className="font-bold">{item.siteName} sample</div>
              <div className="text-white/70">{item.chemistry ?? 'Chemistry not published for this site.'}</div>
              <div className="text-white/50">{item.plain}</div>
              <div className="font-mono text-white/40 text-[10px]">Collected {new Date(item.collectedAt).toLocaleString()}</div>
            </li>
          ))}</ul>
        )}
        {progress.inventory.length > 0 && (
          <button onClick={exportInventory} className="mt-2 flex items-center gap-1.5 text-[11px] font-mono text-[#ff8a8e] hover:underline"><Download className="w-3.5 h-3.5" />Export sample case (JSON)</button>
        )}
      </div>

      <div className="rounded border border-amber-400/30 bg-amber-500/5 p-2.5 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold"><Save className="w-4 h-4 text-amber-300" />SAVE STATION — Octavia E. Butler Landing</div>
        <p className="text-[11px] text-white/60 leading-snug">The base is the save station. Saving is a deliberate action — press the button, hear the chime, and your missions, XP and samples are written down.</p>
        <button
          onClick={() => { hudSound.playSaveChime(); saveAtBase(); }}
          className="w-full px-3 py-2 rounded bg-amber-500/20 border border-amber-400/50 text-xs font-mono font-bold hover:bg-amber-500/35"
        >
          Save progress at base
        </button>
        {progress.lastSave && <div className="text-[10px] font-mono text-white/50">Last saved: {new Date(progress.lastSave.savedAt).toLocaleString()} · {progress.lastSave.xp} XP · {progress.lastSave.missionsCompleted.length} mission(s) passed · {progress.lastSave.inventoryCount} sample(s).</div>}
        {!atBase && <div className="text-[10px] text-amber-200/70">You are away from base — the save still records the base as the station, because that is where the record lives.</div>}
      </div>

      <div>
        <h3 className="font-mono text-[11px] tracking-widest text-white/50 mb-2">MISSION LOG — every XP event, with its cause</h3>
        {progress.xpLog.length === 0 ? (
          <p className="text-[11px] text-white/50">Nothing yet. Walk a route, reach a site, or run an analysis.</p>
        ) : (
          <ul className="space-y-1 max-h-40 overflow-y-auto">{[...progress.xpLog].reverse().map((e, i) => (
            <li key={i} className="text-[10px] font-mono text-white/60 flex justify-between gap-2"><span>{e.cause}</span><span className="text-[#ff8a8e] shrink-0">+{e.xp} XP</span></li>
          ))}</ul>
        )}
      </div>

      {saveFlash && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-label="Progress saved">
          <div className="w-full max-w-sm rounded border border-amber-400/50 bg-[#0d0a06] p-5 text-center space-y-2">
            <div className="font-mono text-[10px] tracking-widest text-amber-300">SAVE STATION</div>
            <div className="text-lg font-bold">Progress saved.</div>
            <p className="text-[11px] text-white/70">Saved at Octavia E. Butler Landing · {new Date(saveFlash.savedAt).toLocaleString()}<br />{saveFlash.xp} XP · {saveFlash.missionsCompleted.length} mission(s) passed · {saveFlash.inventoryCount} sample(s) in the case.</p>
            <button onClick={dismissSaveFlash} className="px-4 py-2 rounded border border-white/20 text-xs font-mono">Continue</button>
          </div>
        </div>
      )}
      {onClose && <button onClick={onClose} className="w-full px-3 py-2 rounded border border-white/15 text-xs font-mono">Close</button>}
    </div>
  );
};
