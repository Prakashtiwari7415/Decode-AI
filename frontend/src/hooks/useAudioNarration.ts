import { useEffect, useRef, useCallback } from 'react';
import { useLessonStore } from '../stores/lessonStore';
import { fetchSceneNarrationAudio, ApiError } from '../services/api';

interface CachedAudio {
  blob: Blob;
  url: string;
  durationMs: number;
}

// Module-level audio cache preserving synthesized audio across component re-renders
const globalAudioCache = new Map<string, CachedAudio>();

/**
 * Resets the in-memory client audio cache (useful for tests).
 */
export function clearClientAudioCache(): void {
  globalAudioCache.forEach((cached) => {
    try {
      URL.revokeObjectURL(cached.url);
    } catch {
      // Ignore URL revocation errors
    }
  });
  globalAudioCache.clear();
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
    audioLoading,
    captionOnlyFallback,
    getCurrentScene,
    setAudioLoading,
    setAudioError,
    setRetryAfterSeconds,
    setCaptionOnlyFallback,
    setActiveSceneDurationMs,
  } = useLessonStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Mutable refs to decouple play/mute state from audio fetch dependencies
  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;
  const isMutedRef = useRef<boolean>(isMuted);
  isMutedRef.current = isMuted;
  const playbackSpeedRef = useRef<number>(playbackSpeed);
  playbackSpeedRef.current = playbackSpeed;
  const narrationEnabledRef = useRef<boolean>(narrationEnabled);
  narrationEnabledRef.current = narrationEnabled;

  // Initialize audio element once
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const audio = new Audio();
      audio.preload = 'auto';
      audioRef.current = audio;
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
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
      if (isPlayingRef.current && narrationEnabledRef.current && !isMutedRef.current && !captionOnlyFallback) {
        audio.play().catch(() => {});
      }
    }
  }, [captionOnlyFallback]);

  // Load and cache audio whenever active scene, voice, or language changes
  const loadAudioForCurrentScene = useCallback(
    async (forceRefresh = false) => {
      const scene = getCurrentScene();
      const audio = audioRef.current;
      if (!lesson || !scene || !audio) return;

      // Immediately abort prior pending fetch and silence prior audio
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      audio.pause();
      audio.currentTime = 0;

      // If narration is disabled by user, skip audio fetch
      if (!narrationEnabledRef.current) {
        setAudioLoading(false);
        setAudioError(null);
        return;
      }

      const cacheKey = getCacheKey(scene.scene_id, scene.narration_text);
      const cached = globalAudioCache.get(cacheKey);

      if (cached && !forceRefresh) {
        audio.src = cached.url;
        audio.playbackRate = playbackSpeedRef.current;
        setActiveSceneDurationMs(cached.durationMs);
        setAudioLoading(false);
        setAudioError(null);
        setCaptionOnlyFallback(false);

        if (isPlayingRef.current && !isMutedRef.current && narrationEnabledRef.current) {
          audio.play().catch(() => {});
        }
        return;
      }

      setAudioLoading(true);
      setAudioError(null);

      const isFixture = Boolean(
        lesson.lesson_id.includes('fixture') ||
        (lesson.gemini_model_version && lesson.gemini_model_version.includes('fixture'))
      );

      try {
        const blob = await fetchSceneNarrationAudio(
          {
            text: scene.narration_text,
            language: lesson.language,
            voice: selectedVoice,
            is_fixture: isFixture,
          },
          signal
        );

        if (signal.aborted) return;

        const objectUrl = URL.createObjectURL(blob);
        audio.src = objectUrl;
        audio.playbackRate = playbackSpeedRef.current;

        // Decode exact duration from the loaded audio buffer
        const durationMs = await new Promise<number>((resolve) => {
          const onLoaded = () => {
            audio.removeEventListener('loadedmetadata', onLoaded);
            const durSec = audio.duration;
            if (Number.isFinite(durSec) && durSec > 0) {
              resolve(Math.round(durSec * 1000));
            } else {
              resolve(Math.max(4000, Math.round((scene.narration_text.split(/\s+/).length / 125) * 60 * 1000)));
            }
          };

          if (audio.readyState >= 1 && Number.isFinite(audio.duration) && audio.duration > 0) {
            resolve(Math.round(audio.duration * 1000));
          } else {
            audio.addEventListener('loadedmetadata', onLoaded);
            setTimeout(() => {
              audio.removeEventListener('loadedmetadata', onLoaded);
              resolve(Math.max(4000, Math.round((scene.narration_text.split(/\s+/).length / 125) * 60 * 1000)));
            }, 3000);
          }
        });

        if (signal.aborted) {
          try {
            URL.revokeObjectURL(objectUrl);
          } catch {}
          return;
        }

        globalAudioCache.set(cacheKey, {
          blob,
          url: objectUrl,
          durationMs,
        });

        setActiveSceneDurationMs(durationMs);
        setAudioLoading(false);
        setAudioError(null);
        setCaptionOnlyFallback(false);

        if (isPlayingRef.current && !isMutedRef.current && narrationEnabledRef.current) {
          audio.play().catch(() => {});
        }
      } catch (err: unknown) {
        if (signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
          return;
        }

        const is429 = err instanceof ApiError && err.status === 429;
        let message = 'Failed to synthesize narration audio.';

        if (is429) {
          const retrySec = (err as ApiError).retryAfter ?? 10;
          setRetryAfterSeconds(retrySec);
          message = `Gemini TTS rate limit/quota reached. Please retry in ${retrySec}s or continue in Caption-Only mode.`;
        } else if (err instanceof ApiError) {
          message = err.detail;
        } else if (err instanceof Error) {
          message = err.message;
        }

        setAudioError(message);
        setAudioLoading(false);
        setCaptionOnlyFallback(true);
        setActiveSceneDurationMs(null);
      }
    },
    [
      lesson,
      getCurrentScene,
      selectedVoice,
      getCacheKey,
      setActiveSceneDurationMs,
      setAudioLoading,
      setAudioError,
      setRetryAfterSeconds,
      setCaptionOnlyFallback,
    ]
  );

  // Trigger audio loading strictly on scene, voice, or language transition
  useEffect(() => {
    loadAudioForCurrentScene();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [lesson?.lesson_id, activeChapterIndex, activeSceneIndex, selectedVoice, narrationEnabled, loadAudioForCurrentScene]);

  // Synchronize play/pause state and playback speed
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.playbackRate = playbackSpeed;

    if (isPlaying && narrationEnabled && !isMuted && !captionOnlyFallback && !audioLoading) {
      if (audio.paused && audio.src) {
        audio.play().catch(() => {});
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [isPlaying, playbackSpeed, isMuted, narrationEnabled, captionOnlyFallback, audioLoading]);

  const retry = useCallback(async () => {
    await loadAudioForCurrentScene(true);
  }, [loadAudioForCurrentScene]);

  return {
    audioElement: audioRef.current,
    retry,
    seekTo,
    restartAudio,
    stopAudio,
  };
}
