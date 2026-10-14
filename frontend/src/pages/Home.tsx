import React, { useState } from 'react';
import { generateLesson, ApiError } from '../services/api';
import {
  Lesson,
  LessonRequest,
  ContentType,
  Language,
  DetailLevel,
} from '../types/lesson';

export const Home: React.FC = () => {
  const [content, setContent] = useState<string>('');
  const [contentType, setContentType] = useState<ContentType>('explanation');
  const [language, setLanguage] = useState<Language>('en');
  const [detailLevel, setDetailLevel] = useState<DetailLevel>('standard');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() || content.trim().length < 10) {
      setError('Content must be at least 10 characters long.');
      return;
    }

    setLoading(true);
    setError(null);

    const payload: LessonRequest = {
      content,
      content_type: contentType,
      language,
      detail_level: detailLevel,
    };

    try {
      const result = await generateLesson(payload);
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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <header className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-decodeai-primary/10 border border-decodeai-primary/30 text-decodeai-accent text-xs font-semibold uppercase tracking-wider">
            Milestone 1 MVP
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-decodeai-primary via-indigo-300 to-decodeai-accent bg-clip-text text-transparent">
            DecodeAI
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Understand AI code. Transform complex prompts, diffs, and code completions into structured, scene-by-scene interactive lessons.
          </p>
        </header>

        {/* Input Form */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 sm:p-8 shadow-xl backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="content" className="block text-sm font-medium text-slate-200 mb-2">
                Paste Code, Prompt, or Terminal Output
              </label>
              <textarea
                id="content"
                rows={7}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-decodeai-primary focus:border-transparent font-mono text-sm resize-y"
                placeholder="def binary_search(arr, target):&#10;    low, high = 0, len(arr) - 1&#10;    while low <= high:&#10;        mid = (low + high) // 2&#10;        ..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="contentType" className="block text-xs font-medium text-slate-300 uppercase tracking-wide mb-1.5">
                  Content Type
                </label>
                <select
                  id="contentType"
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value as ContentType)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-decodeai-primary"
                >
                  <option value="prompt">Prompt</option>
                  <option value="code_diff">Code Diff</option>
                  <option value="terminal">Terminal</option>
                  <option value="completion">Completion</option>
                  <option value="explanation">Explanation</option>
                </select>
              </div>

              <div>
                <label htmlFor="language" className="block text-xs font-medium text-slate-300 uppercase tracking-wide mb-1.5">
                  Language
                </label>
                <select
                  id="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-decodeai-primary"
                >
                  <option value="en">English (en)</option>
                  <option value="hi">Hindi (hi)</option>
                  <option value="hinglish">Hinglish</option>
                </select>
              </div>

              <div>
                <label htmlFor="detailLevel" className="block text-xs font-medium text-slate-300 uppercase tracking-wide mb-1.5">
                  Detail Level
                </label>
                <select
                  id="detailLevel"
                  value={detailLevel}
                  onChange={(e) => setDetailLevel(e.target.value as DetailLevel)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-decodeai-primary"
                >
                  <option value="brief">Brief</option>
                  <option value="standard">Standard</option>
                  <option value="deep">Deep Dive</option>
                </select>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div role="alert" className="p-4 bg-red-950/50 border border-red-800 rounded-lg text-sm text-red-300">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-decodeai-primary hover:bg-indigo-600 disabled:bg-slate-700 disabled:cursor-not-allowed font-medium text-sm text-white transition-colors shadow-lg shadow-indigo-500/20"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Generating Lesson...
                  </span>
                ) : (
                  'Generate Lesson'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Results Section */}
        {lesson && (
          <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-xl font-bold text-slate-100">{lesson.title}</h2>
                <p className="text-xs text-slate-400">
                  ID: {lesson.lesson_id} • Language: {lesson.language} • Model: {lesson.gemini_model_version}
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono">
                {Math.round(lesson.total_estimated_duration_ms / 1000)}s estimated
              </span>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">
                Lesson Payload (JSON Placeholder for Player)
              </h3>
              <pre className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto max-h-96">
                {JSON.stringify(lesson, null, 2)}
              </pre>
            </div>
          </section>
        )}
      </div>
    </main>
  );
};
