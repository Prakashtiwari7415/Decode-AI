import React, { useMemo } from 'react';
import { useLessonStore } from '../../stores/lessonStore';

export const ProgressBar: React.FC = () => {
  const {
    lesson,
    selectScene,
    getTotalScenes,
    getGlobalSceneIndex,
  } = useLessonStore();

  const totalScenes = getTotalScenes();
  const currentGlobalIndex = getGlobalSceneIndex();

  // Flatten all scenes to compute global slide indices
  const allSlides = useMemo(() => {
    if (!lesson) return [];
    const list: {
      globalIndex: number;
      chapterIndex: number;
      sceneIndex: number;
      title: string;
      chapterTitle: string;
    }[] = [];

    let count = 0;
    lesson.chapters.forEach((chap, cIdx) => {
      chap.scenes.forEach((sc, sIdx) => {
        list.push({
          globalIndex: count,
          chapterIndex: cIdx,
          sceneIndex: sIdx,
          title: sc.title,
          chapterTitle: chap.title,
        });
        count++;
      });
    });
    return list;
  }, [lesson]);

  if (!lesson || allSlides.length === 0) return null;

  return (
    <div
      role="progressbar"
      aria-label="Slide Progress"
      aria-valuenow={currentGlobalIndex + 1}
      aria-valuemin={1}
      aria-valuemax={totalScenes}
      className="w-full flex items-center gap-1.5 py-1 px-0.5 select-none"
    >
      {allSlides.map((slide, idx) => {
        const isPast = slide.globalIndex < currentGlobalIndex;
        const isCurrent = slide.globalIndex === currentGlobalIndex;

        return (
          <button
            key={idx}
            type="button"
            onClick={() => selectScene(slide.chapterIndex, slide.sceneIndex)}
            aria-label={`Jump to slide ${idx + 1}: ${slide.title}`}
            className="group relative flex-1 h-2 hover:h-3 transition-all rounded-full bg-slate-800/90 focus:outline-none focus:ring-1 focus:ring-cyan-400 overflow-hidden cursor-pointer"
            title={`Slide ${idx + 1} of ${totalScenes}: ${slide.title} (${slide.chapterTitle})`}
          >
            {/* Segment fill */}
            <div
              className={`h-full rounded-full transition-all duration-200 ${
                isPast
                  ? 'bg-indigo-600'
                  : isCurrent
                  ? 'bg-decodeai-accent shadow-sm shadow-cyan-400/50'
                  : 'bg-transparent'
              }`}
            />

            {/* Hover Tooltip */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap z-30 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[10px] text-slate-200 shadow-2xl">
              <span className="font-semibold text-decodeai-accent">Slide {idx + 1}:</span>{' '}
              <span className="text-slate-100">{slide.title}</span>
              <span className="text-slate-400 ml-1">({slide.chapterTitle})</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
