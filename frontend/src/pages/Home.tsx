import React, { useState } from 'react';
import { generateLesson, ApiError } from '../services/api';
import {
  LessonRequest,
  ContentType,
  Language,
  DetailLevel,
} from '../types/lesson';
import { useLessonStore } from '../stores/lessonStore';
import { LessonPlayer } from '../components/lesson/LessonPlayer';

export const Home: React.FC = () => {
  const { lesson, setLesson } = useLessonStore();

  const [content, setContent] = useState<string>(
    '# Traditional vs Modern Python Loop\nresult = []\nfor x in items:\n    result.append(x * 2)'
  );
  const [contentType, setContentType] = useState<ContentType>('explanation');
  const [language, setLanguage] = useState<Language>('en');
  const [detailLevel, setDetailLevel] = useState<DetailLevel>('standard');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLesson = async (reqPayload: LessonRequest) => {
    setLoading(true);
    setError(null);

    try {
      const result = await generateLesson(reqPayload);
      setLesson(result);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(`Error (${err.status}): ${err.detail}`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred while generating the lesson.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() || content.trim().length < 10) {
      setError('Content must be at least 10 characters long.');
      return;
    }

    const payload: LessonRequest = {
      content,
      content_type: contentType,
      language,
      detail_level: detailLevel,
    };

    await fetchLesson(payload);
  };

  const handleLoadSampleFixture = async (langChoice: Language = 'en') => {
    const payload: LessonRequest = {
      content: 'def transform_items(items):\n    return [x * 2 for x in items]',
      content_type: 'explanation',
      language: langChoice,
      detail_level: 'standard',
    };
    setLanguage(langChoice);
    await fetchLesson(payload);
  };

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
              <p className="text-[11px] text-slate-400">Interactive Animated Lesson Player</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono">
              Milestone 2A
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
                Interactive Technical Learning
              </div>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-100">
                Understand AI Code Visually
              </h2>
              <p className="text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
                Transform complex code completions, terminal outputs, and system diffs into synchronized YouTube-style animated lessons with captions and narration.
              </p>
            </div>

            {/* Quick-Start Sample Cards */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-200">Quick-Start Fixture Lessons</h3>
                <p className="text-xs text-slate-400">Instantly launch the player without entering text</p>
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
                  <label htmlFor="content" className="block text-sm font-semibold text-slate-200 mb-2">
                    Paste Code, Terminal Error, or AI Prompt to Decode
                  </label>
                  <textarea
                    id="content"
                    rows={6}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-decodeai-primary font-mono text-sm resize-y"
                    placeholder="# Paste your Python, TypeScript, or terminal error output here..."
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
                      <option value="brief">Brief Overview</option>
                      <option value="standard">Standard Lesson</option>
                      <option value="deep">Deep Architecture Dive</option>
                    </select>
                  </div>
                </div>

                {/* Error Banner */}
                {error && (
                  <div role="alert" className="p-4 bg-red-950/60 border border-red-800 rounded-xl text-sm text-red-300">
                    {error}
                  </div>
                )}

                {/* Submit Action */}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-slate-500">
                    Pressing Generate synthesizes structured scenes, narration, and captions.
                  </span>
                  <button
                    type="submit"
                    disabled={loading}
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
                      '▶ Generate Animated Lesson'
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
