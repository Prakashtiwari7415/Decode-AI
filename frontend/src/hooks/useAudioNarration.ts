import { useEffect, useRef, useCallback, useState } from 'react';
import { useLessonStore } from '../stores/lessonStore';
import { Language } from '../types/lesson';

/**
 * Checks if the browser supports the Web Speech API (speechSynthesis).
 */
export function isSpeechSynthesisSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  );
}

/**
 * Maps lesson language to standard BCP-47 language codes.
 */
export function getLanguageCode(language: Language): string {
  switch (language) {
    case 'hi':
      return 'hi-IN';
    case 'hinglish':
      return 'hi-IN';
    case 'en':
    default:
      return 'en-US';
  }
}

/**
 * Finds the most suitable installed browser speech synthesis voice for the requested language.
 */
export function findBestVoice(
  voices: SpeechSynthesisVoice[],
  language: Language
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const targetPrefix = language === 'hi' ? 'hi' : language === 'hinglish' ? 'hi' : 'en';

  // 1. Direct language code match
  const match = voices.find((v) => v.lang.toLowerCase().startsWith(targetPrefix));
  if (match) return match;

  // 2. Hinglish fallback: Indian English (en-IN)
  if (language === 'hinglish') {
    const enIn = voices.find(
      (v) =>
        v.lang.toLowerCase().includes('en-in') ||
        v.lang.toLowerCase().includes('en_in')
    );
    if (enIn) return enIn;
  }

  // 3. Fallback to default voice or first available
  return voices.find((v) => v.default) || voices[0] || null;
}

export interface UseSpeechNarrationResult {
  isSupported: boolean;
  isSpeaking: boolean;
  speakCurrentScene: () => void;
  stopSpeech: () => void;
  toggleSpeech: () => void;
  // Backwards-compatible aliases for lesson timeline
  audioElement: HTMLAudioElement | null;
  seekTo: (timeSeconds: number) => void;
  restartAudio: () => void;
  stopAudio: () => void;
}

export function useSpeechNarration(): UseSpeechNarrationResult {
  const {
    lesson,
    activeChapterIndex,
    activeSceneIndex,
    isPlaying,
    playbackSpeed,
    isMuted,
    narrationEnabled,
    getCurrentScene,
    setIsSpeaking,
    setSpeechSupported,
  } = useLessonStore();

  const [supported, setSupported] = useState<boolean>(false);
  const [speaking, setSpeaking] = useState<boolean>(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Mutable refs to decouple effect dependencies
  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;
  const isMutedRef = useRef<boolean>(isMuted);
  isMutedRef.current = isMuted;
  const narrationEnabledRef = useRef<boolean>(narrationEnabled);
  narrationEnabledRef.current = narrationEnabled;
  const playbackSpeedRef = useRef<number>(playbackSpeed);
  playbackSpeedRef.current = playbackSpeed;

  // Check Web Speech API availability and load voices
  useEffect(() => {
    const isAvail = isSpeechSynthesisSupported();
    setSupported(isAvail);
    setSpeechSupported(isAvail);

    if (!isAvail) return;

    const synth = window.speechSynthesis;

    const updateVoices = () => {
      try {
        const available = synth.getVoices();
        setVoices(available);
      } catch {
        // Ignore voice loading exceptions
      }
    };

    updateVoices();

    if ('onvoiceschanged' in synth) {
      synth.addEventListener('voiceschanged', updateVoices);
    }

    return () => {
      if ('onvoiceschanged' in synth) {
        synth.removeEventListener('voiceschanged', updateVoices);
      }
      try {
        synth.cancel();
      } catch {}
    };
  }, [setSpeechSupported]);

  // Cancel any active speech synthesis and clean up handlers
  const stopSpeech = useCallback(() => {
    if (isSpeechSynthesisSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    if (activeUtteranceRef.current) {
      activeUtteranceRef.current.onstart = null;
      activeUtteranceRef.current.onend = null;
      activeUtteranceRef.current.onerror = null;
      activeUtteranceRef.current = null;
    }
    setSpeaking(false);
    setIsSpeaking(false);
  }, [setIsSpeaking]);

  // Speak the current scene's narration text using Web Speech API
  const speakCurrentScene = useCallback(() => {
    if (!isSpeechSynthesisSupported()) return;

    const scene = getCurrentScene();
    if (!lesson || !scene || !scene.narration_text.trim()) return;

    const synth = window.speechSynthesis;

    // Always cancel pending/current speech to prevent overlapping speech
    try {
      synth.cancel();
    } catch {}

    const utterance = new SpeechSynthesisUtterance(scene.narration_text);
    activeUtteranceRef.current = utterance;

    // Configure rate, language, and voice
    const speed = playbackSpeedRef.current;
    utterance.rate = Math.max(0.5, Math.min(2.0, speed));
    utterance.lang = getLanguageCode(lesson.language);

    const bestVoice = findBestVoice(voices, lesson.language);
    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    utterance.onstart = () => {
      setSpeaking(true);
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setSpeaking(false);
      setIsSpeaking(false);
      activeUtteranceRef.current = null;
    };

    utterance.onerror = (event) => {
      // Ignore user-initiated cancellation or interruption
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        console.warn('SpeechSynthesis error:', event.error);
      }
      setSpeaking(false);
      setIsSpeaking(false);
      activeUtteranceRef.current = null;
    };

    try {
      synth.speak(utterance);
    } catch {
      setSpeaking(false);
      setIsSpeaking(false);
    }
  }, [getCurrentScene, lesson, voices, setIsSpeaking]);

  const toggleSpeech = useCallback(() => {
    if (speaking) {
      stopSpeech();
    } else {
      speakCurrentScene();
    }
  }, [speaking, stopSpeech, speakCurrentScene]);

  // Cancel speech on scene or lesson change; auto-speak if playback & narration are active
  useEffect(() => {
    stopSpeech();

    if (
      narrationEnabledRef.current &&
      !isMutedRef.current &&
      isSpeechSynthesisSupported()
    ) {
      speakCurrentScene();
    }

    return () => {
      stopSpeech();
    };
  }, [
    lesson?.lesson_id,
    activeChapterIndex,
    activeSceneIndex,
    stopSpeech,
    speakCurrentScene,
  ]);

  // Handle play/pause and mute transitions cleanly
  const prevIsPlayingRef = useRef<boolean>(isPlaying);
  useEffect(() => {
    if (prevIsPlayingRef.current && !isPlaying) {
      stopSpeech();
    } else if (!prevIsPlayingRef.current && isPlaying) {
      if (narrationEnabled && !isMuted) {
        speakCurrentScene();
      }
    }
    prevIsPlayingRef.current = isPlaying;
  }, [isPlaying, narrationEnabled, isMuted, stopSpeech, speakCurrentScene]);

  const prevIsMutedRef = useRef<boolean>(isMuted);
  useEffect(() => {
    if (!prevIsMutedRef.current && isMuted) {
      stopSpeech();
    }
    prevIsMutedRef.current = isMuted;
  }, [isMuted, stopSpeech]);

  return {
    isSupported: supported,
    isSpeaking: speaking,
    speakCurrentScene,
    stopSpeech,
    toggleSpeech,
    // Backwards-compatible aliases
    audioElement: null,
    seekTo: () => {
      // Seeking stops speech to prevent desync
      stopSpeech();
    },
    restartAudio: () => {
      stopSpeech();
      if (isPlayingRef.current && narrationEnabledRef.current && !isMutedRef.current) {
        speakCurrentScene();
      }
    },
    stopAudio: stopSpeech,
  };
}

// Backwards-compatibility alias for timeline hook and player
export const useAudioNarration = useSpeechNarration;
export type UseAudioNarrationResult = UseSpeechNarrationResult;
