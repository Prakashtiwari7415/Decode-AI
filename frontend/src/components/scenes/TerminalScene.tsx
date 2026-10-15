import React from 'react';
import { VisualSpec } from '../../types/lesson';

interface TerminalSceneProps {
  visual: VisualSpec;
  title: string;
}

export const TerminalScene: React.FC<TerminalSceneProps> = ({ visual, title }) => {
  const exitCode = visual.exit_code ?? 0;
  const isSuccess = exitCode === 0;

  return (
    <div className="w-full h-full flex flex-col justify-between p-6 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-xl overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            {title || 'Terminal Command & Verification'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-xs font-mono border ${
              isSuccess
                ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-400'
                : 'bg-rose-950/60 border-rose-800/60 text-rose-400'
            }`}
          >
            Exit Code: {exitCode}
          </span>
        </div>
      </div>

      {/* Terminal Window Box */}
      <div className="my-auto max-w-2xl mx-auto w-full rounded-xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden font-mono text-xs">
        {/* Window Chrome */}
        <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-green-500/80 inline-block" />
            <span className="text-slate-400 text-xs ml-2">bash — verification session</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">CLI Shell</span>
        </div>

        {/* Terminal Body */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="text-emerald-400 font-bold select-none">$</span>
            <span className="text-slate-100 font-mono">{visual.command || 'verify'}</span>
          </div>

          <div className="p-3 rounded bg-slate-900/60 border border-slate-800/80 text-emerald-300 space-y-1">
            <div className="text-[11px] text-slate-400"># Verification Output</div>
            <div className="font-semibold text-emerald-400 break-all font-mono">
              {visual.output || 'Verification completed successfully.'}
            </div>
          </div>

          {/* Dynamic Highlights / Badges Grid */}
          {visual.highlighted_terms.length > 0 && (
            <div className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
              <div className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-400">
                <span className="text-slate-500 block">Status</span>
                <span className="text-cyan-300 font-bold">
                  {isSuccess ? 'Verified / Success' : 'Failed'}
                </span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-400">
                <span className="text-slate-500 block">Focus Assertion</span>
                <span className="text-amber-300 font-bold truncate block">
                  {visual.highlighted_terms[0] || 'Clean Check'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 text-xs flex items-center justify-between">
        <span className="text-slate-400">Verification Result:</span>
        <span className="text-emerald-400 font-mono text-[11px]">
          Assertion confirmed (Exit {exitCode}).
        </span>
      </div>
    </div>
  );
};
