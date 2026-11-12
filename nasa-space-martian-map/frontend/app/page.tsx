'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Share2, Check, Copy } from 'lucide-react';
import MarsHudLoader from '../components/MarsHudLoader';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { api, getApiDisplayBase } from '../lib/api';
import { loadUiMode, saveUiMode, type UiMode } from '../lib/juniorMode';
import { safeCopyText } from '../lib/browserSafe';

const Mars3dSurface = dynamic(
  () => import('../components/Mars3dSurface').then((m) => m.Mars3dSurface),
  { ssr: false }
);

export default function Home() {
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [uiMode, setUiMode] = useState<UiMode>('grownup');
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [attemptedApiUrl, setAttemptedApiUrl] = useState('');

  useEffect(() => {
    setUiMode(loadUiMode());
    if (typeof window !== 'undefined') {
      setShareUrl(window.location.origin);
      setAttemptedApiUrl(`${getApiDisplayBase()}/api/regions/jezero_delta`);
    }
    api.region('jezero_delta').catch((e) => setError(String(e?.message ?? e)));
  }, []);

  const chooseMode = (next: UiMode) => {
    setUiMode(next);
    saveUiMode(next);
    if (next === 'junior') setShareOpen(false);
  };

  const copyShareUrl = () => {
    void safeCopyText(shareUrl || 'http://localhost:3000').then((ok) => {
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    });
  };

  if (started) {
    return (
      <MarsHudLoader
        regionId="jezero_delta"
        initialUiMode={uiMode}
        onQuit={() => setStarted(false)}
      />
    );
  }

  return (
    <main className="relative flex h-screen w-screen flex-col items-center justify-between overflow-hidden bg-[#0a0405] text-white select-none">
      {/* Bright sunlit 3D Jezero Vista Cinematic Flyover Backdrop */}
      <div className="fixed inset-0 z-0 opacity-90 pointer-events-none">
        <ErrorBoundary label="Title Backdrop">
          <Mars3dSurface
            isWalking={false}
            walkDistance={0}
            stepPhase={0}
            pitchOffset={-8}
            panOffset={0}
            headingDeg={35}
            visorTint="clear"
            viewMode="flyover"
            timeOfSol="noon"
            showTopoGrid={false}
            isTourPlaying={true}
            dustDevilsActive={true}
            zoomLevel={1}
          />
        </ErrorBoundary>
      </div>

      {/* Subtle Edge Contrast Scrim Only — leaves illuminated terrain clearly visible */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 48%, rgba(12,4,5,0.34) 0%, rgba(8,2,3,0.72) 100%)',
        }}
      />

      {/* Top Spacer */}
      <div className="relative z-10 w-full px-6 pt-5 flex items-center justify-between text-[11px] font-mono text-white/60">
        <span className="tracking-widest uppercase">JEZERO CRATER · 18.44°N 77.45°E</span>
        <span className="hidden sm:inline tracking-widest">USGS CTX 20 m · NASA PDS</span>
      </div>

      {/* Centerpieces: Title + Tagline + Primary Red CTA + Subtle Mode Pill */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-3xl w-full">
        <h1
          className="text-4xl sm:text-6xl md:text-7xl whitespace-nowrap font-black tracking-[0.12em] uppercase text-white drop-shadow-[0_4px_32px_rgba(255,59,48,0.45)]"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          REDNAV-<span className="text-[#FF3B30]">N399</span>
        </h1>

        <p className="mt-3 text-sm sm:text-base text-rose-100/90 font-mono tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]">
          Jezero Crater, Mars — real NASA data
        </p>

        {error && (
          <div className="w-full max-w-lg mt-5 rounded-xl border border-[#E5484D]/60 bg-[#1a0507]/90 backdrop-blur-md p-3.5 text-xs font-mono text-rose-100 text-left space-y-1">
            <div className="font-bold text-[#FF3B30]">Can&apos;t reach the Mars server</div>
            <div className="text-white/75 break-all">Tried: {attemptedApiUrl}</div>
            <div className="text-white/65">
              Start backend with <code>uvicorn app.main:app --host 0.0.0.0 --port 8000</code> and allow Windows Firewall if on Wi-Fi. ({error})
            </div>
          </div>
        )}

        <button
          onClick={() => setStarted(true)}
          className="mt-8 group px-10 py-4 rounded-xl bg-[#E5484D] hover:bg-[#FF3B30] text-white font-mono text-sm sm:text-base tracking-widest uppercase font-black shadow-[0_8px_35px_rgba(255,59,48,0.5)] transition-all duration-200 active:scale-95 cursor-pointer"
        >
          BEGIN THE MARSWALK{' '}
          <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
        </button>

        {/* Quiet Explorer Mode Toggle Underneath */}
        <div
          role="radiogroup"
          aria-label="Choose explorer mode"
          className="mt-5 inline-flex items-center rounded-full bg-black/60 backdrop-blur-md border border-white/15 p-1 text-xs font-mono"
        >
          <button
            type="button"
            role="radio"
            aria-checked={uiMode === 'grownup'}
            onClick={() => chooseMode('grownup')}
            className={`px-3.5 py-1.5 rounded-full transition ${
              uiMode === 'grownup'
                ? 'bg-[#E5484D] text-white font-bold shadow-[0_0_12px_rgba(255,59,48,0.45)]'
                : 'text-white/65 hover:text-white'
            }`}
          >
            Grown-up
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={uiMode === 'junior'}
            onClick={() => chooseMode('junior')}
            className={`px-3.5 py-1.5 rounded-full transition ${
              uiMode === 'junior'
                ? 'bg-[#E5484D] text-white font-bold shadow-[0_0_12px_rgba(255,59,48,0.45)]'
                : 'text-white/65 hover:text-white'
            }`}
          >
            Junior Astronaut
          </button>
        </div>
      </div>

      {/* Thin Bottom Footer Strip + Share Popover (hidden in Junior mode) */}
      <footer className="relative z-10 w-full px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-black/55 backdrop-blur-md text-[11px] font-mono text-white/65">
        <div className="flex items-center gap-3">
          <span>NASA Space Apps 2026</span>
          <span className="text-white/30">·</span>
          <span>NASA · USGS CTX</span>
          <span className="text-white/30">·</span>
          <span>v0.1.0</span>
        </div>

        {uiMode !== 'junior' && (
          <div className="relative">
            {shareOpen && (
              <div className="absolute right-0 bottom-9 w-72 rounded-xl border border-[#E5484D]/45 bg-[#0f0607]/95 backdrop-blur-xl p-3 shadow-2xl space-y-2 text-left">
                <div className="text-[10px] tracking-widest uppercase text-[#E5484D] font-bold">
                  Share this expedition
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    readOnly
                    value={shareUrl || 'http://localhost:3000'}
                    aria-label="Share URL"
                    className="flex-1 min-w-0 rounded bg-black/60 border border-white/15 px-2 py-1 text-[11px] text-white select-all"
                  />
                  <button
                    type="button"
                    onClick={copyShareUrl}
                    className="px-2.5 py-1 rounded bg-[#E5484D] hover:bg-[#FF3B30] text-white text-[11px] font-bold flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-[10px] text-white/55 leading-snug">
                  Run <code>share.bat</code> for a same-WiFi link, or <code>share-public.bat</code> for an internet link.
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShareOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#E5484D]/45 bg-white/5 hover:bg-[#E5484D]/25 text-white transition"
            >
              <Share2 className="w-3.5 h-3.5 text-[#E5484D]" />
              <span>Share</span>
            </button>
          </div>
        )}
      </footer>
    </main>
  );
}
