import React, { useState, useEffect } from 'react';
import { generateLesson, ApiError } from '../services/api';
import {
  LessonRequest,
  ContentType,
  Language,
  DetailLevel,
} from '../types/lesson';
import { useLessonStore } from '../stores/lessonStore';
import { LessonPlayer } from '../components/lesson/LessonPlayer';
import { ExampleLessonsModal, EXAMPLE_TOPICS } from '../components/lesson/ExampleLessonsModal';

export type GenerationState =
  | 'idle'
  | 'validating'
  | 'generating'
  | 'success'
  | 'recoverable_error'
  | 'non_recoverable_error';

const PROGRESSIVE_STATUS_MESSAGES = [
  'Analyzing code structure, patterns, and concepts...',
  'Designing structured chapters and visual scenes...',
  'Assembling narration script, captions, and verification checklist...',
];

const MAX_CONTENT_LENGTH = 20_000;
const MIN_CONTENT_LENGTH = 10;

interface ErrorClassification {
  title: string;
  badge: string;
  friendlyMessage: string;
  isRecoverable: boolean;
}

function classifyError(status: number | null, rawMessage: string): ErrorClassification {
  if (status === 429) {
    return {
      title: 'Generation Limit Reached',
      badge: 'Rate Limit (429)',
      friendlyMessage:
        'The AI service is experiencing high demand right now or has reached its rate limit. Please try again in a few moments, or explore our pre-built example lessons to see DecodeAI in action.',
      isRecoverable: true,
    };
  }

  if (status === 503) {
    return {
      title: 'Service Temporarily Unavailable',
      badge: 'Service Busy (503)',
      friendlyMessage:
        'The AI generation service is temporarily busy or undergoing maintenance. Your input has been saved. Please try again shortly or check out an example lesson.',
      isRecoverable: true,
    };
  }

  if (status === 504) {
    return {
      title: 'Generation Timed Out',
      badge: 'Timeout (504)',
      friendlyMessage:
        'The request took longer than expected to synthesize. Your snippet has been preserved. You can try again or check out an example lesson.',
      isRecoverable: true,
    };
  }

  if (status === 401 || status === 403) {
    return {
      title: 'AI Service Configuration Needed',
      badge: `Configuration (${status})`,
      friendlyMessage:
        'The backend AI service has not been configured with an API key. You can explore all features using our pre-built example lessons, or contact your administrator.',
      isRecoverable: false,
    };
  }

  if (status === 400 || status === 422) {
    return {
      title: 'Invalid Input',
      badge: `Validation (${status})`,
      friendlyMessage:
        rawMessage || `Please ensure your input is between ${MIN_CONTENT_LENGTH} and ${MAX_CONTENT_LENGTH.toLocaleString()} characters.`,
      isRecoverable: false,
    };
  }

  return {
    title: 'Unable to Generate Lesson',
    badge: `Service Error (${status || 500})`,
    friendlyMessage:
      rawMessage ||
      'An unexpected error occurred while communicating with the service. Your input is safe. Please try again or explore an example lesson.',
    isRecoverable: true,
  };
}

export const Home: React.FC = () => {
  const { lesson, setLesson } = useLessonStore();

  const [content, setContent] = useState<string>(
    '# Traditional vs Modern Python Loop\nresult = []\nfor x in items:\n    result.append(x * 2)'
  );
  const [contentType, setContentType] = useState<ContentType>('explanation');
  const [language, setLanguage] = useState<Language>('en');
  const [detailLevel, setDetailLevel] = useState<DetailLevel>('standard');

  const [generationState, setGenerationState] = useState<GenerationState>('idle');
  const [loadingStage, setLoadingStage] = useState<number>(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{
    status: number | null;
    classification: ErrorClassification;
  } | null>(null);
  const [lastPayload, setLastPayload] = useState<LessonRequest | null>(null);

  const [isExampleModalOpen, setIsExampleModalOpen] = useState<boolean>(false);

  const isGenerating = generationState === 'generating';

  // Cycle progressive loading messages during active generation
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isGenerating) {
      setLoadingStage(0);
      interval = setInterval(() => {
        setLoadingStage((prev) => (prev + 1) % PROGRESSIVE_STATUS_MESSAGES.length);
      }, 3500);
    } else {
      setLoadingStage(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGenerating]);

  const executeGeneration = async (reqPayload: LessonRequest) => {
    setGenerationState('generating');
    setValidationError(null);
    setErrorDetails(null);
    setLastPayload(reqPayload);

    try {
      const result = await generateLesson(reqPayload);
      setGenerationState('success');
      setLesson(result);
    } catch (err: unknown) {
      let status: number | null = null;
      let rawMessage = '';

      if (err instanceof ApiError) {
        status = err.status;
        rawMessage = err.detail;
      } else if (err instanceof Error) {
        rawMessage = err.message;
      } else {
        rawMessage = 'An unexpected error occurred while communicating with the server.';
      }

      const classification = classifyError(status, rawMessage);
      setErrorDetails({ status, classification });
      setGenerationState(classification.isRecoverable ? 'recoverable_error' : 'non_recoverable_error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isGenerating) return; // Prevent duplicate submissions

    setGenerationState('validating');
    const trimmed = content.trim();

    if (!trimmed || trimmed.length < MIN_CONTENT_LENGTH) {
      const msg = `Content must be at least ${MIN_CONTENT_LENGTH} characters long.`;
      setValidationError(msg);
      setGenerationState('idle');
      return;
    }

    if (trimmed.length > MAX_CONTENT_LENGTH) {
      const msg = `Content exceeds maximum allowed limit of ${MAX_CONTENT_LENGTH.toLocaleString()} characters.`;
      setValidationError(msg);
      setGenerationState('idle');
      return;
    }

    setValidationError(null);

    const payload: LessonRequest = {
      content: trimmed,
      content_type: contentType,
      language,
      detail_level: detailLevel,
      use_fixture: false, // Live AI generation pipeline
    };

    await executeGeneration(payload);
  };

  const handleSelectExample = async (topicId: 'jwt' | 'python', langChoice: Language = 'en') => {
    setIsExampleModalOpen(false);
    const selectedTopic = EXAMPLE_TOPICS.find((t) => t.id === topicId) || EXAMPLE_TOPICS[0];

    const payload: LessonRequest = {
      content: selectedTopic.sampleSnippet,
      content_type: topicId === 'jwt' ? 'explanation' : 'code_diff',
      language: langChoice,
      detail_level: 'standard',
      use_fixture: true, // Offline deterministic example
    };

    setLanguage(langChoice);
    // Note: Do NOT overwrite user's custom content in the editor on generation failure
    // Only update content if user deliberately chose an example
    setContent(selectedTopic.sampleSnippet);
    await executeGeneration(payload);
  };

  const handleRetry = async () => {
    if (lastPayload) {
      await executeGeneration(lastPayload);
    }
  };

  const isOverLimit = content.length > MAX_CONTENT_LENGTH;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Navbar */}
        <header className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-decodeai-primary to-decodeai-accent flex items-center justify-center font-black text-white text-lg shadow-lg shadow-indigo-500/20">
              D
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-decodeai-primary via-indigo-300 to-decodeai-accent bg-clip-text text-transparent">
                DecodeAI
              </h1>
              <p className="text-xs text-slate-400">
                Understand complex technical concepts through visual lessons
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsExampleModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <span>📚</span>
              <span>Explore example lessons</span>
            </button>
          </div>
        </header>

        {/* If a lesson is active, display the Lesson Player */}
        {lesson ? (
          <LessonPlayer onBackToInput={() => setLesson(null as any)} />
        ) : (
          /* Landing Form & Discovery Flow */
          <div className="max-w-4xl mx-auto space-y-8 pt-2">
            {/* Hero Section */}
            <div className="text-center space-y-3">
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-100">
                Understand Complex Technical Concepts Visually
              </h2>
              <p className="text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
                Paste any code snippet, terminal error, or architectural question. DecodeAI synthesizes structured chapters, animated visual scenes, and synchronized narration across English, Hindi, and Hinglish.
              </p>
            </div>

            {/* Main Generation Form (Primary Hero Action) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm space-y-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="content" className="block text-sm font-semibold text-slate-200">
                      Paste Code, Terminal Error, or Concept to Decode
                    </label>
                    <span
                      className={`text-xs font-mono ${
                        isOverLimit ? 'text-rose-400 font-bold' : 'text-slate-400'
                      }`}
                    >
                      {content.length.toLocaleString()} / {MAX_CONTENT_LENGTH.toLocaleString()} chars
                    </span>
                  </div>
                  <textarea
                    id="content"
                    rows={6}
                    disabled={isGenerating}
                    className={`w-full bg-slate-950 border rounded-xl p-3.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 font-mono text-sm resize-y disabled:opacity-60 ${
                      isOverLimit || validationError
                        ? 'border-rose-500 focus:ring-rose-500'
                        : 'border-slate-700/80 focus:ring-decodeai-primary'
                    }`}
                    placeholder="# Paste Python, TypeScript, terminal errors, or architecture questions here..."
                    value={content}
                    onChange={(e) => {
                      setContent(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    required
                  />
                  {validationError && (
                    <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                      <span>⚠️</span> {validationError}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="contentType" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Content Category
                    </label>
                    <select
                      id="contentType"
                      disabled={isGenerating}
                      value={contentType}
                      onChange={(e) => setContentType(e.target.value as ContentType)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-decodeai-primary disabled:opacity-60"
                    >
                      <option value="explanation">Technical Explanation</option>
                      <option value="code_diff">Code Diff / Refactor</option>
                      <option value="terminal">Terminal Output / Log</option>
                      <option value="prompt">AI Prompt</option>
                      <option value="completion">Code Completion</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="language" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Narration Language
                    </label>
                    <select
                      id="language"
                      disabled={isGenerating}
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as Language)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-decodeai-primary disabled:opacity-60"
                    >
                      <option value="en">English</option>
                      <option value="hi">हिन्दी (Hindi)</option>
                      <option value="hinglish">Hinglish</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="detailLevel" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Lesson Depth
                    </label>
                    <select
                      id="detailLevel"
                      disabled={isGenerating}
                      value={detailLevel}
                      onChange={(e) => setDetailLevel(e.target.value as DetailLevel)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-decodeai-primary disabled:opacity-60"
                    >
                      <option value="brief">Brief Overview (1-2 scenes)</option>
                      <option value="standard">Standard Lesson (2-3 scenes)</option>
                      <option value="deep">Deep Architecture Dive (4+ scenes)</option>
                    </select>
                  </div>
                </div>

                {/* Progress / Loading Feedback Banner (No fake percentages) */}
                {isGenerating && (
                  <div
                    aria-live="polite"
                    className="p-4 bg-indigo-950/40 border border-indigo-800/60 rounded-xl space-y-3 animate-fade-in"
                  >
                    <div className="flex items-center gap-3">
                      <svg className="animate-spin h-5 w-5 text-decodeai-accent shrink-0" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-decodeai-accent block">
                          Synthesizing Interactive Lesson
                        </span>
                        <p className="text-sm text-slate-200 transition-all duration-300">
                          {PROGRESSIVE_STATUS_MESSAGES[loadingStage]}
                        </p>
                      </div>
                    </div>

                    {/* Indeterminate shimmer pulse line */}
                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-decodeai-primary to-decodeai-accent rounded-full animate-pulse w-full" />
                    </div>
                  </div>
                )}

                {/* Human-Friendly Failure Recovery Panel */}
                {errorDetails && !isGenerating && (
                  <div
                    role="alert"
                    className="p-5 bg-slate-950/90 border border-red-900/60 rounded-xl space-y-4 text-slate-200 shadow-xl"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl shrink-0 mt-0.5">⚠️</span>
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-sm font-bold text-red-300">
                            {errorDetails.classification.title}
                          </span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-red-950 border border-red-800 text-red-300">
                            {errorDetails.classification.badge}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed">
                          {errorDetails.classification.friendlyMessage}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between flex-wrap gap-2 pt-3 border-t border-slate-800/80">
                      <div className="flex items-center gap-2">
                        {errorDetails.classification.isRecoverable && (
                          <button
                            type="button"
                            onClick={handleRetry}
                            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
                          >
                            <span>🔄</span> Try again
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsExampleModalOpen(true)}
                          className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
                        >
                          <span>📚</span> Explore example lessons
                        </button>
                      </div>

                      <span className="text-xs text-slate-500">
                        Your snippet text has been preserved above.
                      </span>
                    </div>
                  </div>
                )}

                {/* Primary & Secondary Action Controls */}
                <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsExampleModalOpen(true)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors flex items-center gap-1.5"
                  >
                    <span>💡</span> Explore pre-built example lessons
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={isGenerating || isOverLimit}
                      className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-decodeai-primary hover:bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed font-bold text-sm text-white transition-all shadow-lg shadow-indigo-500/25 hover:scale-[1.01]"
                    >
                      {isGenerating ? (
                        <span className="inline-flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Generating lesson...
                        </span>
                      ) : (
                        'Generate lesson'
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Discovery Section: Pre-built Example Lessons */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-200">
                    Or explore pre-built example lessons
                  </h3>
                  <p className="text-xs text-slate-400">
                    Learn immediately without API generation quota or waiting.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsExampleModalOpen(true)}
                  className="text-xs font-semibold text-decodeai-accent hover:underline flex items-center gap-1"
                >
                  View all examples <span>→</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {EXAMPLE_TOPICS.map((topic) => (
                  <div
                    key={topic.id}
                    className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                          {topic.category}
                        </span>
                        <span className="text-xs font-mono text-slate-500">
                          {topic.durationEstimate}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-100">
                        {topic.title}
                      </h4>
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {topic.summary}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-500">
                        {topic.chaptersCount} Ch • {topic.scenesCount} Scenes
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSelectExample(topic.id, language)}
                        disabled={isGenerating}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-200 text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5"
                      >
                        <span>▶</span> Watch example
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Accessible Pre-built Lessons Modal */}
      <ExampleLessonsModal
        isOpen={isExampleModalOpen}
        onClose={() => setIsExampleModalOpen(false)}
        onSelectExample={handleSelectExample}
        isLoading={isGenerating}
      />
    </main>
  );
};
