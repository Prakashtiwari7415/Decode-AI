import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLessonStore } from '../stores/lessonStore';
import { useSpeechNarration, isSpeechSynthesisSupported, getLanguageCode } from '../hooks/useAudioNarration';
import { useLessonTimeline } from '../hooks/useLessonTimeline';
import { Lesson } from '../types/lesson';

const mockLesson: Lesson = {
  lesson_id: 'lesson-fixture-en',
  title: 'Understanding Async Pipelines',
  language: 'en',
  content_type: 'explanation',
  total_estimated_duration_ms: 12000,
  chapters: [
    {
      chapter_id: 'ch-1',
      title: 'Intro Chapter',
      summary: 'Introductory concepts',
      scenes: [
        {
          scene_id: 'sc-1',
          title: 'Scene 1',
          narration_text: 'Hello, welcome to this lesson about asynchronous queues.',
          visual: {
            scene_type: 'text',
            highlighted_terms: ['asynchronous'],
            animation_style: 'fade-slide',
          },
          captions: [
            { offset_ms: 0, duration_ms: 2500, text: 'Hello, welcome to this lesson' },
            { offset_ms: 2500, duration_ms: 2500, text: 'about asynchronous queues.' },
          ],
          uncertainty: 'none',
        },
        {
          scene_id: 'sc-2',
          title: 'Scene 2',
          narration_text: 'In this second scene, we look at event loops.',
          visual: {
            scene_type: 'text',
            highlighted_terms: ['event loops'],
            animation_style: 'fade-slide',
          },
          captions: [
            { offset_ms: 0, duration_ms: 4000, text: 'In this second scene, we look at event loops.' },
          ],
          uncertainty: 'none',
        },
      ],
    },
  ],
  glossary: [],
  verification_checklist: [],
  gemini_model_version: 'gemini-3.8-flash',
  generated_at: '2026-10-15T00:00:00Z',
};

describe('useSpeechNarration and Web Speech API Integration', () => {
  let mockSpeak: ReturnType<typeof vi.fn>;
  let mockCancel: ReturnType<typeof vi.fn>;
  let mockGetVoices: ReturnType<typeof vi.fn>;
  let originalSpeechSynthesis: typeof window.speechSynthesis | undefined;
  let originalUtterance: typeof window.SpeechSynthesisUtterance | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    useLessonStore.getState().reset();
    useLessonStore.getState().setLesson(mockLesson);

    mockSpeak = vi.fn();
    mockCancel = vi.fn();
    mockGetVoices = vi.fn().mockReturnValue([
      { name: 'Google US English', lang: 'en-US', default: true },
      { name: 'Google Hindi', lang: 'hi-IN', default: false },
    ]);

    originalSpeechSynthesis = window.speechSynthesis;
    originalUtterance = window.SpeechSynthesisUtterance;

    // Mock window.speechSynthesis and SpeechSynthesisUtterance
    const mockSynth = {
      speak: mockSpeak,
      cancel: mockCancel,
      getVoices: mockGetVoices,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      paused: false,
      pending: false,
      speaking: false,
    };

    class MockUtterance {
      text: string;
      lang = 'en-US';
      rate = 1;
      voice: any = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: any) => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }

    Object.defineProperty(window, 'speechSynthesis', {
      value: mockSynth,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: MockUtterance,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalSpeechSynthesis) {
      Object.defineProperty(window, 'speechSynthesis', {
        value: originalSpeechSynthesis,
        writable: true,
        configurable: true,
      });
    } else {
      delete (window as any).speechSynthesis;
    }
    if (originalUtterance) {
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        value: originalUtterance,
        writable: true,
        configurable: true,
      });
    } else {
      delete (window as any).SpeechSynthesisUtterance;
    }
  });

  it('detects Web Speech API support and maps language codes correctly', () => {
    expect(isSpeechSynthesisSupported()).toBe(true);
    expect(getLanguageCode('en')).toBe('en-US');
    expect(getLanguageCode('hi')).toBe('hi-IN');
    expect(getLanguageCode('hinglish')).toBe('hi-IN');
  });

  it('never calls any network TTS API when loading or switching scenes', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    const { result } = renderHook(() => useSpeechNarration());
    expect(result.current.isSupported).toBe(true);

    // Advance to scene 2
    act(() => {
      useLessonStore.getState().nextScene();
    });

    // Advance back to scene 1
    act(() => {
      useLessonStore.getState().prevScene();
    });

    // Zero network calls made for narration!
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('speaks the current scene narration text and stops cleanly', async () => {
    const { result } = renderHook(() => useSpeechNarration());

    act(() => {
      result.current.speakCurrentScene();
    });

    expect(mockCancel).toHaveBeenCalled();
    expect(mockSpeak).toHaveBeenCalledTimes(1);

    const utteranceArg = mockSpeak.mock.calls[0][0];
    expect(utteranceArg.text).toBe('Hello, welcome to this lesson about asynchronous queues.');
    expect(utteranceArg.lang).toBe('en-US');

    // Simulate speech start event
    act(() => {
      if (utteranceArg.onstart) utteranceArg.onstart();
    });
    expect(useLessonStore.getState().isSpeaking).toBe(true);

    // Stop speech
    act(() => {
      result.current.stopSpeech();
    });
    expect(mockCancel).toHaveBeenCalled();
    expect(useLessonStore.getState().isSpeaking).toBe(false);
  });

  it('cancels active speech when switching scenes to prevent overlapping narration', async () => {
    const { result } = renderHook(() => useSpeechNarration());

    act(() => {
      result.current.speakCurrentScene();
    });
    expect(mockSpeak).toHaveBeenCalledTimes(1);

    // Switch scene
    act(() => {
      useLessonStore.getState().nextScene();
    });

    // Speech was canceled on scene switch
    expect(mockCancel).toHaveBeenCalled();
    expect(useLessonStore.getState().isSpeaking).toBe(false);
  });

  it('cancels speech when user pauses playback', async () => {
    useLessonStore.getState().setNarrationEnabled(true);
    useLessonStore.getState().play();

    renderHook(() => useSpeechNarration());

    // User pauses
    act(() => {
      useLessonStore.getState().pause();
    });

    expect(mockCancel).toHaveBeenCalled();
    expect(useLessonStore.getState().isSpeaking).toBe(false);
  });

  it('handles unsupported browser environment gracefully in caption-only mode without errors', () => {
    // Delete speechSynthesis to simulate unsupported browser
    delete (window as any).speechSynthesis;

    expect(isSpeechSynthesisSupported()).toBe(false);

    const { result } = renderHook(() => useSpeechNarration());
    expect(result.current.isSupported).toBe(false);

    // Calling speak or toggle should not throw
    expect(() => {
      result.current.speakCurrentScene();
      result.current.toggleSpeech();
      result.current.stopSpeech();
    }).not.toThrow();

    expect(useLessonStore.getState().isSpeaking).toBe(false);
  });

  it('synchronizes estimated timeline and captions via useLessonTimeline', async () => {
    act(() => {
      useLessonStore.getState().play();
    });

    const { result } = renderHook(() => useLessonTimeline());
    const duration = result.current.getSceneDurationMs();
    expect(duration).toBeGreaterThan(0);

    // Initial caption matches offset 0
    await waitFor(() => {
      expect(useLessonStore.getState().currentCaptionText).toBe('Hello, welcome to this lesson');
    });
  });

  it('updates caption and active highlight term when seeking intra-scene', async () => {
    act(() => {
      useLessonStore.getState().play();
    });

    renderHook(() => useLessonTimeline());

    // Seek to 3000ms (within second segment: 2500ms - 5000ms)
    act(() => {
      useLessonStore.getState().seekSceneMs(3000);
    });

    await waitFor(() => {
      expect(useLessonStore.getState().currentCaptionText).toBe('about asynchronous queues.');
      expect(useLessonStore.getState().activeSegmentIndex).toBe(1);
      expect(useLessonStore.getState().activeHighlightTerm).toBe('asynchronous');
    });
  });
});
