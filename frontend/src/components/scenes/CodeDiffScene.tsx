import React, { useState, useMemo } from 'react';
import { VisualSpec } from '../../types/lesson';
import { useLessonStore } from '../../stores/lessonStore';

interface CodeDiffSceneProps {
  visual: VisualSpec;
  title: string;
}

export const CodeDiffScene: React.FC<CodeDiffSceneProps> = ({ visual, title }) => {
  const { sceneElapsedMs, activeSceneDurationMs, activeHighlightTerm } = useLessonStore();
  const [copied, setCopied] = useState<boolean>(false);

  const beforeLines = useMemo(
    () => (visual.before_code ? visual.before_code.split('\n') : []),
    [visual.before_code]
  );
  const afterLines = useMemo(
    () => (visual.after_code ? visual.after_code.split('\n') : []),
    [visual.after_code]
  );

  // Determine active highlight step dynamically based on calibrated scene duration
  const totalDuration =
    activeSceneDurationMs && activeSceneDurationMs > 0 ? activeSceneDurationMs : 6000;
  const isSecondPhase = sceneElapsedMs >= totalDuration * 0.5;

  const isJson = visual.language?.toLowerCase() === 'json' || visual.after_code?.trim().startsWith('{');

  // Generic syntax highlighter supporting Python, JSON, JavaScript, TypeScript
  const renderSyntaxHighlighted = (codeLine: string) => {
    // Tokenize strings, numbers, punctuation, keywords
    const tokens = codeLine.split(/(\s+|"[\s\S]*?"|'[\s\S]*?'|[(),:[\]{} =+\-*])/);

    return tokens.map((token, index) => {
      const lower = token.toLowerCase();
      const isString = /^"[\s\S]*?"$/.test(token) || /^'[\s\S]*?'$/.test(token);
      const isKeyword = [
        'for', 'in', 'if', 'else', 'def', 'return', 'while', 'import', 'from',
        'const', 'let', 'var', 'function', 'class', 'true', 'false', 'null',
      ].includes(lower);
      const isNumber = /^\d+$/.test(token);
      const isHighlightedTerm = visual.highlighted_terms.some(
        (term) => term.toLowerCase() === lower.replace(/["':]/g, '')
      );
      const isActivelySpokenTerm = Boolean(
        activeHighlightTerm && activeHighlightTerm.toLowerCase() === lower.replace(/["':]/g, '')
      );

      if (isActivelySpokenTerm) {
        return (
          <span
            key={index}
            className="text-cyan-200 bg-cyan-950/80 px-1 py-0.5 rounded ring-1 ring-cyan-400 font-bold shadow-sm shadow-cyan-500/50"
          >
            {token}
          </span>
        );
      }
      if (isString) {
        // Distinguish JSON property keys from values
        const isJsonKey = isJson && token.endsWith(':');
        return (
          <span
            key={index}
            className={isJsonKey ? 'text-indigo-300 font-semibold' : 'text-emerald-300'}
          >
            {token}
          </span>
        );
      }
      if (isKeyword) {
        return (
          <span key={index} className="text-purple-400 font-semibold">
            {token}
          </span>
        );
      }
      if (isNumber) {
        return (
          <span key={index} className="text-amber-300">
            {token}
          </span>
        );
      }
      if (isHighlightedTerm) {
        return (
          <span
            key={index}
            className="text-emerald-300 underline decoration-emerald-500/80 decoration-2 font-medium"
          >
            {token}
          </span>
        );
      }
      return (
        <span key={index} className="text-slate-200">
          {token}
        </span>
      );
    });
  };

  const handleCopy = () => {
    const textToCopy = visual.after_code || visual.before_code || '';
    if (textToCopy && navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const beforeHeading = beforeLines[0]?.startsWith('//')
    ? beforeLines[0].replace(/^\/\/\s*/, '')
    : visual.language === 'python'
    ? 'Before: Traditional Imperative Loop'
    : 'Input / Initial State';

  const afterHeading = afterLines[0]?.startsWith('//')
    ? afterLines[0].replace(/^\/\/\s*/, '')
    : visual.language === 'python'
    ? 'After: Declarative List Comprehension'
    : 'Result / Target Structure';

  return (
    <div className="w-full h-full flex flex-col justify-between p-6 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-xl overflow-hidden select-none">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            {title || 'Structure & Code Comparison'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-mono hidden sm:inline">
            Language: <span className="text-slate-200 uppercase">{visual.language || 'code'}</span>
          </span>
          <button
            onClick={handleCopy}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors"
            title="Copy snippet"
          >
            {copied ? '✓ Copied' : 'Copy Code'}
          </button>
        </div>
      </div>

      {/* Code Diff Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-auto py-2">
        {/* Before Block */}
        <div className="flex flex-col rounded-lg border border-red-900/40 bg-slate-950/80 overflow-hidden shadow-md">
          <div className="flex items-center justify-between px-3 py-2 bg-red-950/30 border-b border-red-900/30 text-xs">
            <span className="font-semibold text-red-400 flex items-center gap-1.5 truncate">
              <span>−</span> {beforeHeading}
            </span>
            <span className="text-[10px] font-mono text-slate-500 shrink-0">
              {beforeLines.length} {beforeLines.length === 1 ? 'line' : 'lines'}
            </span>
          </div>

          <div className="p-3 font-mono text-xs overflow-x-auto space-y-1 max-h-[220px]">
            {beforeLines.map((line, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 px-2 py-0.5 rounded text-slate-400"
              >
                <span className="text-slate-600 w-4 text-right select-none">{idx + 1}</span>
                <div className="flex-1 whitespace-pre">{renderSyntaxHighlighted(line)}</div>
              </div>
            ))}
          </div>

          <div className="px-3 py-1.5 bg-slate-950 border-t border-slate-900 text-[11px] text-slate-400 font-sans">
            Source payload representation before decoding or transformation.
          </div>
        </div>

        {/* After Block */}
        <div
          className={`flex flex-col rounded-lg border transition-all duration-500 bg-slate-950/80 overflow-hidden shadow-lg ${
            isSecondPhase
              ? 'border-emerald-500/80 ring-2 ring-emerald-500/30 shadow-emerald-950/40'
              : 'border-emerald-900/40'
          }`}
        >
          <div className="flex items-center justify-between px-3 py-2 bg-emerald-950/30 border-b border-emerald-900/30 text-xs">
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5 truncate">
              <span>+</span> {afterHeading}
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold shrink-0">
              {afterLines.length} {afterLines.length === 1 ? 'line' : 'lines'}
            </span>
          </div>

          <div className="p-3 font-mono text-xs overflow-x-auto space-y-1 max-h-[220px]">
            {afterLines.map((line, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 px-2 py-0.5 rounded bg-emerald-950/20 text-emerald-200 border-l-2 border-emerald-400"
              >
                <span className="text-emerald-500/60 w-4 text-right select-none">{idx + 1}</span>
                <div className="flex-1 whitespace-pre">{renderSyntaxHighlighted(line)}</div>
              </div>
            ))}
          </div>

          <div className="px-3 py-1.5 bg-slate-950 border-t border-slate-900 text-[11px] text-emerald-300 font-sans flex items-center justify-between">
            <span>Verified target structure and attributes.</span>
            <span className="font-mono text-[10px] bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800">
              Parsed
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Key Tokens & Takeaway */}
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Highlighted Terms:</span>
          <div className="flex flex-wrap gap-1.5">
            {visual.highlighted_terms.map((term) => (
              <span
                key={term}
                className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px]"
              >
                {term}
              </span>
            ))}
          </div>
        </div>
        <div className="text-slate-400 font-mono text-[11px]">
          Format: <span className="text-emerald-400 uppercase">{visual.language || 'code'}</span>
        </div>
      </div>
    </div>
  );
};
