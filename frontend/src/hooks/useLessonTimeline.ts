import { useEffect, useRef, useCallback } from 'react';
import { useLessonStore } from '../stores/lessonStore';
import { useNarration } from './useNarration';
import { Caption } from '../types/lesson';

export function useLessonTimeline() {
  const {
    lesson,
    activeChapterIndex,
    activeSceneIndex,
    isPlaying,
    playbackSpeed,
    isMuted,
    captionsEnabled,
    getCurrentScene,
    setSceneElapsedMs,
    setCurrentCaptionText,
    nextScene,
  } = useLessonStore();

  const narration = useNarration();
  const startTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const speechFinishedRef = useRef<boolean>(false);
  const sceneFinishedRef = useRef<boolean>(false);

  // Compute scene duration from captions or estimation
  const getSceneDurationMs = useCallback((): number => {
    const scene = getCurrentScene();
    if (!scene) return 6000;
    if (scene.captions && scene.captions.length > 0) {
      const lastCaption = scene.captions[scene.captions.length - 1];
      return Math.max(lastCaption.offset_ms + lastCaption.duration_ms, 4000);
    }
    // Fallback: estimate from narration word count (~130 wpm)
    const words = scene.narration_text.split(/\s+/).length;
    return Math.max(Math.round((words / 130) * 60 * 1000), 5000);
  }, [getCurrentScene]);

  // Find active caption text at current elapsed offset
  const resolveActiveCaption = useCallback((captions: Caption[], elapsedMs: number, fullText: string): string => {
    if (!captions || captions.length === 0) {
      return fullText;
    }

    const active = captions.find(
      (c) => elapsedMs >= c.offset_ms && elapsedMs < c.offset_ms + c.duration_ms
    );
    if (active) return active.text;

    // If past all captions, show last caption
    const last = captions[captions.length - 1];
    if (elapsedMs >= last.offset_ms + last.duration_ms) {
      return last.text;
    }

    // Default to first caption
    return captions[0].text;
  }, []);

  // Main playback loop
  useEffect(() => {
    if (!isPlaying || !lesson) {
      narration.stop();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const scene = getCurrentScene();
    if (!scene) return;

    speechFinishedRef.current = false;
    sceneFinishedRef.current = false;
    const durationMs = getSceneDurationMs();
    startTimeRef.current = performance.now();

    // Start voice narration if not muted
    if (!isMuted && narration.speechSupported) {
      narration.speak(scene.narration_text, lesson.language, playbackSpeed, () => {
        speechFinishedRef.current = true;
      });
    } else {
      speechFinishedRef.current = true;
    }

    const tick = () => {
      const now = performance.now();
      const rawElapsed = (now - startTimeRef.current) * playbackSpeed;
      const effectiveElapsed = Math.min(rawElapsed, durationMs);

      setSceneElapsedMs(effectiveElapsed);

      if (captionsEnabled) {
        const caption = resolveActiveCaption(scene.captions, effectiveElapsed, scene.narration_text);
        setCurrentCaptionText(caption);
      }

      // Determine scene completion: both timer expired AND speech finished (if speech is active)
      const timerExpired = rawElapsed >= durationMs;
      const speechEndedOrMuted = isMuted || !narration.speechSupported || speechFinishedRef.current;

      if (timerExpired && speechEndedOrMuted && !sceneFinishedRef.current) {
        sceneFinishedRef.current = true;
        const advanced = nextScene();
        if (!advanced) {
          // End of lesson reached
          narration.stop();
        }
        return;
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      narration.stop();
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
    lesson,
    captionsEnabled,
    getCurrentScene,
    getSceneDurationMs,
    resolveActiveCaption,
    setSceneElapsedMs,
    setCurrentCaptionText,
    nextScene,
  ]);

  return {
    speechSupported: narration.speechSupported,
    isSpeaking: narration.isSpeaking,
  };
}
