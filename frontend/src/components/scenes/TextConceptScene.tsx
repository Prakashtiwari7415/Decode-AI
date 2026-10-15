import React from 'react';
import { VisualSpec } from '../../types/lesson';
import { useLessonStore } from '../../stores/lessonStore';

interface TextConceptSceneProps {
  visual: VisualSpec;
  title: string;
  narrationText?: string;
  whatToVerify?: string[];
}

export const TextConceptScene: React.FC<TextConceptSceneProps> = ({
  visual,
  title,
  narrationText,
  whatToVerify,
}) => {
  const { activeHighlightTerm, setActiveHighlightTerm } = useLessonStore();

  const explanation = narrationText || 'Understanding key architectural concepts and design patterns.';

  return (
    <div className="w-full h-full flex flex-col justify-between p-6 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-xl overflow-hidden select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
            Core Concept Breakdown
          </span>
        </div>
        <span className="text-xs text-slate-400 font-mono">Foundations</span>
      </div>

      {/* Main Concept Card */}
      <div className="my-auto max-w-3xl mx-auto w-full space-y-5">
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xl text-indigo-400 font-bold shrink-0">
              💡
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">{title}</h3>
              <p className="text-xs text-slate-400">Core architectural principle & technical objective</p>
            </div>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed font-sans">
            {explanation}
          </p>

          {/* Key Principles Grid derived from highlighted terms or verification checks */}
          {visual.highlighted_terms.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {visual.highlighted_terms.slice(0, 3).map((term, idx) => {
                const borderColors = [
                  'border-indigo-800/80 text-indigo-400',
                  'border-cyan-800/80 text-cyan-400',
                  'border-emerald-800/80 text-emerald-400',
                ];
                const colorClass = borderColors[idx % borderColors.length];

                return (
                  <div
                    key={term}
                    className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1"
                  >
                    <span className={`text-xs font-bold block ${colorClass.split(' ')[1]}`}>
                      {idx + 1}. {term}
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Key architectural concept highlighted in current scene.
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Verification Advice if available */}
          {whatToVerify && whatToVerify.length > 0 && (
            <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-900/40 text-xs text-indigo-300 flex items-start gap-2">
              <span className="shrink-0 text-indigo-400">🔍</span>
              <div>
                <strong className="text-slate-200">Recommended Check:</strong>{' '}
                {whatToVerify[0]}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Highlighted Terms Footer */}
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 text-xs flex items-center justify-between">
        <span className="text-slate-400">Key Vocabulary:</span>
        <div className="flex flex-wrap gap-2">
          {visual.highlighted_terms.map((term) => {
            const isSpoken = Boolean(
              activeHighlightTerm && activeHighlightTerm.toLowerCase() === term.toLowerCase()
            );

            return (
              <button
                key={term}
                onClick={() => setActiveHighlightTerm(term)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  isSpoken
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 ring-1 ring-cyan-400 shadow-md shadow-cyan-500/30 scale-105'
                    : 'bg-indigo-950/50 hover:bg-indigo-900/60 border border-indigo-800/60 text-indigo-300'
                }`}
              >
                🔍 {term}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
