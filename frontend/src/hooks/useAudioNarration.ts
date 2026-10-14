import { useEffect, useRef, useCallback } from 'react';
import { useLessonStore } from '../stores/lessonStore';
import { fetchSceneNarrationAudio, ApiError } from '../services/api';

interface CachedAudio {
  blob: Blob;
  url: string;
  durationMs: number;
}

export interface UseAudioNarrationResult {
  audioElement: HTMLAudioElement | null;
  retry: () => Promise<void>;
  seekTo: (timeSeconds: number) => void;
  restartAudio: () => void;
  stopAudio: () => void;
}

export function useAudioNarration(): UseAudioNarrationResult {
  const {
    lesson,
    activeChapterIndex,
    activeSceneIndex,
    isPlaying,
    playbackSpeed,
    isMuted,
    narrationEnabled,
    selectedVoice,
    captionOnlyFallback,
    getCurrentScene,
    setAudioLoading,
    setAudioError,
    setCaptionOnlyFallback,
    setActiveSceneDurationMs,
  } = useLessonStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<string, CachedAudio>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize audio element once
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const audio = new Audio();
      audio.preload = 'auto';
      audioRef.current = audio;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      // Revoke all created object URLs on complete unmount
      cacheRef.current.forEach((cached) => {
        try {
          URL.revokeObjectURL(cached.url);
        } catch {
          // Ignore revocation issues on cleanup
        }
      });
      cacheRef.current.clear();
    };
  }, []);

  const getCacheKey = useCallback(
    (sceneId: string, text: string): string => {
      const lang = lesson?.language || 'en';
      return `${lang}:${selectedVoice}:${sceneId}:${text.trim().slice(0, 100)}`;
    },
    [lesson?.language, selectedVoice]
  );

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, []);

  const seekTo = useCallback((timeSeconds: number) => {
    const audio = audioRef.current;
    if (audio && Number.isFinite(timeSeconds)) {
      audio.currentTime = Math.max(0, timeSeconds);
    }
  }, []);

  const restartAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      if (isPlaying && narrationEnabled && !isMuted && !captionOnlyFallback) {
        audio.play().catch(() => {
          // Autoplay policy or user gesture restriction
        });
      }
    }
  }, [isPlaying, narrationEnabled, isMuted, captionOnlyFallback]);

  // Load and cache audio whenever active scene, voice, or language changes
  const loadAudioForCurrentScene = useCallback(async () => {
    const scene = getCurrentScene();
    const audio = audioRef.current;
    if (!lesson || !scene || !audio) return;

    // Immediately stop prior playback
    audio.pause();
    audio.currentTime = 0;

    // If narration is disabled by user, skip audio fetch
    if (!narrationEnabled) {
      setAudioLoading(false);
      setAudioError(null);
      return;
    }

    const cacheKey = getCacheKey(scene.scene_id, scene.narration_text);
    const cached = cacheRef.current.get(cacheKey);

    if (cached) {
      audio.src = cached.url;
      audio.playbackRate = playbackSpeed;
      setActiveSceneDurationMs(cached.durationMs);
      setAudioLoading(false);
      setAudioError(null);
      setCaptionOnlyFallback(false);

      if (isPlaying && !isMuted) {
        audio.play().catch(() => {});
      }
      return;
    }

    // Abort prior pending fetch if user rapidly changed scenes
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setAudioLoading(true);
    setAudioError(null);

    const isFixture = Boolean(
      lesson.lesson_id.includes('fixture') ||
      (lesson.gemini_model_version && lesson.gemini_model_version.includes('fixture'))
    );

    try {
      const blob = await fetchSceneNarrationAudio({
        text: scene.narration_text,
        language: lesson.language,
        voice: selectedVoice,
        is_fixture: isFixture,
      });

      const objectUrl = URL.createObjectURL(blob);
      audio.src = objectUrl;
      audio.playbackRate = playbackSpeed;

      // Decode exact duration from the loaded audio buffer
      const durationMs = await new Promise<number>((resolve) => {
        const onLoaded = () => {
          audio.removeEventListener('loadedmetadata', onLoaded);
          const durSec = audio.duration;
          if (Number.isFinite(durSec) && durSec > 0) {
            resolve(Math.round(durSec * 1000));
          } else {
            // Fallback estimation if metadata fails to report duration
            resolve(Math.max(4000, Math.round((scene.narration_text.split(/\s+/).length / 125) * 60 * 1000)));
          }
        };

        if (audio.readyState >= 1 && Number.isFinite(audio.duration) && audio.duration > 0) {
          resolve(Math.round(audio.duration * 1000));
        } else {
          audio.addEventListener('loadedmetadata', onLoaded);
          // Safety timeout in case audio element doesn't fire event
          setTimeout(() => {
            audio.removeEventListener('loadedmetadata', onLoaded);
            resolve(Math.max(4000, Math.round((scene.narration_text.split(/\s+/).length / 125) * 60 * 1000)));
          }, 3000);
        }
      });

      cacheRef.current.set(cacheKey, {
        blob,
        url: objectUrl,
        durationMs,
      });

      setActiveSceneDurationMs(durationMs);
      setAudioLoading(false);
      setAudioError(null);
      setCaptionOnlyFallback(false);

      if (isPlaying && !isMuted && narrationEnabled) {
        audio.play().catch(() => {});
      }
    } catch (err: unknown) {
      // Ignore AbortError from rapid scene switching
      if (err instanceof Error && err.name === 'AbortError') return;

      const message =
        err instanceof ApiError
          ? err.detail
          : err instanceof Error
          ? err.message
          : 'Failed to synthesize narration audio.';

      setAudioError(message);
      setAudioLoading(false);
      setCaptionOnlyFallback(true);
      setActiveSceneDurationMs(null); // Fallback to caption/text estimation
    }
  }, [
    lesson,
    getCurrentScene,
    selectedVoice,
    narrationEnabled,
    playbackSpeed,
    isPlaying,
    isMuted,
    getCacheKey,
    setActiveSceneDurationMs,
    setAudioLoading,
    setAudioError,
    setCaptionOnlyFallback,
  ]);

  // Trigger audio loading on scene, voice, or language transition
  useEffect(() => {
    loadAudioForCurrentScene();
  }, [activeChapterIndex, activeSceneIndex, selectedVoice, loadAudioForCurrentScene]);

  // Synchronize play/pause state and playback speed
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.playbackRate = playbackSpeed;

    if (isPlaying && narrationEnabled && !isMuted && !captionOnlyFallback) {
      if (audio.paused && audio.src) {
        audio.play().catch(() => {});
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [isPlaying, playbackSpeed, isMuted, narrationEnabled, captionOnlyFallback]);

  return {
    audioElement: audioRef.current,
    retry: loadAudioForCurrentScene,
    seekTo,
    restartAudio,
    stopAudio,
  };
}
