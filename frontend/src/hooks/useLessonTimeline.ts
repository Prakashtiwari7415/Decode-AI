import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useLessonStore } from '../stores/lessonStore';
import { useAudioNarration, UseAudioNarrationResult } from './useAudioNarration';
import {
  calibrateSceneSegments,
  findActiveSegment,
  TimedNarrationSegment,
} from '../utils/captionTiming';

export interface UseLessonTimelineResult {
  audio: UseAudioNarrationResult;
  getSceneDurationMs: () => number;
  segments: TimedNarrationSegment[];
  activeSegment: TimedNarrationSegment | null;
  seekToMs: (targetMs: number) => void;
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
    audioLoading,
    seekTargetMs,
    captionsEnabled,
    getCurrentScene,
    setSceneElapsedMs,
    setCurrentCaptionText,
    setActiveHighlightTerm,
    setActiveSegmentIndex,
    seekSceneMs,
    clearSeekTarget,
    nextScene,
  } = useLessonStore();

  const audio = useAudioNarration();
  const animationFrameRef = useRef<number | null>(null);
  const lastClockTimeRef = useRef<number>(performance.now());
  const sceneElapsedMsRef = useRef<number>(0);
  const sceneFinishedRef = useRef<boolean>(false);

  const scene = getCurrentScene();

  // Compute scene duration: prioritize actual decoded audio duration, then captions, then word-count estimate
  const getSceneDurationMs = useCallback((): number => {
    if (activeSceneDurationMs && activeSceneDurationMs > 0) {
      return activeSceneDurationMs;
    }
    if (!scene) return 6000;
    if (scene.captions && scene.captions.length > 0) {
      const lastCaption = scene.captions[scene.captions.length - 1];
      return Math.max(lastCaption.offset_ms + lastCaption.duration_ms, 4000);
    }
    // Fallback: estimate from narration word count (~125 wpm)
    const words = scene.narration_text.split(/\s+/).length;
    return Math.max(Math.round((words / 125) * 60 * 1000), 4000);
  }, [activeSceneDurationMs, scene]);

  const durationMs = getSceneDurationMs();

  // Calibrated contiguous sentence segments partitioning [0, durationMs]
  const segments = useMemo(() => {
    return calibrateSceneSegments(scene, activeSceneDurationMs || durationMs);
  }, [scene, activeSceneDurationMs, durationMs]);

  // Current active segment
  const activeSegment = useMemo(() => {
    return findActiveSegment(segments, sceneElapsedMsRef.current);
  }, [segments]);

  // Direct seeking helper
  const seekToMs = useCallback(
    (targetMs: number) => {
      seekSceneMs(targetMs);
    },
    [seekSceneMs]
  );

  // Handle intra-scene seeking requests
  useEffect(() => {
    if (seekTargetMs === null) return;

    const targetSec = seekTargetMs / 1000;
    audio.seekTo(targetSec);
    sceneElapsedMsRef.current = seekTargetMs;
    setSceneElapsedMs(seekTargetMs);

    const targetSegment = findActiveSegment(segments, seekTargetMs);
    if (targetSegment) {
      if (captionsEnabled) {
        setCurrentCaptionText(targetSegment.text);
      }
      setActiveSegmentIndex(targetSegment.index);
      setActiveHighlightTerm(targetSegment.highlightedTerms[0] || null);
    }

    clearSeekTarget();
  }, [
    seekTargetMs,
    audio,
    segments,
    captionsEnabled,
    setSceneElapsedMs,
    setCurrentCaptionText,
    setActiveSegmentIndex,
    setActiveHighlightTerm,
    clearSeekTarget,
  ]);

  // Scene transition initializer
  useEffect(() => {
    sceneElapsedMsRef.current = 0;
    sceneFinishedRef.current = false;
    lastClockTimeRef.current = performance.now();

    const initialSegment = segments[0] || null;
    if (initialSegment) {
      if (captionsEnabled) {
        setCurrentCaptionText(initialSegment.text);
      }
      setActiveSegmentIndex(0);
      setActiveHighlightTerm(initialSegment.highlightedTerms[0] || null);
    }
  }, [
    activeChapterIndex,
    activeSceneIndex,
    segments,
    captionsEnabled,
    setCurrentCaptionText,
    setActiveSegmentIndex,
    setActiveHighlightTerm,
  ]);

  // Unified master reference clock & coordinated synchronization loop
  useEffect(() => {
    if (!isPlaying || !lesson) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    if (!scene) return;

    lastClockTimeRef.current = performance.now();

    const isAudioActive =
      narrationEnabled &&
      !isMuted &&
      !captionOnlyFallback &&
      !audioLoading &&
      audio.audioElement !== null &&
      audio.audioElement.src !== '' &&
      !audio.audioElement.error;

    const tick = () => {
      let effectiveElapsed = 0;

      if (isAudioActive && audio.audioElement && Number.isFinite(audio.audioElement.currentTime)) {
        // Master clock: driven directly by HTMLAudioElement playback position
        effectiveElapsed = Math.min(audio.audioElement.currentTime * 1000, durationMs);
        sceneElapsedMsRef.current = effectiveElapsed;
        lastClockTimeRef.current = performance.now();
      } else if (!audioLoading) {
        // Fallback timer clock for caption-only mode or muted playback
        const now = performance.now();
        const delta = (now - lastClockTimeRef.current) * playbackSpeed;
        lastClockTimeRef.current = now;
        effectiveElapsed = Math.min(sceneElapsedMsRef.current + delta, durationMs);
        sceneElapsedMsRef.current = effectiveElapsed;
      } else {
        // Audio is currently buffering or synthesizing: pause clock progress
        lastClockTimeRef.current = performance.now();
        effectiveElapsed = sceneElapsedMsRef.current;
      }

      setSceneElapsedMs(effectiveElapsed);

      // Coordinate active caption and visual highlighted term
      const matchedSegment = findActiveSegment(segments, effectiveElapsed);
      if (matchedSegment) {
        if (captionsEnabled) {
          setCurrentCaptionText(matchedSegment.text);
        }
        setActiveSegmentIndex(matchedSegment.index);
        setActiveHighlightTerm(matchedSegment.highlightedTerms[0] || null);
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
    audioLoading,
    durationMs,
    lesson,
    captionsEnabled,
    scene,
    segments,
    setSceneElapsedMs,
    setCurrentCaptionText,
    setActiveSegmentIndex,
    setActiveHighlightTerm,
    nextScene,
    audio,
  ]);

  return {
    audio,
    getSceneDurationMs,
    segments,
    activeSegment,
    seekToMs,
  };
}
