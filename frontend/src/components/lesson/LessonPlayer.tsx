import React, { useRef, useState, useEffect } from 'react';
import { useLessonStore } from '../../stores/lessonStore';
import { useLessonTimeline } from '../../hooks/useLessonTimeline';
import { useSpeechNarration } from '../../hooks/useAudioNarration';
import { PlayerViewport } from './PlayerViewport';
import { PlayerControls } from './PlayerControls';
import { CompanionPanel } from './CompanionPanel';

interface LessonPlayerProps {
  onBackToInput?: () => void;
}

export const LessonPlayer: React.FC<LessonPlayerProps> = ({ onBackToInput }) => {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const {
    lesson,
    prevScene,
    nextScene,
    restart,
    toggleCaptions,
    getTotalScenes,
    getGlobalSceneIndex,
  } = useLessonStore();

  const { toggleSpeech } = useSpeechNarration();

  // Activate timeline & caption synchronization hook
  useLessonTimeline();

  const totalScenes = getTotalScenes();
  const currentGlobalIndex = getGlobalSceneIndex();
  const isLastSlide = currentGlobalIndex >= totalScenes - 1;

  // Keyboard accessibility shortcuts for slideshow navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keyboard shortcuts if the user is typing in an input, textarea, or select
      const target = e.target as HTMLElement;
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        prevScene();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        nextScene();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        restart();
      } else if (e.code === 'KeyC') {
        e.preventDefault();
        toggleCaptions();
      } else if (e.code === 'KeyS' || e.code === 'Space') {
        e.preventDefault();
        toggleSpeech();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        handleToggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevScene, nextScene, restart, toggleCaptions, toggleSpeech]);

  // Fullscreen toggle handler
  const handleToggleFullscreen = () => {
    if (!playerContainerRef.current) return;

    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  if (!lesson) {
    return null;
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">
            {lesson.title}
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
            <span className="uppercase font-semibold text-decodeai-accent">{lesson.language}</span>
            <span>•</span>
            <span className="text-slate-300 font-medium">
              {totalScenes} {totalScenes === 1 ? 'Slide' : 'Slides'}
            </span>
            <span>•</span>
            <span>{lesson.chapters.length} {lesson.chapters.length === 1 ? 'Chapter' : 'Chapters'}</span>
            <span>•</span>
            <span
              className={
                lesson.lesson_id.includes('fixture')
                  ? 'text-slate-400 font-mono'
                  : 'text-indigo-400 font-semibold font-mono'
              }
            >
              {lesson.lesson_id.includes('fixture')
                ? '📚 Example Lesson'
                : '✨ Visual Lesson'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden md:inline text-[11px] text-slate-400 font-mono bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg">
            Use <kbd className="text-slate-200 font-bold">←</kbd> <kbd className="text-slate-200 font-bold">→</kbd> to navigate
          </span>

          {onBackToInput && (
            <button
              onClick={onBackToInput}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <span>←</span> New Lesson / Change Prompt
            </button>
          )}
        </div>
      </div>

      {/* Main Slideshow Grid: Presentation Canvas + Learning Companion Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Presentation Slideshow Viewport + Controls (8 cols on lg) */}
        <div
          ref={playerContainerRef}
          className="lg:col-span-8 flex flex-col rounded-xl overflow-hidden shadow-2xl bg-slate-950 space-y-0"
        >
          <PlayerViewport />
          <PlayerControls
            onToggleFullscreen={handleToggleFullscreen}
            isFullscreen={isFullscreen}
          />

          {/* Lesson Completion Card (visible on final slide) */}
          {isLastSlide && (
            <div className="p-4 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-indigo-950/60 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🎉</span>
                <div>
                  <h4 className="text-xs font-bold text-emerald-300">
                    Lesson Completed!
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    You have reviewed all {totalScenes} slides in this technical presentation.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={restart}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5"
                >
                  <span>⏮</span> Review from Slide 1
                </button>
                {onBackToInput && (
                  <button
                    type="button"
                    onClick={onBackToInput}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
                  >
                    Create New Lesson
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Companion Sidebar (4 cols on lg) */}
        <div className="lg:col-span-4 h-full min-h-[480px]">
          <CompanionPanel />
        </div>
      </div>
    </div>
  );
};
