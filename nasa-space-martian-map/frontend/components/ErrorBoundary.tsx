'use client';

import React from 'react';
import { TriangleAlert, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Error boundary wrapping complex interactive views (3D, Map, Science Pod) so one
 * component exception never white-screens the app.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; label?: string; onReset?: () => void },
  State
> {
  constructor(props: { children: React.ReactNode; label?: string; onReset?: () => void }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Unexpected rendering error',
    };
  }

  componentDidCatch(error: Error) {
    console.error('[RedNav ErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#080405] text-white p-6 font-mono">
          <div className="max-w-md w-full rounded-2xl border border-[#E5484D]/50 bg-[#120607]/95 p-6 text-center space-y-4 shadow-[0_0_40px_rgba(255,59,48,0.25)]">
            <TriangleAlert className="w-8 h-8 text-[#FF3B30] mx-auto" />
            <div className="text-sm font-bold tracking-wider uppercase text-[#ff7b7e]">
              {this.props.label ? `${this.props.label} interrupted` : 'View interrupted'}
            </div>
            <p className="text-xs text-white/75 leading-relaxed break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                this.props.onReset?.();
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#E5484D] hover:bg-[#FF3B30] text-white font-bold text-xs tracking-wider transition"
            >
              <RotateCcw className="w-4 h-4" />
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

