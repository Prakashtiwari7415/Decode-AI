import React, { useState } from 'react';
import { useLessonStore } from '../../stores/lessonStore';
import { SceneRenderer } from '../scenes/SceneRenderer';
import { CaptionOverlay } from './CaptionOverlay';

export const PlayerViewport: React.FC = () => {
  const {
    lesson,
    activeChapterIndex,
    activeSceneIndex,
    isPlaying,
    getCurrentScene,
    togglePlay,
  } = useLessonStore();

  const [showPlayIconNotice, setShowPlayIconNotice] = useState<boolean>(false);

  const scene = getCurrentScene();
  const currentChapter = lesson?.chapters[activeChapterIndex];

  if (!lesson || !scene || !currentChapter) {
    return (
      <div className="w-full aspect-video min-h-[380px] rounded-t-xl bg-slate-950 flex items-center justify-center border border-slate-800 text-slate-500">
        No active lesson scene loaded.
      </div>
    );
  }

  const handleViewportClick = (e: React.MouseEvent) => {
    // Avoid toggling play if clicking inside interactive buttons or code copy buttons
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('select') || target.closest('input')) {
      return;
    }
    togglePlay();
    setShowPlayIconNotice(true);
    setTimeout(() => setShowPlayIconNotice(false), 600);
  };

  return (
    <div
      onClick={handleViewportClick}
      className="relative w-full aspect-video min-h-[380px] max-h-[640px] rounded-t-xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden flex flex-col justify-between cursor-pointer group"
    >
      {/* Top Header Overlay */}
      <div className="relative z-20 px-4 py-3 bg-gradient-to-b from-slate-950/95 via-slate-950/60 to-transparent flex items-center justify-between gap-2 pointer-events-none">
        {/* Chapter & Scene Indicator */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="px-2.5 py-1 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-semibold uppercase tracking-wider text-[10px]">
            Ch {activeChapterIndex + 1}/{lesson.chapters.length}: {currentChapter.title}
          </span>
          <span className="text-slate-400 font-medium">
            Scene {activeSceneIndex + 1}/{currentChapter.scenes.length}: {scene.title}
          </span>
        </div>

        {/* Status Pills: Fixture vs AI Badge, Uncertainty Badge & Playback State */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {lesson.lesson_id.includes('fixture') ? (
            <span className="px-2 py-0.5 rounded-full bg-slate-800/90 border border-slate-700 text-slate-300 text-[10px] font-mono font-semibold flex items-center gap-1">
              <span>📌</span> Fixture Demo
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-600/50 text-indigo-300 text-[10px] font-mono font-semibold flex items-center gap-1">
              <span>✨</span> {lesson.gemini_model_version || 'Gemini 3.8 Flash'}
            </span>
          )}

          {scene.uncertainty !== 'none' && (
            <div className="relative group/uncertainty">
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold flex items-center gap-1 cursor-help">
                <span>⚠️</span>
                <span className="uppercase">{scene.uncertainty} Uncertainty</span>
              </span>
              {scene.uncertainty_note && (
                <div className="opacity-0 group-hover/uncertainty:opacity-100 transition-opacity absolute right-0 top-6 w-60 p-2.5 rounded-lg bg-slate-900 border border-amber-600/40 text-[11px] text-amber-200 shadow-2xl z-30 pointer-events-none">
                  {scene.uncertainty_note}
                </div>
              )}
            </div>
          )}

          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold flex items-center gap-1.5 ${
              isPlaying
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
            />
            {isPlaying ? 'PLAYING' : 'PAUSED'}
          </span>
        </div>
      </div>

      {/* Center Scene Rendering Area */}
      <div className="relative z-10 flex-1 w-full h-full p-2 sm:p-4 overflow-hidden flex items-center justify-center">
        <SceneRenderer scene={scene} />
      </div>

      {/* Floating Center Play/Pause Flash Animation on click */}
      {showPlayIconNotice && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none bg-slate-950/20 backdrop-blur-[2px] transition-all">
          <div className="p-4 rounded-full bg-slate-900/90 border border-slate-700 text-white shadow-2xl animate-ping scale-125">
            {isPlaying ? (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Bottom Subtitle / Caption Overlay */}
      <CaptionOverlay />
    </div>
  );
};
