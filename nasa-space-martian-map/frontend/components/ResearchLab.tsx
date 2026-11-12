'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Upload, Download, FlaskConical, TriangleAlert } from 'lucide-react';
import { api } from '../lib/api';
import type { BrainStatus, LabAnalysis } from '../lib/missionTypes';
import { mockAnalysis, MOCK_BRAIN } from '../lib/researchLabMock';
import { safeSha256Hex } from '../lib/browserSafe';
import { ExplainButton } from './ExplainButton';

interface Props {
  onClose: () => void;
  onAnalysisComplete?: (analysis: LabAnalysis) => void;
}

const ACCEPT = 'image/png,image/jpeg,image/tiff,.png,.jpg,.jpeg,.tif,.tiff';

function imageDimensions(file: File): Promise<{ width: number | null; height: number | null; url: string }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight, url });
    img.onerror = () => resolve({ width: null, height: null, url });
    img.src = url;
  });
}

const SectionHead = ({ n, title, plain }: { n: string; title: string; plain: string }) => (
  <div>
    <h3 className="flex items-center gap-2 text-xs font-bold tracking-wider"><span className="w-5 h-5 rounded-full bg-[#E5484D]/25 border border-[#E5484D]/50 text-[10px] font-mono flex items-center justify-center">{n}</span>{title}</h3>
    <p className="mt-1 text-[12px] leading-snug text-white/85">{plain}</p>
  </div>
);

/** RESEARCH LAB — the offline science instrument (§5). Image-upload
 *  only. Results in the exact order: measurements, matches, novelty,
 *  hypotheses, actions, unknowns. Every section starts with a
 *  one-sentence plain answer, then detail, then sources. */
export const ResearchLab: React.FC<Props> = ({ onClose, onAnalysisComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<{ width: number | null; height: number | null }>({ width: null, height: null });
  const [hash, setHash] = useState<string | null>(null);
  const [sol, setSol] = useState('');
  const [instrument, setInstrument] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [note, setNote] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LabAnalysis | null>(null);
  const [brain, setBrain] = useState<BrainStatus | null>(null);
  const [brainLive, setBrainLive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const utcNow = new Date().toUTCString().slice(17, 25);

  useEffect(() => {
    api.brain().then((b) => { setBrain(b); setBrainLive(true); }).catch(() => { setBrain(MOCK_BRAIN as BrainStatus); setBrainLive(false); });
  }, []);

  const takeFile = async (f: File | undefined | null) => {
    if (!f) return;
    setResult(null);
    setError(null);
    setFile(f);
    const d = await imageDimensions(f);
    setDims({ width: d.width, height: d.height });
    setPreviewUrl(d.url);
    setHash(await safeSha256Hex(f));
  };

  const analyse = async () => {
    if (!file) return;
    setRunning(true);
    setError(null);
    const meta = {
      sol: sol.trim() || null, instrument: instrument.trim() || null,
      lat: lat.trim() || null, lon: lon.trim() || null, note: note.trim() || null,
    };
    try {
      const live = await api.analyzeImage(file, {
        sol: sol.trim() || undefined, instrument: instrument.trim() || undefined,
        lat: lat.trim() || undefined, lon: lon.trim() || undefined, note: note.trim() || undefined,
      });
      setResult({ ...live, mock: false });
      onAnalysisComplete?.(live);
    } catch (e) {
      // Backend not reachable yet — clearly-labelled demo fallback for development only.
      const demo = mockAnalysis(file.name, hash ?? 'unavailable', dims.width, dims.height, meta);
      setResult(demo);
      setError(`Backend not connected (${String((e as Error).message ?? e)}). Showing DEMO data — not a real analysis.`);
      onAnalysisComplete?.(demo);
    } finally {
      setRunning(false);
    }
  };

  const maxScore = result ? Math.max(0.01, ...result.matches.map((m) => m.score)) : 1;

  return (
    <div className="absolute inset-0 z-[70] flex flex-col bg-[#05070d]/98 text-slate-100 overflow-hidden" role="dialog" aria-label="Research Lab">
      {/* SOL 356-style run header: SOL from metadata if provided, UTC = local time. Never copied numbers. */}
      <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <FlaskConical className="w-5 h-5 text-[#E5484D] shrink-0" />
          <div className="min-w-0">
            <div className="font-mono text-sm font-bold tracking-widest">RESEARCH LAB <span className="text-white/40 font-normal">· image-upload science instrument</span></div>
            <div className="font-mono text-[10px] text-white/50">SOL {sol.trim() || '— not provided'} · UTC {utcNow} · {brain ? `Brain: Tier ${brain.tier} — ${brain.brain}` : 'Brain: checking…'}{!brainLive && ' · backend not connected'}</div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-full border border-white/15 hover:border-[#E5484D]/60 shrink-0" aria-label="Close Research Lab"><X className="w-4 h-4" /></button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-5 py-4 space-y-4">
          <p className="text-xs text-white/70 leading-relaxed">
            This is a decision helper, not a discoverer. You upload a photo, it measures the photo, compares it with the rocks we already know from Jezero, and tells you what to do next. <b className="text-white">You</b> draw the conclusions — the instrument never does.
          </p>

          {error && (
            <div className="flex gap-2 text-[11px] text-amber-200 bg-amber-500/10 border border-amber-400/30 rounded p-2.5"><TriangleAlert className="w-4 h-4 shrink-0" />{error}</div>
          )}

          {/* Upload */}
          <section className="rounded border border-white/10 bg-slate-900/40 p-3 space-y-3">
            <h2 className="text-xs font-bold tracking-wider">1 · UPLOAD A PHOTO</h2>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); void takeFile(e.dataTransfer.files?.[0]); }}
              onClick={() => inputRef.current?.click()}
              className={`cursor-pointer rounded border border-dashed p-6 text-center ${dragOver ? 'border-[#E5484D] bg-[#FF3B30]/10' : 'border-white/25 hover:border-[#E5484D]/60'}`}
            >
              <Upload className="w-6 h-6 mx-auto text-[#E5484D]" />
              <div className="mt-2 text-xs font-mono">Drop a photo here, or click to choose one</div>
              <div className="text-[10px] font-mono text-white/45 mt-1">PNG, JPG or TIFF · the photo never leaves this machine</div>
              <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => void takeFile(e.target.files?.[0])} />
            </div>

            {file && (
              <div className="space-y-2">
                {previewUrl && <img src={previewUrl} alt="Uploaded rock photo" className="max-h-64 rounded border border-white/10 mx-auto" />}
                <dl className="text-[11px] font-mono space-y-1">
                  <div className="flex justify-between gap-2"><dt className="text-white/40">File</dt><dd className="text-right break-all">{file.name}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-white/40">Size</dt><dd>{dims.width ?? '—'} × {dims.height ?? '—'} px</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-white/40">SHA-256</dt><dd className="text-right break-all">{hash ?? 'computing…'}</dd></div>
                </dl>
                <p className="text-[10px] text-white/45">The SHA-256 hash is the photo’s fingerprint — it proves this analysis belongs to this exact file.</p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-2 text-xs">
              <label className="block">Sol (Mars day) — leave blank if unknown
                <input value={sol} onChange={(e) => setSol(e.target.value)} placeholder="not provided" className="mt-1 w-full bg-slate-950 border border-white/15 rounded px-2 py-1.5 font-mono text-xs" />
              </label>
              <label className="block">Instrument (camera) — leave blank if unknown
                <input value={instrument} onChange={(e) => setInstrument(e.target.value)} placeholder="not provided" className="mt-1 w-full bg-slate-950 border border-white/15 rounded px-2 py-1.5 font-mono text-xs" />
              </label>
              <label className="block">Location — latitude
                <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="not provided" className="mt-1 w-full bg-slate-950 border border-white/15 rounded px-2 py-1.5 font-mono text-xs" />
              </label>
              <label className="block">Location — longitude
                <input value={lon} onChange={(e) => setLon(e.target.value)} placeholder="not provided" className="mt-1 w-full bg-slate-950 border border-white/15 rounded px-2 py-1.5 font-mono text-xs" />
              </label>
              <label className="block sm:col-span-2">Your note
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="not provided" className="mt-1 w-full bg-slate-950 border border-white/15 rounded px-2 py-1.5 font-mono text-xs" />
              </label>
            </div>
            <p className="text-[10px] text-white/45">Nothing is auto-filled or guessed from the filename. Blank means “not provided”.</p>

            <button onClick={analyse} disabled={!file || running} className="w-full px-3 py-2.5 rounded bg-[#E5484D]/25 border border-[#E5484D]/70 text-xs font-mono font-bold tracking-wider hover:bg-[#FF3B30]/40 disabled:opacity-40">
              {running ? 'ANALYSING…' : 'Analyse this photo'}
            </button>
            {running && <p className="text-[11px] text-white/50 text-center">Measuring the photo on this machine — no internet needed.</p>}
          </section>

          {/* Results — exact order (a)–(f) */}
          {result && (
            <div className="space-y-4">
              {result.mock && <div className="rounded border border-amber-400/40 bg-amber-500/10 p-2.5 text-[11px] font-mono text-amber-200">DEMO DATA — backend not connected. This example shows the layout only; it is not a real analysis of your photo.</div>}
              <p className="text-sm leading-relaxed"><span className="text-white/50 font-mono text-[10px] tracking-widest block">IN ONE SENTENCE</span>{result.plain_summary}</p>

              <section className="rounded border border-white/10 bg-slate-900/40 p-3 space-y-2">
                <SectionHead n="a" title="MEASUREMENTS" plain="What we can measure in this photo, with how sure we are." />
                {result.measurements.length === 0 ? <p className="text-[11px] text-white/50">Nothing was measurable in this photo — that is a result, not a failure.</p> : (
                  <ul className="space-y-2">{result.measurements.map((m, i) => (
                    <li key={i} className="text-[11px] rounded border border-white/10 bg-slate-950/50 p-2">
                      <div className="flex justify-between gap-2"><b>{m.name}</b><span className="font-mono">{m.value} {m.unit}</span></div>
                      {m.plain && <div className="text-white/80 mt-0.5">{m.plain}</div>}
                      <div className="font-mono text-white/45 mt-0.5">Method: {m.method} · Uncertainty: {m.uncertainty}</div>
                    </li>
                  ))}</ul>
                )}
                <p className="text-[10px] text-white/40">Source: this upload (SHA-256 {result.sha256.slice(0, 16)}…). Model outputs are labelled “model output”, never a geological claim.</p>
              </section>

              <section className="rounded border border-white/10 bg-slate-900/40 p-3 space-y-2">
                <SectionHead n="b" title="SIMILAR ROCKS WE ALREADY KNOW" plain={result.matches[0] ? `This photo looks most like ${result.matches[0].name}. A match is never proof — it only says “look here first”.` : 'No similar rocks found in the local archive.'} />
                {/* SOL 356 striped columns: one column per match, height = score */}
                <div className="flex items-end gap-2 h-28 border-b border-white/15 pb-0 pt-2" aria-label="Similar-feature matches, column height shows score">
                  {result.matches.map((m, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
                      <span className="text-[10px] font-mono text-[#ff8a8e]">{m.score.toFixed(2)}</span>
                      <div className="w-full bg-[#c25e2e] border-t border-[#e07840]" style={{ height: `${Math.max(6, (m.score / maxScore) * 72)}px` }} title={`${m.name}: ${m.score}`} />
                    </div>
                  ))}
                </div>
                <table className="w-full text-[10px] font-mono text-white/60">
                  <tbody>{result.matches.map((m, i) => (
                    <tr key={i} className="border-t border-white/10"><td className="py-1 pr-2 text-white">{m.name}</td><td className="py-1 text-right">{m.score.toFixed(2)}</td></tr>
                  ))}</tbody>
                </table>
                <ul className="space-y-1.5">{result.matches.map((m, i) => (
                  <li key={i} className="text-[11px]"><b>{m.name}</b> — {m.plain ?? ''} <span className="text-white/50">({m.metric}; shared: {m.shared_properties.join(', ')})</span><div className="font-mono text-white/45 text-[10px]">Archive: {m.archive_ref}</div></li>
                ))}</ul>
              </section>

              <section className="rounded border border-white/10 bg-slate-900/40 p-3 space-y-2">
                <SectionHead n="c" title="HOW UNUSUAL IS THIS?" plain={result.novelty.plain} />
                <div className="text-[11px] font-mono">Novelty: {result.novelty.score_sigma}σ · population: {result.novelty.population} (n={result.novelty.n})</div>
                <p className="text-[10px] text-white/45">{result.novelty.method}. Absence from the local archive is never absence from Mars.</p>
              </section>

              <section className="rounded border border-white/10 bg-slate-900/40 p-3 space-y-2">
                <SectionHead n="d" title="IDEAS WORTH TESTING — WITH SOURCES" plain="Ideas, not answers. Each one says what supports it and where it came from." />
                {result.hypotheses.length === 0 ? <p className="text-[11px] text-white/50">No hypothesis could be supported from this photo. That is honest — a photo alone rarely proves anything.</p> : (
                  <ul className="space-y-2">{result.hypotheses.map((h, i) => (
                    <li key={i} className="text-[11px] rounded border border-white/10 bg-slate-950/50 p-2">
                      <div>{h.plain ?? h.text}</div>
                      <div className="text-white/75 mt-1">{h.text}</div>
                      <div className="text-white/55 mt-1">Backed by: {h.supporting_measurements.join(', ')} · Confidence: {h.confidence}</div>
                      <div className="font-mono text-white/45 text-[10px] mt-0.5">Citation: {h.citation.author} ({h.citation.year}), “{h.citation.title}” — {h.citation.source_file}</div>
                    </li>
                  ))}</ul>
                )}
              </section>

              <section className="rounded border border-white/10 bg-slate-900/40 p-3 space-y-2">
                <SectionHead n="e" title="WHAT TO DO NEXT — BEST FIRST" plain="The most useful next step is at the top. Cost is shown honestly — “unknown” when it is unknown." />
                <ol className="space-y-1.5">{[...result.actions].sort((a, b) => a.rank - b.rank).map((a) => (
                  <li key={a.rank} className="text-[11px] rounded border border-white/10 bg-slate-950/50 p-2">
                    <b>#{a.rank} {a.action}</b>
                    <div className="text-white/70">Why: {a.expected_value}</div>
                    <div className="font-mono text-white/45 text-[10px]">Cost: {a.cost_unknown ? 'UNKNOWN — not published' : a.cost}</div>
                  </li>
                ))}</ol>
              </section>

              <section className="rounded border border-white/10 bg-slate-900/40 p-3 space-y-2">
                <SectionHead n="f" title="WHAT WE DO NOT KNOW" plain="The honest gaps. A good instrument says what it cannot tell you." />
                <ul className="space-y-1">{result.unknowns.map((u, i) => <li key={i} className="text-[11px] text-white/75">• {u}</li>)}</ul>
                {result.pattern_finder?.pairs?.length > 0 && (
                  <div className="pt-1">
                    <div className="text-[10px] font-mono text-white/50">PATTERN FINDER — {result.pattern_finder.label}</div>
                    <ul className="space-y-1 mt-1">{result.pattern_finder.pairs.map((p, i) => (
                      <li key={i} className="text-[11px] text-white/70">“{p.a}” + “{p.b}”: seen {p.count}×, expected {p.expected}× — {p.note}</li>
                    ))}</ul>
                  </div>
                )}
              </section>

              <div className="flex flex-wrap gap-2">
                <a href={result.mock ? undefined : api.bundleUrl(result.id)} onClick={(e) => { if (result.mock) { e.preventDefault(); alert('Demo data has no evidence bundle — connect the backend first.'); } }} className="flex items-center gap-2 px-3 py-2 rounded bg-[#E5484D]/25 border border-[#E5484D]/70 text-xs font-mono font-bold hover:bg-[#FF3B30]/40">
                  <Download className="w-4 h-4" />Export evidence bundle (ZIP)
                </a>
                <span className="text-[10px] text-white/45 self-center">The bundle holds the photo, the measurements, and a manifest of every model, version and source — enough for a second scientist to reproduce this result.</span>
              </div>
              <p className="text-[10px] font-mono text-white/40">Brain: Tier {result.tier} — {result.brain} · Analysis {result.id} · {result.created_at} · <ExplainButton term="biosignature" /></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
