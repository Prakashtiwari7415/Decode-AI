import React, { useEffect, useRef } from 'react';
import { Language } from '../../types/lesson';

export interface ExampleTopic {
  id: 'jwt' | 'python';
  title: string;
  category: string;
  badge: string;
  summary: string;
  details: string;
  durationEstimate: string;
  scenesCount: number;
  chaptersCount: number;
  sampleSnippet: string;
}

export const EXAMPLE_TOPICS: ExampleTopic[] = [
  {
    id: 'jwt',
    title: 'JSON Web Tokens (JWT) Architecture',
    category: 'Security & Authentication',
    badge: 'Stateless Auth',
    summary:
      'Explore stateless request authentication, token anatomy (header, claims payload, cryptographic signature), and security best practices.',
    details: '2 Chapters • 4 Scenes • Token Verification Checklist • Security Glossary',
    durationEstimate: '~25s runtime',
    scenesCount: 4,
    chaptersCount: 2,
    sampleSnippet:
      'Explain JSON Web Tokens (JWT), token anatomy (header, payload, signature), and stateless request authentication.',
  },
  {
    id: 'python',
    title: 'Python List Comprehensions & Loop Refactoring',
    category: 'Language Features & Refactoring',
    badge: 'Code Optimization',
    summary:
      'Compare traditional imperative for-loops with idiomatic Python list comprehensions. See visual step-by-step diffs and memory implications.',
    details: '1 Chapter • 2 Scenes • Visual Syntax Diffs • Key Terminology',
    durationEstimate: '~20s runtime',
    scenesCount: 2,
    chaptersCount: 1,
    sampleSnippet: 'def transform_items(items):\n    return [x * 2 for x in items]',
  },
];

interface ExampleLessonsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectExample: (topic: 'jwt' | 'python', language: Language) => void;
  isLoading?: boolean;
}

export const ExampleLessonsModal: React.FC<ExampleLessonsModalProps> = ({
  isOpen,
  onClose,
  onSelectExample,
  isLoading = false,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [selectedLanguage, setSelectedLanguage] = React.useState<Language>('en');

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Trap focus or focus container on open
  useEffect(() => {
    if (isOpen) {
      modalRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="example-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
              <span>📚</span> Pre-built Lessons
            </div>
            <h2 id="example-modal-title" className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
              Explore Example Lessons
            </h2>
            <p className="text-sm text-slate-400">
              Select a pre-built interactive lesson to experience DecodeAI immediately without using AI generation quota.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Global Language Selector */}
        <div className="flex items-center justify-between flex-wrap gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
          <div className="text-xs text-slate-300 font-medium flex items-center gap-2">
            <span>🌐</span>
            <span>Narration & Subtitle Language:</span>
          </div>
          <div className="flex items-center gap-1.5" role="group" aria-label="Select lesson language">
            <button
              type="button"
              onClick={() => setSelectedLanguage('en')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                selectedLanguage === 'en'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>🇬🇧</span> English
            </button>
            <button
              type="button"
              onClick={() => setSelectedLanguage('hi')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                selectedLanguage === 'hi'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>🇮🇳</span> हिन्दी
            </button>
            <button
              type="button"
              onClick={() => setSelectedLanguage('hinglish')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                selectedLanguage === 'hinglish'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>🌐</span> Hinglish
            </button>
          </div>
        </div>

        {/* Example Lesson Cards */}
        <div className="grid grid-cols-1 gap-4">
          {EXAMPLE_TOPICS.map((topic) => (
            <div
              key={topic.id}
              className="p-5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all space-y-3 group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-decodeai-accent">
                      {topic.category}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                      {topic.badge}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">
                    {topic.title}
                  </h3>
                </div>

                <span className="text-xs font-mono text-slate-400 shrink-0">
                  {topic.durationEstimate}
                </span>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">
                {topic.summary}
              </p>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-3">
                <span className="text-xs text-slate-400 flex items-center gap-2">
                  <span>✨</span>
                  <span>{topic.details}</span>
                </span>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => onSelectExample(topic.id, selectedLanguage)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 hover:scale-[1.02]"
                >
                  <span>▶</span>
                  <span>Watch example ({selectedLanguage.toUpperCase()})</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <p>Lessons run entirely in your browser with synchronized subtitles and optional voice narration.</p>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
