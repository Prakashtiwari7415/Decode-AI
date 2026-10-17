import React from 'react';
import { useLessonStore } from '../../stores/lessonStore';
import { SceneRenderer } from '../scenes/SceneRenderer';
import { CaptionOverlay } from './CaptionOverlay';

export const PlayerViewport: React.FC = () => {
  const {
    lesson,
    activeChapterIndex,
    isSpeaking,
    captionsEnabled,
    getCurrentScene,
    getTotalScenes,
    getGlobalSceneIndex,
  } = useLessonStore();

  const scene = getCurrentScene();
  const currentChapter = lesson?.chapters[activeChapterIndex];
  const totalScenes = getTotalScenes();
  const currentGlobalIndex = getGlobalSceneIndex();

  if (!lesson || !scene || !currentChapter) {
    return (
      <div className="w-full aspect-video min-h-[380px] rounded-t-xl bg-slate-950 flex items-center justify-center border border-slate-800 text-slate-500 text-sm">
        No active slide loaded.
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video min-h-[380px] max-h-[640px] rounded-t-xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden flex flex-col justify-between select-none">
      {/* Top Slide Header Overlay */}
      <div className="relative z-20 px-4 py-3 bg-gradient-to-b from-slate-950 via-slate-950/80 to-transparent flex items-center justify-between gap-3 border-b border-slate-800/40">
        {/* Chapter & Slide Indicator */}
        <div className="flex items-center gap-2 text-xs truncate">
          <span className="px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-semibold text-[11px] shrink-0">
            Ch {activeChapterIndex + 1}/{lesson.chapters.length}: {currentChapter.title}
          </span>
          <span className="text-slate-300 font-medium truncate text-xs">
            Slide {currentGlobalIndex + 1}: {scene.title}
          </span>
        </div>

        {/* Status Indicators & Slide Counter */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {/* Slide Counter Badge */}
          <span
            className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-mono font-semibold"
            title={`Slide ${currentGlobalIndex + 1} of ${totalScenes}`}
          >
            Slide {currentGlobalIndex + 1} of {totalScenes}
          </span>

          {/* Lesson Type Badge */}
          {lesson.lesson_id.includes('fixture') ? (
            <span className="px-2 py-0.5 rounded-full bg-slate-800/90 border border-slate-700 text-slate-300 text-[10px] font-mono font-semibold flex items-center gap-1">
              <span>📚</span> Example Lesson
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-600/50 text-indigo-300 text-[10px] font-mono font-semibold flex items-center gap-1">
              <span>✨</span> Visual Lesson
            </span>
          )}

          {/* Evidence Grounding Level */}
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
              <span>
                {scene.grounding_category === 'observed' ? '🔍' : scene.grounding_category === 'inferred' ? '💡' : '⚠️'}
              </span>
              <span className="capitalize hidden sm:inline">
                {scene.grounding_category === 'needs_verification'
                  ? 'Verify'
                  : scene.grounding_category}
              </span>
            </span>
          )}

          {/* Narration Mode Pill */}
          {isSpeaking ? (
            <span
              className="px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 text-[10px] font-mono flex items-center gap-1.5 animate-pulse"
              title="Browser speech synthesis is actively reading this slide"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>🗣️ Voice Active</span>
            </span>
          ) : captionsEnabled ? (
            <span
              className="px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-[10px] font-medium flex items-center gap-1"
              title="Subtitles active"
            >
              <span>💬</span> Subtitles ON
            </span>
          ) : null}
        </div>
      </div>

      {/* Center Slide Visual Content Canvas */}
      <div className="relative z-10 flex-1 w-full h-full p-3 sm:p-5 overflow-hidden flex items-center justify-center">
        <SceneRenderer scene={scene} />
      </div>

      {/* Bottom Subtitle Caption Strip */}
      <CaptionOverlay />
    </div>
  );
};
