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
    playbackSpeed,
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
    nextScene,
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

  // High-precision timeline clock driving coordinated animation and caption rendering
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

    const tick = () => {
      const now = performance.now();
      const delta = (now - lastClockTimeRef.current) * playbackSpeed;
      lastClockTimeRef.current = now;

      const effectiveElapsed = Math.min(sceneElapsedMsRef.current + delta, durationMs);
      sceneElapsedMsRef.current = effectiveElapsed;
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
        speech.stopSpeech();
        nextScene();
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
    speech,
  ]);

  return {
    audio: speech,
    getSceneDurationMs,
    segments,
    activeSegment,
    seekToMs,
  };
}
