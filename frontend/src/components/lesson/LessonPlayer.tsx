import React, { useRef, useState, useEffect } from 'react';
import { useLessonStore } from '../../stores/lessonStore';
import { useLessonTimeline } from '../../hooks/useLessonTimeline';
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
    togglePlay,
    prevScene,
    nextScene,
    toggleMute,
    toggleCaptions,
  } = useLessonStore();

  // Activate timeline synchronization hook
  useLessonTimeline();

  // Keyboard accessibility shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keyboard shortcuts if the user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        prevScene();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        nextScene();
      } else if (e.code === 'KeyM') {
        toggleMute();
      } else if (e.code === 'KeyC') {
        toggleCaptions();
      } else if (e.code === 'KeyF') {
        handleToggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, prevScene, nextScene, toggleMute, toggleCaptions]);

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
            <span>{lesson.chapters.length} Chapters</span>
            <span>•</span>
            <span className="text-slate-300">
              {Math.round(lesson.total_estimated_duration_ms / 1000)}s runtime
            </span>
            <span>•</span>
            <span
              className={
                lesson.lesson_id.includes('fixture')
                  ? 'text-slate-400 font-mono'
                  : 'text-indigo-400 font-semibold font-mono'
              }
            >
              {lesson.lesson_id.includes('fixture')
                ? '📌 Predefined Fixture'
                : `✨ ${lesson.gemini_model_version}`}
            </span>
          </div>
        </div>

        {onBackToInput && (
          <button
            onClick={onBackToInput}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <span>←</span> New Lesson / Change Prompt
          </button>
        )}
      </div>

      {/* Main Player Grid: Widescreen Viewport + Learning Companion Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Video Viewport + Controls (8 cols on lg) */}
        <div
          ref={playerContainerRef}
          className="lg:col-span-8 flex flex-col rounded-xl overflow-hidden shadow-2xl bg-slate-950"
        >
          <PlayerViewport />
          <PlayerControls
            onToggleFullscreen={handleToggleFullscreen}
            isFullscreen={isFullscreen}
          />
        </div>

        {/* Right Column: Companion Sidebar (4 cols on lg) */}
        <div className="lg:col-span-4 h-full min-h-[480px]">
          <CompanionPanel />
        </div>
      </div>
    </div>
  );
};
