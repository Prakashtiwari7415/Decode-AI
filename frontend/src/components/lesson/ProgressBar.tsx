import React, { useMemo } from 'react';
import { useLessonStore } from '../../stores/lessonStore';

export const ProgressBar: React.FC = () => {
  const {
    lesson,
    activeChapterIndex,
    activeSceneIndex,
    sceneElapsedMs,
    activeSceneDurationMs,
    selectScene,
    seekSceneMs,
    getCurrentScene,
  } = useLessonStore();

  const currentScene = getCurrentScene();
  const currentSceneDurationMs = useMemo(() => {
    if (activeSceneDurationMs && activeSceneDurationMs > 0) {
      return activeSceneDurationMs;
    }
    if (!currentScene) return 6000;
    if (currentScene.captions && currentScene.captions.length > 0) {
      const last = currentScene.captions[currentScene.captions.length - 1];
      return Math.max(last.offset_ms + last.duration_ms, 4000);
    }
    const words = currentScene.narration_text.split(/\s+/).length;
    return Math.max(Math.round((words / 125) * 60 * 1000), 4000);
  }, [activeSceneDurationMs, currentScene]);

  // Flatten all scenes to compute global progress
  const allScenes = useMemo(() => {
    if (!lesson) return [];
    const list: { chapterIndex: number; sceneIndex: number; title: string; chapterTitle: string }[] = [];
    lesson.chapters.forEach((chap, cIdx) => {
      chap.scenes.forEach((sc, sIdx) => {
        list.push({
          chapterIndex: cIdx,
          sceneIndex: sIdx,
          title: sc.title,
          chapterTitle: chap.title,
        });
      });
    });
    return list;
  }, [lesson]);

  if (!lesson || allScenes.length === 0) return null;

  const activeProgressPct = Math.min(
    100,
    Math.max(0, (sceneElapsedMs / currentSceneDurationMs) * 100)
  );

  const handleBarClick = (
    e: React.MouseEvent<HTMLDivElement>,
    chapterIdx: number,
    sceneIdx: number
  ) => {
    if (chapterIdx === activeChapterIndex && sceneIdx === activeSceneIndex) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      const targetMs = Math.round(ratio * currentSceneDurationMs);
      seekSceneMs(targetMs);
    } else {
      selectScene(chapterIdx, sceneIdx);
    }
  };

  return (
    <div
      role="progressbar"
      aria-label="Lesson Progress"
      aria-valuenow={Math.round(activeProgressPct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="w-full flex items-center gap-1.5 py-1 px-1 cursor-pointer select-none"
    >
      {allScenes.map((item, idx) => {
        const isPast =
          item.chapterIndex < activeChapterIndex ||
          (item.chapterIndex === activeChapterIndex && item.sceneIndex < activeSceneIndex);
        const isCurrent =
          item.chapterIndex === activeChapterIndex && item.sceneIndex === activeSceneIndex;

        return (
          <div
            key={idx}
            onClick={(e) => handleBarClick(e, item.chapterIndex, item.sceneIndex)}
            className="group relative flex-1 h-1.5 hover:h-2.5 transition-all rounded-full bg-slate-800 overflow-hidden"
            title={`${item.chapterTitle} • ${item.title}`}
          >
            {/* Segment fill */}
            <div
              className={`h-full rounded-full transition-[width] duration-75 ${
                isPast
                  ? 'bg-decodeai-primary w-full'
                  : isCurrent
                  ? 'bg-gradient-to-r from-decodeai-primary to-decodeai-accent'
                  : 'bg-transparent w-0'
              }`}
              style={isCurrent ? { width: `${activeProgressPct}%` } : undefined}
            />

            {/* Hover Tooltip */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap z-30 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[10px] text-slate-200 shadow-xl">
              <span className="font-semibold text-indigo-400">{item.chapterTitle}</span>: {item.title}
              {isCurrent && (
                <span className="ml-1 text-cyan-300">
                  ({Math.floor(sceneElapsedMs / 1000)}s / {Math.floor(currentSceneDurationMs / 1000)}s)
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
