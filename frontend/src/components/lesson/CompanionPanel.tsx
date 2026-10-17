import React, { useState, useMemo } from 'react';
import { useLessonStore } from '../../stores/lessonStore';
import { VerificationImportance } from '../../types/lesson';

type CompanionTab = 'chapters' | 'notes' | 'practice';

export const CompanionPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CompanionTab>('chapters');
  const [revealedReviewIdx, setRevealedReviewIdx] = useState<number | null>(null);

  const {
    lesson,
    activeChapterIndex,
    activeSceneIndex,
    selectScene,
    checkedVerificationIds,
    toggleVerificationItem,
    getTotalScenes,
    getGlobalSceneIndex,
  } = useLessonStore();

  const currentScene = useMemo(() => {
    if (!lesson) return null;
    return lesson.chapters[activeChapterIndex]?.scenes[activeSceneIndex] || null;
  }, [lesson, activeChapterIndex, activeSceneIndex]);

  const totalScenes = getTotalScenes();
  const currentSceneNumber = getGlobalSceneIndex() + 1;
  const progressPercent = totalScenes > 0 ? Math.round((currentSceneNumber / totalScenes) * 100) : 0;

  // Derive short review questions based on lesson topic and checklist
  const reviewQuestions = useMemo(() => {
    if (!lesson) return [];
    const isJwt = lesson.title.toLowerCase().includes('jwt') || lesson.title.toLowerCase().includes('token');

    if (isJwt) {
      return [
        {
          question: 'What are the three main components of a JSON Web Token?',
          answer: 'The Header (algorithm & token type), the Payload (identity claims & metadata), and the Signature (cryptographic hash).',
        },
        {
          question: 'Why must sensitive secrets never be stored in an unencrypted JWT payload?',
          answer: 'JWT payloads are only Base64URL-encoded, not encrypted. Anyone who intercepts the token can decode and read the payload claims.',
        },
        {
          question: 'How does the server verify a token without storing session state?',
          answer: 'The server recomputes the HMAC/RSA signature using the header, payload, and secret key. If the hash matches the token signature, the claims are authentic.',
        },
      ];
    }

    // Default review questions for general/code lessons
    return lesson.verification_checklist.slice(0, 3).map((item, idx) => ({
      question: `Self-Check ${idx + 1}: How do you ensure safety regarding "${item.statement.slice(0, 50)}..."?`,
      answer: item.statement,
    }));
  }, [lesson]);

  if (!lesson) return null;

  const getImportanceBadge = (importance: VerificationImportance) => {
    switch (importance) {
      case 'must-know':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-300 border border-rose-500/20">
            Must-Know
          </span>
        );
      case 'caution':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/20">
            Caution
          </span>
        );
      case 'nice-to-know':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            Nice-To-Know
          </span>
        );
    }
  };

  const checkedCount = Object.values(checkedVerificationIds).filter(Boolean).length;

  return (
    <aside className="w-full h-full flex flex-col bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl select-none">
      {/* Companion Tabs Header - 3 Clean Tabs */}
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
          onClick={() => setActiveTab('notes')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'notes'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <span>📖 Notes</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-700/60 text-[10px] text-slate-300">
            {lesson.glossary.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('practice')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'practice'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <span>✅ Practice</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-700/60 text-[10px] text-slate-300">
            {checkedCount}/{lesson.verification_checklist.length}
          </span>
        </button>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[580px]">
        {/* 1. Chapters Tab */}
        {activeTab === 'chapters' && (
          <div className="space-y-4">
            {/* Overall Progress Summary */}
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Slide <strong className="text-slate-200">{currentSceneNumber}</strong> of {totalScenes}
              </span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-decodeai-primary transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="font-mono text-slate-300 font-semibold">{progressPercent}%</span>
              </div>
            </div>

            {lesson.chapters.map((chapter, cIdx) => (
              <div key={chapter.chapter_id} className="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden">
                <div className="px-3 py-2 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 truncate">
                    Chapter {cIdx + 1}: {chapter.title}
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono shrink-0">
                    {chapter.scenes.length} {chapter.scenes.length === 1 ? 'slide' : 'slides'}
                  </span>
                </div>

                <div className="p-2 space-y-1">
                  {chapter.scenes.map((sc, sIdx) => {
                    const isCurrent = activeChapterIndex === cIdx && activeSceneIndex === sIdx;

                    return (
                      <button
                        key={sc.scene_id}
                        onClick={() => selectScene(cIdx, sIdx)}
                        className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition-all ${
                          isCurrent
                            ? 'bg-decodeai-primary/20 border border-decodeai-primary/80 text-slate-100 shadow-sm'
                            : 'hover:bg-slate-900/80 text-slate-300 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-bold shrink-0 ${
                              isCurrent
                                ? 'bg-decodeai-primary text-white'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {sIdx + 1}
                          </span>
                          <span className="font-medium truncate block">{sc.title}</span>
                        </div>

                        <span className="text-[10px] text-slate-500 font-mono capitalize shrink-0 ml-2">
                          {sc.visual.scene_type.replace('_', ' ')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 2. Notes Tab (Glossary + Key Concept Notes) */}
        {activeTab === 'notes' && (
          <div className="space-y-4">
            {/* Active Scene Key Takeaway */}
            {currentScene && (
              <div className="p-3.5 rounded-xl border border-indigo-500/20 bg-indigo-950/20 space-y-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400 block">
                  Active Slide Takeaway
                </span>
                <h4 className="text-xs font-bold text-slate-200">{currentScene.title}</h4>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  {currentScene.narration_text}
                </p>
              </div>
            )}

            {/* Glossary Entries */}
            <div className="space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                Technical Glossary ({lesson.glossary.length} terms)
              </span>
              {lesson.glossary.map((entry) => (
                <div
                  key={entry.term}
                  className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 space-y-1.5"
                >
                  <h4 className="text-xs font-bold text-indigo-300">{entry.term}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">{entry.definition}</p>
                  {entry.example && (
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto">
                      <code>{entry.example}</code>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Practice Tab (Checklist + Review Questions) */}
        {activeTab === 'practice' && (
          <div className="space-y-4">
            {/* Verification Checklist */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Verification Checklist
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {checkedCount} / {lesson.verification_checklist.length} completed
                </span>
              </div>

              {lesson.verification_checklist.map((item) => {
                const isChecked = !!checkedVerificationIds[item.id];

                return (
                  <div
                    key={item.id}
                    onClick={() => toggleVerificationItem(item.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 select-none ${
                      isChecked
                        ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-200'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="mt-0.5 rounded border-slate-700 text-decodeai-primary focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-1">
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

            {/* Review Questions / Self-Check */}
            {reviewQuestions.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-slate-800">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                  Knowledge Self-Check ({reviewQuestions.length} questions)
                </span>
                {reviewQuestions.map((rq, idx) => {
                  const isRevealed = revealedReviewIdx === idx;

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2 text-xs"
                    >
                      <p className="font-semibold text-slate-200">
                        {idx + 1}. {rq.question}
                      </p>
                      <button
                        onClick={() => setRevealedReviewIdx(isRevealed ? null : idx)}
                        className="text-[11px] font-mono text-cyan-400 hover:underline block"
                      >
                        {isRevealed ? 'Hide Answer' : '▶ Reveal Answer'}
                      </button>
                      {isRevealed && (
                        <div className="p-2 rounded bg-slate-900 border border-slate-800 text-emerald-300 leading-relaxed font-sans text-xs">
                          {rq.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Safety Notice Footer */}
      <div className="px-3 py-2 bg-slate-950 border-t border-slate-800/80 text-[10px] text-slate-500 text-center font-sans">
        🛡️ Static analysis & educational models only. DecodeAI never executes pasted code.
      </div>
    </aside>
  );
};
