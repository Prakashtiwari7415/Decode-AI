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

const LOADING_MESSAGES = [
  'Analyzing code structure, patterns, and architecture...',
  'Synthesizing chapters and visual scenes with Gemini 3.8 Flash...',
  'Generating narration script, timed captions, and verification checklist...',
];

const MAX_CONTENT_LENGTH = 20_000;

export const Home: React.FC = () => {
  const { lesson, setLesson } = useLessonStore();

  const [content, setContent] = useState<string>(
    '# Traditional vs Modern Python Loop\nresult = []\nfor x in items:\n    result.append(x * 2)'
  );
  const [contentType, setContentType] = useState<ContentType>('explanation');
  const [language, setLanguage] = useState<Language>('en');
  const [detailLevel, setDetailLevel] = useState<DetailLevel>('standard');
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStage, setLoadingStage] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [lastPayload, setLastPayload] = useState<LessonRequest | null>(null);

  // Cycle loading messages during active generation
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (loading) {
      setLoadingStage(0);
      interval = setInterval(() => {
        setLoadingStage((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 3500);
    } else {
      setLoadingStage(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading]);

  const fetchLesson = async (reqPayload: LessonRequest) => {
    setLoading(true);
    setError(null);
    setErrorStatus(null);
    setLastPayload(reqPayload);

    try {
      const result = await generateLesson(reqPayload);
      setLesson(result);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorStatus(err.status);
        setError(err.detail);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred while communicating with the server.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = content.trim();
    if (!trimmed || trimmed.length < 10) {
      setError('Content must be at least 10 characters long.');
      setErrorStatus(422);
      return;
    }

    if (trimmed.length > MAX_CONTENT_LENGTH) {
      setError(`Content exceeds maximum allowed limit of ${MAX_CONTENT_LENGTH.toLocaleString()} characters.`);
      setErrorStatus(422);
      return;
    }

    const payload: LessonRequest = {
      content: trimmed,
      content_type: contentType,
      language,
      detail_level: detailLevel,
      use_fixture: false, // Live AI generation
    };

    await fetchLesson(payload);
  };

  const handleLoadSampleFixture = async (langChoice: Language = 'en') => {
    const payload: LessonRequest = {
      content: 'def transform_items(items):\n    return [x * 2 for x in items]',
      content_type: 'explanation',
      language: langChoice,
      detail_level: 'standard',
      use_fixture: true, // Offline deterministic fixture
    };
    setLanguage(langChoice);
    await fetchLesson(payload);
  };

  const handleRetry = async () => {
    if (lastPayload) {
      await fetchLesson(lastPayload);
    }
  };

  const isOverLimit = content.length > MAX_CONTENT_LENGTH;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Navbar */}
        <header className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-decodeai-primary to-decodeai-accent flex items-center justify-center font-black text-white text-lg shadow-lg shadow-indigo-500/20">
              D
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-decodeai-primary via-indigo-300 to-decodeai-accent bg-clip-text text-transparent">
                DecodeAI
              </h1>
              <p className="text-[11px] text-slate-400">Gemini 3.8 Flash • Animated Technical Lessons</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono">
              Milestone 2B
            </span>
          </div>
        </header>

        {/* If a lesson is active, display the Lesson Player */}
        {lesson ? (
          <LessonPlayer onBackToInput={() => setLesson(null as any)} />
        ) : (
          /* Landing Form & Quick-Start Cards */
          <div className="max-w-4xl mx-auto space-y-8 pt-4">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-decodeai-primary/10 border border-decodeai-primary/30 text-decodeai-accent text-xs font-semibold uppercase tracking-wider">
                Powered by Gemini 3.8 Flash
              </div>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-100">
                Understand AI Code Visually
              </h2>
              <p className="text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
                Paste technical code, diffs, or prompts to generate synchronized YouTube-style animated lessons with captions and narration across English, Hindi, and Hinglish.
              </p>
            </div>

            {/* Quick-Start Sample Cards */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-200">Predefined Demo Lessons</h3>
                <p className="text-xs text-slate-400">Instant offline test fixtures (no API key required)</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleLoadSampleFixture('en')}
                  disabled={loading}
                  className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
                >
                  <span>🇬🇧</span> Watch in English
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSampleFixture('hi')}
                  disabled={loading}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5"
                >
                  <span>🇮🇳</span> हिन्दी में देखें
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSampleFixture('hinglish')}
                  disabled={loading}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5"
                >
                  <span>🌐</span> Hinglish
                </button>
              </div>
            </div>

            {/* Main Form */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="content" className="block text-sm font-semibold text-slate-200">
                      Paste Code, Terminal Error, or AI Prompt to Decode
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
                    className={`w-full bg-slate-950 border rounded-xl p-3.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 font-mono text-sm resize-y ${
                      isOverLimit
                        ? 'border-rose-500 focus:ring-rose-500'
                        : 'border-slate-700/80 focus:ring-decodeai-primary'
                    }`}
                    placeholder="# Paste Python, TypeScript, terminal errors, or prompts here..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="contentType" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Content Category
                    </label>
                    <select
                      id="contentType"
                      value={contentType}
                      onChange={(e) => setContentType(e.target.value as ContentType)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-decodeai-primary"
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
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as Language)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-decodeai-primary"
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
                      value={detailLevel}
                      onChange={(e) => setDetailLevel(e.target.value as DetailLevel)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-decodeai-primary"
                    >
                      <option value="brief">Brief Overview (1-2 scenes)</option>
                      <option value="standard">Standard Lesson (2-3 scenes)</option>
                      <option value="deep">Deep Architecture Dive (4+ scenes)</option>
                    </select>
                  </div>
                </div>

                {/* Progress / Loading Feedback Banner */}
                {loading && (
                  <div className="p-4 bg-indigo-950/40 border border-indigo-800/60 rounded-xl space-y-3">
                    <div className="flex items-center gap-3">
                      <svg className="animate-spin h-5 w-5 text-decodeai-accent shrink-0" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-decodeai-accent block">
                          Synthesizing Lesson via Gemini 3.8 Flash
                        </span>
                        <p className="text-sm text-slate-200 transition-all duration-300">
                          {LOADING_MESSAGES[loadingStage]}
                        </p>
                      </div>
                    </div>

                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-decodeai-primary to-decodeai-accent transition-all duration-700 rounded-full"
                        style={{ width: `${((loadingStage + 1) / LOADING_MESSAGES.length) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Error Banner with Retry Controls */}
                {error && !loading && (
                  <div role="alert" className="p-4 bg-red-950/60 border border-red-800 rounded-xl space-y-3 text-red-200">
                    <div className="flex items-start gap-2.5">
                      <span className="text-lg">⚠️</span>
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-red-400">
                            {errorStatus === 401
                              ? 'Gemini API Key Required'
                              : errorStatus === 429
                              ? 'Rate Limit Exceeded'
                              : errorStatus === 504
                              ? 'Generation Timeout'
                              : errorStatus === 422
                              ? 'Validation Error'
                              : 'AI Generation Error'}
                          </span>
                          {errorStatus && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-900/60 text-red-300">
                              HTTP {errorStatus}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-200">{error}</p>
                        {errorStatus === 401 && (
                          <p className="text-xs text-slate-400 pt-1">
                            Tip: To use real AI generation, configure a valid <code className="text-amber-300">GEMINI_API_KEY</code> in <code className="text-slate-300">backend/.env</code>. Or test instantly using the Predefined Demo Lessons above.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-red-900/40">
                      <button
                        type="button"
                        onClick={handleRetry}
                        className="px-3 py-1.5 rounded-lg bg-red-900/60 hover:bg-red-800 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
                      >
                        <span>🔄</span> Retry Request
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLoadSampleFixture(language)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                      >
                        💡 Load Demo Fixture Instead
                      </button>
                    </div>
                  </div>
                )}

                {/* Submit Action */}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-slate-500">
                    Generates chapters, interactive visual scenes, narration, and captions.
                  </span>
                  <button
                    type="submit"
                    disabled={loading || isOverLimit}
                    className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-decodeai-primary hover:bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed font-semibold text-sm text-white transition-all shadow-lg shadow-indigo-500/25"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Synthesizing Lesson...
                      </span>
                    ) : (
                      '✨ Generate with Gemini 3.8 Flash'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
