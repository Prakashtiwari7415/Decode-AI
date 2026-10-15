import React from 'react';
import { useLessonStore } from '../../stores/lessonStore';

export const CaptionOverlay: React.FC = () => {
  const { captionsEnabled, currentCaptionText } = useLessonStore();

  if (!captionsEnabled || !currentCaptionText) {
    return null;
  }

  return (
    <div className="absolute bottom-3 left-4 right-4 z-20 pointer-events-none flex justify-center">
      <div className="max-w-2xl px-4 py-2 rounded-lg bg-slate-950/90 backdrop-blur-md border border-slate-800/80 shadow-xl text-center transition-all">
        <p className="text-xs sm:text-sm font-medium text-slate-100 tracking-wide leading-relaxed">
          {currentCaptionText}
        </p>
      </div>
    </div>
  );
};
