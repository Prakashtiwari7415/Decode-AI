import React from 'react';
import { useLessonStore } from '../../stores/lessonStore';

export const CaptionOverlay: React.FC = () => {
  const { captionsEnabled, currentCaptionText } = useLessonStore();

  if (!captionsEnabled || !currentCaptionText) {
    return null;
  }

  return (
    <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none flex justify-center">
      <div className="max-w-2xl px-5 py-2.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-700/50 shadow-2xl text-center">
        <p className="text-sm md:text-base font-medium text-slate-100 tracking-wide leading-relaxed drop-shadow-md">
          {currentCaptionText}
        </p>
      </div>
    </div>
  );
};
