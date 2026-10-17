import React from 'react';
import { useLessonStore } from '../../stores/lessonStore';
import { useSpeechNarration } from '../../hooks/useAudioNarration';
import { ProgressBar } from './ProgressBar';

interface PlayerControlsProps {
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  onToggleFullscreen,
  isFullscreen = false,
}) => {
  const {
    lesson,
    captionsEnabled,
    narrationEnabled,
    isMuted,
    nextScene,
    prevScene,
    restart,
    toggleCaptions,
    toggleNarration,
    toggleMute,
    selectScene,
    getTotalScenes,
    getGlobalSceneIndex,
  } = useLessonStore();

  const { isSupported, isSpeaking, toggleSpeech } = useSpeechNarration();

  const totalScenes = getTotalScenes();
  const currentGlobalIndex = getGlobalSceneIndex();
  const isFirstSlide = currentGlobalIndex === 0;
  const isLastSlide = currentGlobalIndex >= totalScenes - 1;

  // Flatten slides for direct quick-jump selector
  const allSlides = React.useMemo(() => {
    if (!lesson) return [];
    const list: { chapterIndex: number; sceneIndex: number; label: string }[] = [];
    let count = 1;
    lesson.chapters.forEach((chap, cIdx) => {
      chap.scenes.forEach((sc, sIdx) => {
        list.push({
          chapterIndex: cIdx,
          sceneIndex: sIdx,
          label: `Slide ${count}: ${sc.title}`,
        });
        count++;
      });
    });
    return list;
  }, [lesson]);

  return (
    <div className="w-full bg-slate-900/95 border-t border-slate-800 px-4 py-3.5 rounded-b-xl space-y-3 select-none">
      {/* Interactive Step-by-Step Slide Progress Bar */}
      <ProgressBar />

      {/* Main Slide Presentation Controls Row */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
        {/* Left Side: Slide Navigation (Prev / Counter / Next) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Previous Slide Button */}
          <button
            type="button"
            onClick={prevScene}
            disabled={isFirstSlide}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 disabled:cursor-not-allowed text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5 shadow-sm"
            title={isFirstSlide ? 'First slide reached' : 'Previous Slide (Left Arrow)'}
            aria-label="Previous Slide"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Previous</span>
          </button>

          {/* Slide Counter & Jump Selector */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono">
            <span className="text-slate-400 font-sans hidden sm:inline">Slide</span>
            <span className="font-bold text-slate-100">{currentGlobalIndex + 1}</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">{totalScenes}</span>

            {/* Quick jump dropdown */}
            {allSlides.length > 1 && (
              <select
                aria-label="Jump directly to slide"
                value={`${useLessonStore.getState().activeChapterIndex}-${useLessonStore.getState().activeSceneIndex}`}
                onChange={(e) => {
                  const [c, s] = e.target.value.split('-').map(Number);
                  selectScene(c, s);
                }}
                className="ml-1.5 bg-slate-900 border border-slate-700/80 rounded px-1.5 py-0.5 text-[11px] text-slate-300 focus:outline-none focus:ring-1 focus:ring-decodeai-primary font-sans cursor-pointer"
                title="Jump directly to a specific slide"
              >
                {allSlides.map((s, idx) => (
                  <option key={idx} value={`${s.chapterIndex}-${s.sceneIndex}`}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Next Slide Button (Prominent Primary Action) */}
          <button
            type="button"
            onClick={nextScene}
            disabled={isLastSlide}
            className="px-4 py-2 rounded-xl bg-decodeai-primary hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-decodeai-primary disabled:cursor-not-allowed text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-indigo-500/20 hover:scale-[1.02]"
            title={isLastSlide ? 'Last slide reached' : 'Next Slide (Right Arrow)'}
            aria-label="Next Slide"
          >
            <span>Next</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Restart from Beginning */}
          <button
            type="button"
            onClick={restart}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Restart Lesson from Slide 1"
            aria-label="Restart Lesson"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Right Side: Speech Narration & Subtitle Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Read Current Slide Button */}
          {isSupported ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleSpeech}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                  isSpeaking
                    ? 'bg-cyan-950/80 border-cyan-500/80 text-cyan-300 shadow-sm shadow-cyan-500/30'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
                title={
                  isSpeaking
                    ? 'Stop reading current slide'
                    : 'Read current slide using device speech synthesis'
                }
                aria-label={isSpeaking ? 'Stop Speech' : 'Read Slide'}
              >
                {isSpeaking ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span>Stop Speech</span>
                  </>
                ) : (
                  <>
                    <span>🗣️</span>
                    <span>Read Slide</span>
                  </>
                )}
              </button>

              {/* Auto-Voice Toggle */}
              <button
                type="button"
                onClick={() => {
                  if (!narrationEnabled) {
                    toggleNarration();
                  } else {
                    toggleMute();
                  }
                }}
                className={`p-2 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                  narrationEnabled && !isMuted
                    ? 'bg-indigo-950/60 border-indigo-700/60 text-indigo-300 hover:bg-indigo-900/60'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
                title={
                  narrationEnabled && !isMuted
                    ? 'Auto-Voice is ON (device voice reads each slide automatically without forcing slide advance)'
                    : 'Auto-Voice is OFF / Muted'
                }
                aria-label="Toggle Auto Speech Narration"
              >
                <span>{narrationEnabled && !isMuted ? '🔊' : '🔇'}</span>
                <span className="hidden lg:inline text-xs font-semibold">
                  {narrationEnabled && !isMuted ? 'Auto-Voice ON' : 'Auto-Voice OFF'}
                </span>
              </button>
            </div>
          ) : (
            <div
              className="px-2.5 py-1.5 rounded-xl text-[11px] font-medium bg-slate-800/80 border border-slate-700/60 text-slate-400 flex items-center gap-1.5 select-none"
              title="Browser speech synthesis is not supported in this browser. Slideshow runs in Subtitle mode."
            >
              <span>💬</span>
              <span>Subtitles Only</span>
            </div>
          )}

          {/* Subtitles Toggle (CC) */}
          <button
            type="button"
            onClick={toggleCaptions}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold border transition-colors ${
              captionsEnabled
                ? 'bg-decodeai-primary/20 border-decodeai-primary text-cyan-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title="Toggle Subtitles / Captions (C)"
            aria-label="Toggle Captions"
          >
            CC
          </button>

          {/* Fullscreen Button */}
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen Presentation (F)'}
              aria-label="Toggle Fullscreen"
            >
              {isFullscreen ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
