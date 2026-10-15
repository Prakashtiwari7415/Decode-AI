import React, { useMemo } from 'react';
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
    activeChapterIndex,
    isPlaying,
    playbackSpeed,
    isMuted,
    captionsEnabled,
    narrationEnabled,
    sceneElapsedMs,
    activeSceneDurationMs,
    getCurrentScene,
    seekSceneMs,
    togglePlay,
    restart,
    prevScene,
    nextScene,
    selectChapter,
    toggleMute,
    toggleCaptions,
    toggleNarration,
    setPlaybackSpeed,
  } = useLessonStore();

  const { isSupported, isSpeaking, toggleSpeech } = useSpeechNarration();

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
    const words = currentScene.narration_text.split(/\s+/).filter(Boolean).length;
    const wpm = lesson?.language === 'hi' ? 110 : 125;
    return Math.max(Math.round((words / wpm) * 60 * 1000), 4000);
  }, [activeSceneDurationMs, currentScene, lesson?.language]);

  const canGoPrevChapter = activeChapterIndex > 0;
  const canGoNextChapter = lesson ? activeChapterIndex < lesson.chapters.length - 1 : false;

  // Format seconds to MM:SS
  const formatTime = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const totalDurationStr = useMemo(() => {
    if (!lesson) return '00:00';
    return formatTime(lesson.total_estimated_duration_ms / 1000);
  }, [lesson]);

  return (
    <div className="w-full bg-slate-900/95 border-t border-slate-800 px-4 py-3 rounded-b-xl space-y-2 select-none">
      {/* Progress Bar */}
      <ProgressBar />

      {/* Main Controls Row */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
        {/* Left Side: Navigation & Playback */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Prev Chapter */}
          <button
            onClick={() => canGoPrevChapter && selectChapter(activeChapterIndex - 1)}
            disabled={!canGoPrevChapter}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            title="Previous Chapter"
            aria-label="Previous Chapter"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>

          {/* Prev Scene */}
          <button
            onClick={prevScene}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Previous Scene (Left Arrow)"
            aria-label="Previous Scene"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Play / Pause Primary Button */}
          <button
            onClick={togglePlay}
            className="p-2 rounded-xl bg-decodeai-primary hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/30 transition-all hover:scale-105"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Next Scene */}
          <button
            onClick={nextScene}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Next Scene (Right Arrow)"
            aria-label="Next Scene"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Next Chapter */}
          <button
            onClick={() => canGoNextChapter && selectChapter(activeChapterIndex + 1)}
            disabled={!canGoNextChapter}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            title="Next Chapter"
            aria-label="Next Chapter"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>

          {/* Restart */}
          <button
            onClick={restart}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Restart Lesson"
            aria-label="Restart Lesson"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* Seek -5s */}
          <button
            onClick={() => seekSceneMs(Math.max(0, sceneElapsedMs - 5000))}
            className="px-1.5 py-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 text-[11px] font-mono font-bold transition-colors"
            title="Rewind 5s (Left Arrow)"
            aria-label="Rewind 5 seconds"
          >
            -5s
          </button>

          {/* Seek +5s */}
          <button
            onClick={() => seekSceneMs(Math.min(currentSceneDurationMs, sceneElapsedMs + 5000))}
            className="px-1.5 py-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 text-[11px] font-mono font-bold transition-colors"
            title="Forward 5s (Right Arrow)"
            aria-label="Forward 5 seconds"
          >
            +5s
          </button>

          {/* Duration Indicator with Estimated Label */}
          <div className="text-xs font-mono text-slate-400 pl-1.5 flex items-center gap-1">
            <span className="text-slate-200 font-semibold">{formatTime(sceneElapsedMs / 1000)}</span>
            <span className="text-slate-600">/</span>
            <span>{formatTime(currentSceneDurationMs / 1000)}</span>
            <span
              className="px-1 py-0.5 rounded bg-slate-800/80 text-[10px] text-slate-400 font-sans font-medium"
              title="Scene timing is estimated proportionally from narration word pace and caption markers"
            >
              (est.)
            </span>
            <span className="text-slate-600 ml-1 hidden md:inline">({totalDurationStr} total)</span>
          </div>
        </div>

        {/* Right Side: Browser Speech Controls, Captions & Speed */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Web Speech API: Speak / Stop Button */}
          {isSupported ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleSpeech}
                className={`p-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                  isSpeaking
                    ? 'bg-cyan-950/70 border-cyan-500/60 text-cyan-300 shadow-sm shadow-cyan-500/20'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
                title={
                  isSpeaking
                    ? 'Stop browser speech narration'
                    : 'Speak current scene using browser speech synthesis'
                }
                aria-label={isSpeaking ? 'Stop Speech' : 'Speak Scene'}
              >
                {isSpeaking ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span>Stop Speech</span>
                  </>
                ) : (
                  <>
                    <span>🗣️</span>
                    <span className="hidden sm:inline">Speak</span>
                  </>
                )}
              </button>

              {/* Auto-Speech Toggle */}
              <button
                onClick={() => {
                  if (!narrationEnabled) {
                    toggleNarration();
                  } else {
                    toggleMute();
                  }
                }}
                className={`p-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                  narrationEnabled && !isMuted
                    ? 'bg-indigo-950/60 border-indigo-700/60 text-indigo-300 hover:bg-indigo-900/60'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
                title={
                  narrationEnabled && !isMuted
                    ? 'Auto-Speech is ON (device voice reads scenes automatically during playback)'
                    : 'Auto-Speech is OFF / Muted'
                }
                aria-label="Toggle Auto Speech Narration"
              >
                <span>{narrationEnabled && !isMuted ? '🔊' : '🔇'}</span>
                <span className="hidden lg:inline">
                  {narrationEnabled && !isMuted ? 'Auto-Voice ON' : 'Muted'}
                </span>
              </button>
            </div>
          ) : (
            <div
              className="px-2 py-1 rounded-lg text-[11px] font-medium bg-slate-800/80 border border-slate-700/60 text-slate-400 flex items-center gap-1.5 select-none"
              title="Browser speech synthesis is not supported in this browser. Lessons play in Caption-Only mode."
            >
              <span>💬</span>
              <span className="hidden sm:inline">Captions Only</span>
            </div>
          )}

          {/* Captions Toggle (CC) */}
          <button
            onClick={toggleCaptions}
            className={`px-2 py-1 rounded-lg text-xs font-mono font-bold border transition-colors ${
              captionsEnabled
                ? 'bg-decodeai-primary/20 border-decodeai-primary text-cyan-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title="Toggle Subtitle Captions (C)"
            aria-label="Toggle Captions"
          >
            CC
          </button>

          {/* Playback Speed Selector */}
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-decodeai-primary font-mono cursor-pointer"
            title="Playback Speed"
            aria-label="Playback Speed"
          >
            <option value={0.75}>0.75x</option>
            <option value={1}>1.0x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
          </select>

          {/* Fullscreen Button */}
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
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
