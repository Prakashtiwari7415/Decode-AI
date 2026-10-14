import { useEffect, useRef, useState, useCallback } from 'react';
import { Language } from '../types/lesson';

export interface UseNarrationResult {
  speechSupported: boolean;
  isSpeaking: boolean;
  speak: (text: string, language: Language, rate?: number, onEnd?: () => void) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  availableVoices: SpeechSynthesisVoice[];
}

export function useNarration(): UseNarrationResult {
  const [speechSupported, setSpeechSupported] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setSpeechSupported(true);

      const updateVoices = () => {
        try {
          const voices = window.speechSynthesis.getVoices();
          setAvailableVoices(voices);
        } catch {
          // Gracefully handle voice enumeration restrictions
        }
      };

      updateVoices();
      if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
        window.speechSynthesis.onvoiceschanged = updateVoices;
      }
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const selectVoiceForLanguage = useCallback(
    (lang: Language): SpeechSynthesisVoice | null => {
      if (!availableVoices.length) return null;

      const targetPrefix =
        lang === 'hi' ? 'hi' : lang === 'hinglish' ? 'hi' : 'en';

      // 1. Direct match with region (e.g. hi-IN or en-US)
      const primaryMatch = availableVoices.find(
        (v) =>
          v.lang.toLowerCase().startsWith(targetPrefix) &&
          (lang === 'hi' || lang === 'hinglish' ? v.lang.includes('IN') : true)
      );
      if (primaryMatch) return primaryMatch;

      // 2. Fallback to any voice with language prefix
      const prefixMatch = availableVoices.find((v) =>
        v.lang.toLowerCase().startsWith(targetPrefix)
      );
      if (prefixMatch) return prefixMatch;

      // 3. Fallback to default voice
      return availableVoices.find((v) => v.default) || availableVoices[0] || null;
    },
    [availableVoices]
  );

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    currentUtteranceRef.current = null;
    setIsSpeaking(false);
  }, []);

  const pause = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
    }
  }, []);

  const resume = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
    }
  }, []);

  const speak = useCallback(
    (text: string, language: Language, rate: number = 1, onEnd?: () => void) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        onEnd?.();
        return;
      }

      // Always cancel active speech before starting a new utterance to prevent stacking
      window.speechSynthesis.cancel();

      if (!text || !text.trim()) {
        onEnd?.();
        return;
      }

      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = Math.min(Math.max(rate, 0.5), 2);
        utterance.pitch = 1.0;

        const voice = selectVoiceForLanguage(language);
        if (voice) {
          utterance.voice = voice;
        }

        utterance.onstart = () => {
          setIsSpeaking(true);
        };

        utterance.onend = () => {
          setIsSpeaking(false);
          currentUtteranceRef.current = null;
          onEnd?.();
        };

        utterance.onerror = (e) => {
          // 'canceled' or 'interrupted' is expected on skip/pause/seek
          setIsSpeaking(false);
          currentUtteranceRef.current = null;
          if (e.error !== 'canceled' && e.error !== 'interrupted') {
            onEnd?.();
          }
        };

        currentUtteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      } catch {
        // Fallback gracefully on speech synthesis initialization failure
        setIsSpeaking(false);
        onEnd?.();
      }
    },
    [selectVoiceForLanguage]
  );

  return {
    speechSupported,
    isSpeaking,
    speak,
    stop,
    pause,
    resume,
    availableVoices,
  };
}
