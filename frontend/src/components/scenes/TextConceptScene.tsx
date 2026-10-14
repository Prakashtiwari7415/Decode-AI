import React from 'react';
import { VisualSpec } from '../../types/lesson';
import { useLessonStore } from '../../stores/lessonStore';

interface TextConceptSceneProps {
  visual: VisualSpec;
  title: string;
}

export const TextConceptScene: React.FC<TextConceptSceneProps> = ({ visual, title }) => {
  const { setActiveHighlightTerm } = useLessonStore();

  return (
    <div className="w-full h-full flex flex-col justify-between p-6 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-xl overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
            Core Concept Breakdown
          </span>
        </div>
        <span className="text-xs text-slate-400 font-mono">Foundations</span>
      </div>

      {/* Main Content Card */}
      <div className="my-auto max-w-2xl mx-auto w-full space-y-5">
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xl text-indigo-400 font-bold">
              💡
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">{title}</h3>
              <p className="text-xs text-slate-400">Declarative, readable data transformations in Python</p>
            </div>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed">
            Instead of manually creating an empty list, looping over elements, and pushing transformed items via{' '}
            <code className="text-purple-300 bg-purple-950/40 px-1.5 py-0.5 rounded font-mono text-xs">.append()</code>,
            a comprehension declares the transformation in a single concise mathematical expression.
          </p>

          {/* Key Principles Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1">
              <span className="text-xs font-bold text-indigo-400 block">1. Conciseness</span>
              <p className="text-[11px] text-slate-400">Replaces multi-line boilerplate with one line</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1">
              <span className="text-xs font-bold text-cyan-400 block">2. Performance</span>
              <p className="text-[11px] text-slate-400">Executes at C-speed in the Python virtual machine</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1">
              <span className="text-xs font-bold text-emerald-400 block">3. Immutability</span>
              <p className="text-[11px] text-slate-400">Creates a fresh list without mutating source</p>
            </div>
          </div>
        </div>
      </div>

      {/* Highlighted Terms Footer */}
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 text-xs flex items-center justify-between">
        <span className="text-slate-400">Key Vocabulary:</span>
        <div className="flex flex-wrap gap-2">
          {visual.highlighted_terms.map((term) => (
            <button
              key={term}
              onClick={() => setActiveHighlightTerm(term)}
              className="px-2.5 py-1 rounded bg-indigo-950/50 hover:bg-indigo-900/60 border border-indigo-800/60 text-indigo-300 text-xs font-medium transition-colors"
            >
              🔍 {term}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
