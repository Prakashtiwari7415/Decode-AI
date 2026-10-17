import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useLessonStore } from '../stores/lessonStore';
import { useSpeechNarration, UseSpeechNarrationResult } from './useAudioNarration';
import {
  calibrateSceneSegments,
  findActiveSegment,
  TimedNarrationSegment,
} from '../utils/captionTiming';

export interface UseLessonTimelineResult {
  audio: UseSpeechNarrationResult;
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
    activeSceneDurationMs,
    seekTargetMs,
    captionsEnabled,
    getCurrentScene,
    setSceneElapsedMs,
    setCurrentCaptionText,
    setActiveHighlightTerm,
    setActiveSegmentIndex,
    seekSceneMs,
    clearSeekTarget,
  } = useLessonStore();

  const speech = useSpeechNarration();
  const animationFrameRef = useRef<number | null>(null);
  const lastClockTimeRef = useRef<number>(performance.now());
  const sceneElapsedMsRef = useRef<number>(0);
  const sceneFinishedRef = useRef<boolean>(false);

  const scene = getCurrentScene();

  // Compute scene duration based on schema captions or language-specific word count
  const getSceneDurationMs = useCallback((): number => {
    if (activeSceneDurationMs && activeSceneDurationMs > 0) {
      return activeSceneDurationMs;
    }
    if (!scene) return 6000;
    if (scene.captions && scene.captions.length > 0) {
      const lastCaption = scene.captions[scene.captions.length - 1];
      return Math.max(lastCaption.offset_ms + lastCaption.duration_ms, 4000);
    }
    // Estimated narration duration based on word pace
    const words = scene.narration_text.split(/\s+/).filter(Boolean).length;
    const wpm = lesson?.language === 'hi' ? 110 : 125;
    return Math.max(Math.round((words / wpm) * 60 * 1000), 4000);
  }, [activeSceneDurationMs, scene, lesson?.language]);

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

    speech.stopSpeech();
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
    speech,
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

  // In slideshow presentation mode, continuous video autoplay is disabled.
  // Scene transitions are strictly user-controlled via slide navigation.
  useEffect(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, [isPlaying]);

  return {
    audio: speech,
    getSceneDurationMs,
    segments,
    activeSegment,
    seekToMs,
  };
}
