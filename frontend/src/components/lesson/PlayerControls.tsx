import React, { useMemo } from 'react';
import { useLessonStore } from '../../stores/lessonStore';
import { VoiceName } from '../../types/lesson';
import { ProgressBar } from './ProgressBar';

interface PlayerControlsProps {
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
}

const PREBUILT_VOICES: { id: VoiceName; label: string; desc: string }[] = [
  { id: 'Puck', label: 'Puck', desc: 'Clear & Engaging (Standard)' },
  { id: 'Kore', label: 'Kore', desc: 'Natural & Balanced' },
  { id: 'Charon', label: 'Charon', desc: 'Deep & Informative' },
  { id: 'Fenrir', label: 'Fenrir', desc: 'Authoritative & Energetic' },
  { id: 'Aoede', label: 'Aoede', desc: 'Bright & Articulate' },
];

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
    selectedVoice,
    narrationEnabled,
    audioLoading,
    audioError,
    captionOnlyFallback,
    togglePlay,
    restart,
    prevScene,
    nextScene,
    selectChapter,
    toggleMute,
    toggleCaptions,
    setPlaybackSpeed,
    setSelectedVoice,
    setNarrationEnabled,
    setCaptionOnlyFallback,
  } = useLessonStore();

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
      {/* Audio Loading & Error Notifications */}
      {audioLoading && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-950/60 border border-indigo-800/60 text-xs text-indigo-300">
          <svg className="animate-spin h-3.5 w-3.5 text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Synthesizing scene audio with Gemini TTS ({selectedVoice})...</span>
        </div>
      )}

      {audioError && !audioLoading && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-800/60 text-xs text-amber-200">
          <div className="flex items-center gap-2 overflow-hidden">
            <span>⚠️</span>
            <span className="truncate">{audioError}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setCaptionOnlyFallback(true)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors"
            >
              Caption-Only Mode
            </button>
          </div>
        </div>
      )}

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

          {/* Duration Indicator */}
          <div className="text-xs font-mono text-slate-400 pl-2">
            <span>{totalDurationStr}</span>
            <span className="text-slate-600 ml-1.5">total</span>
          </div>
        </div>

        {/* Right Side: Voice Selector, Audio Toggle, Captions & Speed */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Prebuilt Voice Selection Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 hidden lg:inline">Voice:</span>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value as VoiceName)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-decodeai-primary font-medium cursor-pointer"
              title="Select Gemini Prebuilt Voice"
              aria-label="Select Voice"
            >
              {PREBUILT_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          {/* Voice Narration Audio Toggle */}
          <button
            onClick={() => {
              if (captionOnlyFallback) {
                setCaptionOnlyFallback(false);
                setNarrationEnabled(true);
              } else if (!narrationEnabled) {
                setNarrationEnabled(true);
              } else {
                toggleMute();
              }
            }}
            className={`p-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              captionOnlyFallback || !narrationEnabled
                ? 'bg-amber-950/40 border-amber-800/50 text-amber-300'
                : !isMuted
                ? 'bg-indigo-950/60 border-indigo-700/60 text-indigo-300 hover:bg-indigo-900/60'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title={
              captionOnlyFallback
                ? 'Caption-Only Mode (Click to re-enable audio)'
                : !narrationEnabled
                ? 'Narration Disabled'
                : isMuted
                ? 'Unmute Speech Narration (M)'
                : 'Mute Speech Narration (M)'
            }
            aria-label="Toggle Speech Narration"
          >
            {captionOnlyFallback || !narrationEnabled ? (
              <>
                <span>💬</span>
                <span className="hidden sm:inline">Caption Only</span>
              </>
            ) : !isMuted ? (
              <>
                <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
                <span className="hidden sm:inline">{selectedVoice} ON</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
                <span className="hidden sm:inline">Muted</span>
              </>
            )}
          </button>

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
