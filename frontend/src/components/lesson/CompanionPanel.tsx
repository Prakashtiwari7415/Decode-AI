import React, { useState } from 'react';
import { useLessonStore } from '../../stores/lessonStore';
import { VerificationImportance } from '../../types/lesson';

type CompanionTab = 'chapters' | 'glossary' | 'verification' | 'overview';

export const CompanionPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CompanionTab>('chapters');
  const {
    lesson,
    activeChapterIndex,
    activeSceneIndex,
    selectScene,
    checkedVerificationIds,
    toggleVerificationItem,
  } = useLessonStore();

  if (!lesson) return null;

  const getImportanceBadge = (importance: VerificationImportance) => {
    switch (importance) {
      case 'must-know':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
            Must-Know
          </span>
        );
      case 'caution':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Caution
          </span>
        );
      case 'nice-to-know':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            Nice-To-Know
          </span>
        );
    }
  };

  return (
    <aside className="w-full h-full flex flex-col bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl select-none">
      {/* Companion Tabs Header */}
      <div className="flex items-center border-b border-slate-800 bg-slate-950/60 p-1">
        <button
          onClick={() => setActiveTab('chapters')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'chapters'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <span>📑 Chapters</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-700/60 text-[10px] text-slate-300">
            {lesson.chapters.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('glossary')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'glossary'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <span>📖 Glossary</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-700/60 text-[10px] text-slate-300">
            {lesson.glossary.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('verification')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'verification'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <span>✅ Checklist</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-700/60 text-[10px] text-slate-300">
            {lesson.verification_checklist.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'overview'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <span>ℹ️ Overview</span>
        </button>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[580px]">
        {/* Verification Distinction Banner */}
        <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-900/50 text-[11px] text-indigo-300 leading-relaxed flex items-start gap-2.5">
          <span className="text-base shrink-0">🛡️</span>
          <div>
            <span className="font-semibold text-indigo-200 block">AI-Assisted Educational Lesson</span>
            All visuals and explanations are illustrative aids. DecodeAI never executes pasted code. Always independently verify against official documentation and unit test suites.
          </div>
        </div>

        {/* 1. Chapters Tab */}
        {activeTab === 'chapters' && (
          <div className="space-y-4">
            {lesson.chapters.map((chapter, cIdx) => (
              <div key={chapter.chapter_id} className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                <div className="p-3 bg-slate-900/80 border-b border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider font-bold">
                      Chapter {cIdx + 1}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {chapter.scenes.length} {chapter.scenes.length === 1 ? 'scene' : 'scenes'}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-200 mt-0.5">{chapter.title}</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-normal">{chapter.summary}</p>
                </div>

                <div className="p-2 space-y-1">
                  {chapter.scenes.map((sc, sIdx) => {
                    const isCurrent = activeChapterIndex === cIdx && activeSceneIndex === sIdx;

                    return (
                      <button
                        key={sc.scene_id}
                        onClick={() => selectScene(cIdx, sIdx)}
                        className={`w-full text-left p-2.5 rounded-lg text-xs flex items-center justify-between transition-all ${
                          isCurrent
                            ? 'bg-decodeai-primary/20 border border-decodeai-primary text-slate-100 shadow-md ring-1 ring-decodeai-primary/40'
                            : 'hover:bg-slate-900 text-slate-300 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-mono font-bold ${
                              isCurrent
                                ? 'bg-decodeai-primary text-white'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {sIdx + 1}
                          </span>
                          <div>
                            <span className="font-medium block leading-tight">{sc.title}</span>
                            <span className="text-[10px] text-slate-500 font-mono capitalize">
                              Mode: {sc.visual.scene_type.replace('_', ' ')}
                            </span>
                          </div>
                        </div>

                        {isCurrent && (
                          <span className="flex items-center gap-1 text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                            Playing
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 2. Glossary Tab */}
        {activeTab === 'glossary' && (
          <div className="space-y-3">
            {lesson.glossary.map((entry) => (
              <div
                key={entry.term}
                className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/70 space-y-2 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-indigo-300">{entry.term}</h4>
                  <span className="text-[10px] text-slate-500 font-mono">Glossary</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{entry.definition}</p>
                {entry.example && (
                  <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto">
                    <code>{entry.example}</code>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 3. Verification Checklist Tab */}
        {activeTab === 'verification' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              Track recommended sanity checks before applying changes to production:
            </p>

            {lesson.verification_checklist.map((item) => {
              const isChecked = !!checkedVerificationIds[item.id];

              return (
                <div
                  key={item.id}
                  onClick={() => toggleVerificationItem(item.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                    isChecked
                      ? 'bg-emerald-950/20 border-emerald-800/50 text-slate-200'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}} // handled by parent onClick
                    className="mt-0.5 rounded border-slate-700 text-decodeai-primary focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-500">#{item.id}</span>
                      {getImportanceBadge(item.importance)}
                    </div>
                    <p className={`text-xs leading-relaxed ${isChecked ? 'line-through text-slate-400' : ''}`}>
                      {item.statement}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 4. Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-3 text-xs">
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3">
              <h4 className="font-bold text-sm text-slate-100">{lesson.title}</h4>
              <div className="grid grid-cols-2 gap-3 text-slate-400">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Lesson ID</span>
                  <span className="font-mono text-slate-200">{lesson.lesson_id}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Language</span>
                  <span className="font-mono text-slate-200 uppercase">{lesson.language}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Runtime</span>
                  <span className="font-mono text-slate-200">
                    {Math.round(lesson.total_estimated_duration_ms / 1000)}s
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Model</span>
                  <span className="font-mono text-slate-200">{lesson.gemini_model_version}</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Keyboard Shortcuts</span>
              <div className="space-y-1 text-slate-300 font-mono text-[11px]">
                <div><span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200">Space</span> : Play / Pause</div>
                <div><span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200">←</span> / <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200">→</span> : Prev / Next Scene</div>
                <div><span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200">M</span> : Mute / Unmute Voice</div>
                <div><span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200">C</span> : Toggle Captions (CC)</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
