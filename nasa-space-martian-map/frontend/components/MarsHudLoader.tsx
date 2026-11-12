'use client';

import dynamic from 'next/dynamic';
import type { UiMode } from '../lib/juniorMode';
import { ErrorBoundary } from './ErrorBoundary';

const MarsHudApp = dynamic(() => import('./MarsHudApp'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-[#060405] text-[#ff8a8e] font-mono text-sm tracking-widest">
      INITIALIZING HELMET SYSTEMS…
    </div>
  ),
});

export default function MarsHudLoader({
  regionId,
  initialUiMode = 'grownup',
  onQuit,
}: {
  regionId: string;
  initialUiMode?: UiMode;
  onQuit?: () => void;
}) {
  return (
    <ErrorBoundary label="Mars HUD" onReset={onQuit}>
      <MarsHudApp regionId={regionId} initialUiMode={initialUiMode} onQuit={onQuit} />
    </ErrorBoundary>
  );
}
