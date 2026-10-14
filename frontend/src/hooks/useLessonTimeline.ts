import { useEffect, useRef, useCallback } from 'react';
import { useLessonStore } from '../stores/lessonStore';
import { useAudioNarration, UseAudioNarrationResult } from './useAudioNarration';
import { Caption } from '../types/lesson';

export interface UseLessonTimelineResult {
  audio: UseAudioNarrationResult;
  getSceneDurationMs: () => number;
}

export function useLessonTimeline(): UseLessonTimelineResult {
  const {
    lesson,
    activeChapterIndex,
    activeSceneIndex,
    isPlaying,
    playbackSpeed,
    isMuted,
    narrationEnabled,
    captionOnlyFallback,
    activeSceneDurationMs,
    captionsEnabled,
    getCurrentScene,
    setSceneElapsedMs,
    setCurrentCaptionText,
    nextScene,
  } = useLessonStore();

  const audio = useAudioNarration();
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const sceneFinishedRef = useRef<boolean>(false);

  // Compute scene duration: prioritize actual decoded audio duration, then captions, then word-count estimate
  const getSceneDurationMs = useCallback((): number => {
    if (activeSceneDurationMs && activeSceneDurationMs > 0) {
      return activeSceneDurationMs;
    }
    const scene = getCurrentScene();
    if (!scene) return 6000;
    if (scene.captions && scene.captions.length > 0) {
      const lastCaption = scene.captions[scene.captions.length - 1];
      return Math.max(lastCaption.offset_ms + lastCaption.duration_ms, 4000);
    }
    // Fallback: estimate from narration word count (~125 wpm)
    const words = scene.narration_text.split(/\s+/).length;
    return Math.max(Math.round((words / 125) * 60 * 1000), 4000);
  }, [activeSceneDurationMs, getCurrentScene]);

  // Find active caption text at current elapsed offset
  const resolveActiveCaption = useCallback(
    (captions: Caption[], elapsedMs: number, fullNarration: string): string => {
      // If no discrete captions exist or only 1 general caption, show full scene narration
      if (!captions || captions.length === 0) {
        return fullNarration;
      }

      // Check for time-sliced caption matching current elapsed position
      const active = captions.find(
        (c) => elapsedMs >= c.offset_ms && elapsedMs < c.offset_ms + c.duration_ms
      );
      if (active) return active.text;

      // If beyond all captions, keep displaying the last caption
      const last = captions[captions.length - 1];
      if (elapsedMs >= last.offset_ms + last.duration_ms) {
        return last.text;
      }

      return captions[0]?.text || fullNarration;
    },
    []
  );

  // Unified playback & synchronization loop
  useEffect(() => {
    if (!isPlaying || !lesson) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const scene = getCurrentScene();
    if (!scene) return;

    sceneFinishedRef.current = false;
    const durationMs = getSceneDurationMs();
    startTimeRef.current = performance.now();

    const isAudioActive =
      narrationEnabled &&
      !isMuted &&
      !captionOnlyFallback &&
      audio.audioElement !== null &&
      audio.audioElement.src !== '';

    // Audio-driven clock loop: Audio element's currentTime is the master reference clock
    const tick = () => {
      let effectiveElapsed = 0;

      if (isAudioActive && audio.audioElement && Number.isFinite(audio.audioElement.currentTime)) {
        // Driven strictly by HTMLAudioElement playback position
        effectiveElapsed = Math.min(audio.audioElement.currentTime * 1000, durationMs);
      } else {
        // Fallback timer clock for caption-only mode or muted playback
        const now = performance.now();
        const rawElapsed = (now - startTimeRef.current) * playbackSpeed;
        effectiveElapsed = Math.min(rawElapsed, durationMs);
      }

      setSceneElapsedMs(effectiveElapsed);

      if (captionsEnabled) {
        const caption = resolveActiveCaption(
          scene.captions,
          effectiveElapsed,
          scene.narration_text
        );
        setCurrentCaptionText(caption);
      }

      // Handle scene completion
      const isComplete = effectiveElapsed >= durationMs;

      if (isComplete && !sceneFinishedRef.current) {
        sceneFinishedRef.current = true;
        const advanced = nextScene();
        if (!advanced) {
          audio.stopAudio();
        }
        return;
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [
    isPlaying,
    activeChapterIndex,
    activeSceneIndex,
    playbackSpeed,
    isMuted,
    narrationEnabled,
    captionOnlyFallback,
    lesson,
    captionsEnabled,
    getCurrentScene,
    getSceneDurationMs,
    resolveActiveCaption,
    setSceneElapsedMs,
    setCurrentCaptionText,
    nextScene,
    audio,
  ]);

  return {
    audio,
    getSceneDurationMs,
  };
}
