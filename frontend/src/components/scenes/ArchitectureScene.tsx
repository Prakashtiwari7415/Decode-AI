import React, { useMemo } from 'react';
import { VisualSpec } from '../../types/lesson';
import { useLessonStore } from '../../stores/lessonStore';

interface ArchitectureSceneProps {
  visual: VisualSpec;
  title: string;
  narrationText?: string;
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

/**
 * Extracts architecture pipeline nodes from Mermaid definition or highlighted terms.
 */
function parseDiagramNodes(mermaid?: string, highlightedTerms?: string[]): NodeInfo[] {
  const icons = ['💻', '🛡️', '⚡', '🔐', '📦', '🌐', '🗄️'];

  if (mermaid && mermaid.trim()) {
    // Matches patterns like `NodeId[Label]` or `NodeId[(Label)]` or `NodeId([Label])`
    const nodeRegex = /([a-zA-Z0-9_-]+)\[+([^\]]+)\]+/g;
    const matches: { id: string; name: string }[] = [];
    const seen = new Set<string>();
    let m;

    while ((m = nodeRegex.exec(mermaid)) !== null) {
      const id = m[1].trim();
      let name = m[2].trim();
      // Strip formatting parentheses or quotes
      name = name.replace(/^[(["]+|[)\]"]+$/g, '').trim();

      if (!seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        matches.push({ id, name });
      }
    }

    if (matches.length >= 2) {
      const total = matches.length;
      return matches.map((item, idx) => {
        const phase = total <= 3 ? idx : Math.min(2, Math.floor((idx / total) * 3));
        let category = 'Processing Layer';
        let role = 'Processes data';

        if (idx === 0) {
          category = 'Client / Initiator';
          role = 'Initiates request';
        } else if (idx === total - 1) {
          category = 'Target / Storage';
          role = 'Secures & fulfills';
        } else if (item.name.toLowerCase().includes('auth') || item.name.toLowerCase().includes('api')) {
          category = 'Gateway / Auth';
          role = 'Validates credentials & routes';
        }

        return {
          id: item.id,
          name: item.name,
          category,
          role,
          metric: `Step ${idx + 1}`,
          icon: icons[idx % icons.length],
          phase,
        };
      });
    }
  }

  // Check if highlighted terms match Python VM / Developer Client pipeline
  if (
    highlightedTerms &&
    highlightedTerms.some((t) =>
      ['developer client', 'python vm engine', 'api gateway'].includes(t.toLowerCase())
    )
  ) {
    return [
      {
        id: 'client',
        name: 'Developer Client',
        category: 'Client Layer',
        role: 'Inputs prompt / code',
        metric: 'Step 1',
        icon: '💻',
        phase: 0,
      },
      {
        id: 'frontend',
        name: 'DecodeAI Frontend',
        category: 'Presentation',
        role: 'React + Vite UI',
        metric: 'Step 2',
        icon: '⚛️',
        phase: 0,
      },
      {
        id: 'api',
        name: 'API Gateway',
        category: 'Routing & Auth',
        role: 'FastAPI / Pydantic',
        metric: 'Step 3',
        icon: '⚡',
        phase: 1,
      },
      {
        id: 'engine',
        name: 'Python VM Engine',
        category: 'Compilation',
        role: 'AST & Bytecode evaluation',
        metric: 'Step 4',
        icon: '🐍',
        phase: 1,
      },
      {
        id: 'memory',
        name: 'Memory Store',
        category: 'Storage / Buffer',
        role: 'Pre-sized array allocation',
        metric: 'Step 5',
        icon: '📦',
        phase: 2,
      },
    ];
  }

  // Check if highlighted terms match JWT pipeline
  if (
    highlightedTerms &&
    highlightedTerms.some((t) =>
      ['jwt', 'token', 'auth server', 'resource api', 'bearer token'].includes(t.toLowerCase())
    )
  ) {
    return [
      {
        id: 'client',
        name: 'Client App',
        category: 'Client Layer',
        role: 'Submits user credentials & sends Bearer token',
        metric: 'Step 1',
        icon: '💻',
        phase: 0,
      },
      {
        id: 'auth',
        name: 'Auth Server',
        category: 'Authentication',
        role: 'Verifies credentials and issues signed JWT',
        metric: 'Step 2',
        icon: '🛡️',
        phase: 1,
      },
      {
        id: 'api',
        name: 'Resource API',
        category: 'Service Gateway',
        role: 'Validates signature and claims',
        metric: 'Step 3',
        icon: '⚡',
        phase: 1,
      },
      {
        id: 'protected',
        name: 'Protected Resource',
        category: 'Data Store',
        role: 'Returns authorized payload',
        metric: 'Step 4',
        icon: '🔐',
        phase: 2,
      },
    ];
  }

  // Fallback to highlighted terms if present
  if (highlightedTerms && highlightedTerms.length >= 2) {
    const total = Math.min(highlightedTerms.length, 5);
    return highlightedTerms.slice(0, 5).map((term, idx) => {
      const phase = Math.min(2, Math.floor((idx / total) * 3));
      return {
        id: `node-${idx}`,
        name: term,
        category: idx === 0 ? 'Client / Entry' : idx === total - 1 ? 'Target Output' : 'Service Layer',
        role: `Handles ${term}`,
        metric: `Step ${idx + 1}`,
        icon: icons[idx % icons.length],
        phase,
      };
    });
  }

  // Default generic architecture nodes
  return [
    {
      id: 'client',
      name: 'Client App',
      category: 'Client Layer',
      role: 'Initiates request',
      metric: 'Step 1',
      icon: '💻',
      phase: 0,
    },
    {
      id: 'gateway',
      name: 'Service Gateway',
      category: 'Validation & Auth',
      role: 'Verifies & routes',
      metric: 'Step 2',
      icon: '⚡',
      phase: 1,
    },
    {
      id: 'resource',
      name: 'Protected Resource',
      category: 'Data & Services',
      role: 'Secures and serves data',
      metric: 'Step 3',
      icon: '📦',
      phase: 2,
    },
  ];
}

export const ArchitectureScene: React.FC<ArchitectureSceneProps> = ({ visual, title }) => {
  const { sceneElapsedMs, activeSceneDurationMs, activeHighlightTerm } = useLessonStore();

  const nodes = useMemo(
    () => parseDiagramNodes(visual.mermaid_definition, visual.highlighted_terms),
    [visual.mermaid_definition, visual.highlighted_terms]
  );

  // Dynamically determine current active phase coordinated with spoken term or elapsed progress
  const currentPhase = useMemo(() => {
    if (activeHighlightTerm) {
      const lower = activeHighlightTerm.toLowerCase();
      const matchedNode = nodes.find(
        (n) => n.name.toLowerCase().includes(lower) || n.role.toLowerCase().includes(lower)
      );
      if (matchedNode) return matchedNode.phase;
    }

    const duration =
      activeSceneDurationMs && activeSceneDurationMs > 0 ? activeSceneDurationMs : 6000;
    const ratio = Math.max(0, Math.min(1, sceneElapsedMs / duration));
    if (ratio < 0.33) return 0;
    if (ratio < 0.67) return 1;
    return 2;
  }, [sceneElapsedMs, activeSceneDurationMs, activeHighlightTerm, nodes]);

  return (
    <div className="w-full h-full flex flex-col justify-between p-6 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-xl overflow-hidden select-none">
      {/* Top Scene Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
            {title || 'System Architecture & Request Flow'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60">
            Phase {currentPhase + 1} of 3
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-emerald-400">Request Pipeline</span>
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
        <div
          className={`grid gap-4 relative z-10 ${
            nodes.length <= 3
              ? 'grid-cols-1 sm:grid-cols-3'
              : nodes.length === 4
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5'
          }`}
        >
          {nodes.map((node) => {
            const isDirectlyMentioned = Boolean(
              activeHighlightTerm &&
                (node.name.toLowerCase().includes(activeHighlightTerm.toLowerCase()) ||
                  node.role.toLowerCase().includes(activeHighlightTerm.toLowerCase()))
            );
            const isActive = isDirectlyMentioned || node.phase === currentPhase;
            const isCompleted = !isDirectlyMentioned && node.phase < currentPhase;

            return (
              <div
                key={node.id}
                className={`flex flex-col justify-between p-4 rounded-xl border transition-all duration-500 backdrop-blur-sm ${
                  isActive
                    ? 'bg-slate-900 border-cyan-400 ring-2 ring-cyan-400/40 shadow-xl shadow-cyan-950/50 scale-105'
                    : isCompleted
                    ? 'bg-slate-950/90 border-emerald-500/50 shadow-md'
                    : 'bg-slate-950/60 border-slate-800 opacity-70'
                }`}
              >
                {/* Node Header */}
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{node.icon}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold ${
                      isActive
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : isCompleted
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {node.metric}
                  </span>
                </div>

                {/* Node Title & Role */}
                <div className="space-y-1 my-3">
                  <h4
                    className={`text-sm font-bold tracking-tight ${
                      isActive ? 'text-cyan-200' : isCompleted ? 'text-slate-200' : 'text-slate-400'
                    }`}
                  >
                    {node.name}
                  </h4>
                  <span className="text-[11px] text-slate-400 block font-medium">
                    {node.category}
                  </span>
                  <p className="text-[11px] text-slate-400 leading-snug">{node.role}</p>
                </div>

                {/* Node Status Indicator */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Status</span>
                  <span
                    className={`font-mono font-semibold ${
                      isActive
                        ? 'text-cyan-400'
                        : isCompleted
                        ? 'text-emerald-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {isActive ? 'Processing' : isCompleted ? 'Verified' : 'Waiting'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Info Strip */}
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 text-xs flex items-center justify-between">
        <span className="text-slate-400">Active Flow Phase:</span>
        <span className="text-cyan-300 font-mono text-[11px]">
          {nodes.find((n) => n.phase === currentPhase)?.name || 'Pipeline Processing'} (Phase {currentPhase + 1})
        </span>
      </div>
    </div>
  );
};
