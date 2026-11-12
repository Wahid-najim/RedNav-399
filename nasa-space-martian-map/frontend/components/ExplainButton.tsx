'use client';

import React, { useState } from 'react';
import { glossaryFor } from '../lib/glossary';

/** One-tap "What is this?" explainer (§6a). Tap the word, get one
 *  plain sentence, then the full detail if wanted. */
export const ExplainButton: React.FC<{
  term: string;
  label?: string;
  placement?: 'down' | 'up';
  juniorMode?: boolean;
}> = ({ term, placement = 'down', juniorMode = false }) => {
  const [open, setOpen] = useState(false);
  const entry = glossaryFor(term);
  if (!entry) return null;
  const plainText = entry.plain;
  const detailText = juniorMode
    ? entry.detail
        .replace(/no-go/gi, 'too-steep')
        .replace(/caution slope/gi, 'bumpy hill')
        .replace(/caution/gi, 'bumpy')
    : entry.detail;
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="ml-1 inline-flex items-center rounded border border-[#E5484D]/50 bg-[#E5484D]/10 px-1.5 py-0 text-[10px] font-mono text-rose-200 hover:bg-[#E5484D]/25"
        aria-expanded={open}
        title={`What is ${entry.word}?`}
      >
        What is this?
      </button>
      {open && (
        <span className={`absolute left-0 ${placement === 'up' ? 'bottom-6' : 'top-5'} z-50 block w-72 rounded-xl border border-[#E5484D]/50 bg-[#081018] p-3 text-left shadow-xl`}>
          <span className="block text-xs font-bold text-white">{entry.word}</span>
          <span className="mt-1 block text-[11px] leading-snug text-white/85">{plainText}</span>
          <span className="mt-1 block text-[11px] leading-snug text-white/55">{detailText}</span>
          <button type="button" onClick={() => setOpen(false)} className="mt-2 text-[10px] font-mono text-[#ff8a8e] hover:underline">Close</button>
        </span>
      )}
    </span>
  );
};

/** Inline science word with a "What is this?" button after it. */
export const ExplainWord: React.FC<{ term: string }> = ({ term }) => {
  const entry = glossaryFor(term);
  return (
    <span className="inline-flex items-center">
      <span className="border-b border-dotted border-[#E5484D]/70">{entry?.word ?? term}</span>
      <ExplainButton term={term} />
    </span>
  );
};
