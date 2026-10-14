import React, { useMemo } from 'react';
import { VisualSpec } from '../../types/lesson';
import { useLessonStore } from '../../stores/lessonStore';

interface ArchitectureSceneProps {
  visual: VisualSpec;
  title: string;
}

interface NodeInfo {
  id: string;
  name: string;
  category: string;
  role: string;
  metric: string;
  icon: string;
  phase: number; // 0, 1, or 2
}

export const ArchitectureScene: React.FC<ArchitectureSceneProps> = ({ visual, title }) => {
  const { sceneElapsedMs } = useLessonStore();

  // Nodes in the pipeline
  const nodes: NodeInfo[] = useMemo(
    () => [
      {
        id: 'client',
        name: 'Developer Client',
        category: 'Client Layer',
        role: 'Inputs prompt / code',
        metric: 'HTTP/2 TLS',
        icon: '💻',
        phase: 0,
      },
      {
        id: 'frontend',
        name: 'DecodeAI Frontend',
        category: 'Presentation',
        role: 'React + Vite UI',
        metric: 'Port 5173',
        icon: '⚛️',
        phase: 0,
      },
      {
        id: 'api',
        name: 'API Gateway',
        category: 'Routing & Auth',
        role: 'FastAPI / Pydantic',
        metric: '< 15ms latency',
        icon: '⚡',
        phase: 1,
      },
      {
        id: 'engine',
        name: 'Python VM Engine',
        category: 'Compilation',
        role: 'AST & Bytecode evaluation',
        metric: 'C-level loops',
        icon: '🐍',
        phase: 1,
      },
      {
        id: 'memory',
        name: 'Memory Store',
        category: 'Storage / Buffer',
        role: 'Pre-sized array allocation',
        metric: 'O(1) append',
        icon: '📦',
        phase: 2,
      },
    ],
    []
  );

  // Determine current active phase based on elapsed time (assumes ~9000ms duration)
  const currentPhase = useMemo(() => {
    if (sceneElapsedMs < 3000) return 0;
    if (sceneElapsedMs < 6000) return 1;
    return 2;
  }, [sceneElapsedMs]);

  return (
    <div className="w-full h-full flex flex-col justify-between p-6 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-xl overflow-hidden select-none">
      {/* Top Scene Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
            {title || 'System Architecture & Data Flow'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60">
            Phase {currentPhase + 1} of 3
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-emerald-400">Live Request Pipeline</span>
        </div>
      </div>

      {/* Main Diagram Canvas */}
      <div className="relative my-auto py-4">
        {/* Background Connection Path (SVG) */}
        <div className="hidden lg:block absolute inset-0 pointer-events-none z-0">
          <svg className="w-full h-full" preserveAspectRatio="none">
            <line
              x1="10%"
              y1="50%"
              x2="90%"
              y2="50%"
              stroke="#334155"
              strokeWidth="4"
              strokeDasharray="6 6"
            />
            {/* Animated active flow line */}
            <line
              x1="10%"
              y1="50%"
              x2={currentPhase === 0 ? '40%' : currentPhase === 1 ? '70%' : '90%'}
              y2="50%"
              stroke="#22d3ee"
              strokeWidth="4"
              className="animate-flow-dash transition-all duration-700"
            />
          </svg>
        </div>

        {/* Node Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 relative z-10">
          {nodes.map((node) => {
            const isActive = node.phase === currentPhase;
            const isCompleted = node.phase < currentPhase;

            return (
              <div
                key={node.id}
                className={`relative flex flex-col justify-between p-4 rounded-xl border transition-all duration-500 ${
                  isActive
                    ? 'bg-slate-900/90 border-cyan-400 shadow-lg shadow-cyan-500/20 scale-105 ring-2 ring-cyan-400/30'
                    : isCompleted
                    ? 'bg-slate-950/90 border-indigo-500/50 text-slate-300'
                    : 'bg-slate-950/60 border-slate-800/80 opacity-75'
                }`}
              >
                {/* Node Status Badge */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{node.icon}</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                      isActive
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : isCompleted
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isActive ? '● Processing' : isCompleted ? '✓ Done' : 'Waiting'}
                  </span>
                </div>

                {/* Node Info */}
                <div className="space-y-1 mb-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                    {node.category}
                  </span>
                  <h4 className="text-sm font-bold text-slate-100 leading-tight">{node.name}</h4>
                  <p className="text-xs text-slate-400 leading-snug">{node.role}</p>
                </div>

                {/* Node Metric Footer */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Metric</span>
                  <span className={isActive ? 'text-cyan-300 font-bold' : 'text-slate-400'}>
                    {node.metric}
                  </span>
                </div>

                {/* Animated Packet indicator for active node */}
                {isActive && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500" />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Scene Context Footer */}
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 text-xs text-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-indigo-400 font-semibold">Active Pipeline Stage:</span>
          <span className="text-slate-200">
            {currentPhase === 0
              ? 'Stage 1: User input ingested by React frontend & transmitted via TLS'
              : currentPhase === 1
              ? 'Stage 2: FastAPI routes payload to Python Engine for AST compilation'
              : 'Stage 3: Memory pre-allocation completes; declarative list returned'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {visual.highlighted_terms.slice(0, 3).map((term) => (
            <span
              key={term}
              className="px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/60 text-indigo-300 font-mono text-[10px]"
            >
              {term}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
