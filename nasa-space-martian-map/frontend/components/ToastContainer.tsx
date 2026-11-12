'use client';

import React from 'react';
import { Info, CheckCircle2, AlertTriangle } from 'lucide-react';

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'info' | 'success' | 'warning';
}

interface Props {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<Props> = ({ toasts, onDismiss }) => {
  if (!toasts.length) return null;

  return (
    <div className="fixed top-16 right-8 z-[80] flex flex-col gap-2 pointer-events-none select-none font-mono">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border backdrop-blur-md shadow-lg pointer-events-auto transition-all animate-fadeIn text-xs ${
            t.type === 'success'
              ? 'border-emerald-400/40 bg-emerald-950/80 text-emerald-200'
              : t.type === 'warning'
              ? 'border-amber-400/40 bg-amber-950/80 text-amber-200'
              : 'border-[#E5484D]/50 bg-slate-950/85 text-rose-200'
          }`}
          onClick={() => onDismiss(t.id)}
        >
          {t.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : t.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-[#E5484D] shrink-0" />
          )}
          <span className="tracking-wide font-bold">{t.text}</span>
        </div>
      ))}
    </div>
  );
};

