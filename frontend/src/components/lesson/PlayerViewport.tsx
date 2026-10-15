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
    selectedVoice,
    narrationEnabled,
    audioLoading,
    captionOnlyFallback,
    getCurrentScene,
    getPlaybackStatus,
    togglePlay,
  } = useLessonStore();

  const [showPlayIconNotice, setShowPlayIconNotice] = useState<boolean>(false);

  const scene = getCurrentScene();
  const currentChapter = lesson?.chapters[activeChapterIndex];
  const playbackStatus = getPlaybackStatus();

  if (!lesson || !scene || !currentChapter) {
    return (
      <div className="w-full aspect-video min-h-[380px] rounded-t-xl bg-slate-950 flex items-center justify-center border border-slate-800 text-slate-500 text-sm">
        No active lesson scene loaded.
      </div>
    );
  }

  const handleViewportClick = (e: React.MouseEvent) => {
    // Avoid toggling play if clicking inside interactive buttons or controls
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('select') || target.closest('input')) {
      return;
    }
    togglePlay();
    setShowPlayIconNotice(true);
    setTimeout(() => setShowPlayIconNotice(false), 500);
  };

  return (
    <div
      onClick={handleViewportClick}
      className="relative w-full aspect-video min-h-[380px] max-h-[640px] rounded-t-xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden flex flex-col justify-between cursor-pointer group select-none"
    >
      {/* Top Header Overlay */}
      <div className="relative z-20 px-4 py-2.5 bg-gradient-to-b from-slate-950/95 via-slate-950/70 to-transparent flex items-center justify-between gap-2 pointer-events-none">
        {/* Chapter & Scene Indicator */}
        <div className="flex items-center gap-2 text-xs truncate">
          <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-semibold text-[11px]">
            Ch {activeChapterIndex + 1}/{lesson.chapters.length}: {currentChapter.title}
          </span>
          <span className="text-slate-300 font-medium truncate text-xs">
            Scene {activeSceneIndex + 1}: {scene.title}
          </span>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2 pointer-events-auto shrink-0 flex-wrap justify-end">
          {lesson.lesson_id.includes('fixture') ? (
            <span className="px-2 py-0.5 rounded-full bg-slate-800/90 border border-slate-700 text-slate-300 text-[10px] font-mono font-semibold flex items-center gap-1">
              <span>📌</span> Fixture Demo
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-600/50 text-indigo-300 text-[10px] font-mono font-semibold flex items-center gap-1">
              <span>✨</span> {lesson.gemini_model_version || 'Gemini 3.8 Flash'}
            </span>
          )}

          {/* Grounding Level */}
          {scene.grounding_category && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${
                scene.grounding_category === 'observed'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                  : scene.grounding_category === 'inferred'
                  ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-300'
                  : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
              }`}
              title={`Evidence grounding: ${scene.grounding_category}`}
            >
              <span>{scene.grounding_category === 'observed' ? '🔍' : scene.grounding_category === 'inferred' ? '💡' : '⚠️'}</span>
              <span className="capitalize hidden sm:inline">
                {scene.grounding_category === 'needs_verification'
                  ? 'Verify'
                  : scene.grounding_category}
              </span>
            </span>
          )}

          {/* Voice Narration Mode Pill */}
          {audioLoading ? (
            <span className="px-2 py-0.5 rounded-full bg-indigo-900/40 border border-indigo-500/40 text-cyan-300 text-[10px] font-mono flex items-center gap-1.5 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              Generating Voice...
            </span>
          ) : captionOnlyFallback || !narrationEnabled ? (
            <span className="px-2 py-0.5 rounded-full bg-slate-800/90 border border-slate-700 text-slate-300 text-[10px] font-medium flex items-center gap-1">
              <span>💬</span> Caption Only
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-[10px] font-medium flex items-center gap-1">
              <span>🎙️</span> {selectedVoice}
            </span>
          )}

          {/* Unambiguous Playback Status Indicator */}
          {playbackStatus === 'requesting_audio' ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold flex items-center gap-1.5 bg-cyan-950/60 text-cyan-300 border border-cyan-700/60">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              SYNTHESIZING AUDIO
            </span>
          ) : playbackStatus === 'playing_audio' ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              PLAYING
            </span>
          ) : playbackStatus === 'caption_only' ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold flex items-center gap-1.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              PLAYING (CAPTION ONLY)
            </span>
          ) : playbackStatus === 'error' ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold flex items-center gap-1.5 bg-amber-500/10 text-amber-300 border border-amber-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              AUDIO ERROR
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold flex items-center gap-1.5 bg-slate-800/80 text-slate-400 border border-slate-700/60">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              PAUSED
            </span>
          )}
        </div>
      </div>

      {/* Center Scene Rendering Canvas */}
      <div className="relative z-10 flex-1 w-full h-full p-2 sm:p-4 overflow-hidden flex items-center justify-center">
        <SceneRenderer scene={scene} />
      </div>

      {/* Floating Center Play/Pause Flash Animation */}
      {showPlayIconNotice && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none bg-slate-950/20 backdrop-blur-[1px] transition-all">
          <div className="p-3.5 rounded-full bg-slate-900/90 border border-slate-700 text-white shadow-2xl scale-110">
            {isPlaying ? (
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Bottom Subtitle Caption Strip */}
      <CaptionOverlay />
    </div>
  );
};
