import React, { useMemo } from 'react';
import { useLessonStore } from '../../stores/lessonStore';

export const ProgressBar: React.FC = () => {
  const {
    lesson,
    activeChapterIndex,
    activeSceneIndex,
    selectScene,
  } = useLessonStore();

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

  return (
    <div className="w-full flex items-center gap-1.5 py-1 px-1 cursor-pointer select-none">
      {allScenes.map((item, idx) => {
        const isPast =
          item.chapterIndex < activeChapterIndex ||
          (item.chapterIndex === activeChapterIndex && item.sceneIndex < activeSceneIndex);
        const isCurrent =
          item.chapterIndex === activeChapterIndex && item.sceneIndex === activeSceneIndex;

        return (
          <div
            key={idx}
            onClick={() => selectScene(item.chapterIndex, item.sceneIndex)}
            className="group relative flex-1 h-1.5 hover:h-2.5 transition-all rounded-full bg-slate-800 overflow-hidden"
            title={`${item.chapterTitle} • ${item.title}`}
          >
            {/* Segment fill */}
            <div
              className={`h-full transition-all duration-150 rounded-full ${
                isPast
                  ? 'bg-decodeai-primary w-full'
                  : isCurrent
                  ? 'bg-gradient-to-r from-decodeai-primary to-decodeai-accent w-full'
                  : 'bg-transparent w-0'
              }`}
            />

            {/* Hover Tooltip */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap z-30 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[10px] text-slate-200 shadow-xl">
              <span className="font-semibold text-indigo-400">{item.chapterTitle}</span>: {item.title}
            </div>
          </div>
        );
      })}
    </div>
  );
};
