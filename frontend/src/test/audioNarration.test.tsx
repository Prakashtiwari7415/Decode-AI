import { describe, it, expect, beforeEach, vi, afterEach, type MockInstance } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLessonStore } from '../stores/lessonStore';
import { useAudioNarration } from '../hooks/useAudioNarration';
import { useLessonTimeline } from '../hooks/useLessonTimeline';
import * as api from '../services/api';
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
  gemini_model_version: 'gemini-3.8-flash-fixture',
  generated_at: '2026-10-15T00:00:00Z',
};

describe('useAudioNarration and useLessonTimeline', () => {
  let mockFetchAudio: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    useLessonStore.getState().reset();
    useLessonStore.getState().setLesson(mockLesson);

    // Mock fetchSceneNarrationAudio to return a dummy Blob
    const dummyBlob = new Blob(['RIFF....WAVEfmt '], { type: 'audio/wav' });
    mockFetchAudio = vi.spyOn(api, 'fetchSceneNarrationAudio').mockResolvedValue(dummyBlob);
  });

  afterEach(() => {
    mockFetchAudio.mockRestore();
  });

  it('fetches narration audio on scene load with correct parameters', async () => {
    const { result } = renderHook(() => useAudioNarration());

    await waitFor(() => {
      expect(mockFetchAudio).toHaveBeenCalledTimes(1);
    });

    expect(mockFetchAudio).toHaveBeenCalledWith({
      text: 'Hello, welcome to this lesson about asynchronous queues.',
      language: 'en',
      voice: 'Puck',
      is_fixture: true,
    });

    expect(result.current.audioElement).toBeDefined();
    expect(useLessonStore.getState().audioLoading).toBe(false);
    expect(useLessonStore.getState().audioError).toBeNull();
  });

  it('reuses in-memory cached audio and does not refetch when returning to a visited scene', async () => {
    renderHook(() => useAudioNarration());

    await waitFor(() => {
      expect(mockFetchAudio).toHaveBeenCalledTimes(1);
    });

    // Advance to scene 2 -> triggers second fetch
    act(() => {
      useLessonStore.getState().nextScene();
    });

    await waitFor(() => {
      expect(mockFetchAudio).toHaveBeenCalledTimes(2);
    });

    // Navigate back to scene 1 -> should hit in-memory session cache without calling fetch
    act(() => {
      useLessonStore.getState().prevScene();
    });

    // Call count remains 2 (cache hit!)
    expect(mockFetchAudio).toHaveBeenCalledTimes(2);
  });

  it('switches voice and triggers a new audio fetch with the selected voice', async () => {
    renderHook(() => useAudioNarration());

    await waitFor(() => {
      expect(mockFetchAudio).toHaveBeenCalledTimes(1);
    });

    // Change voice to Aoede
    act(() => {
      useLessonStore.getState().setSelectedVoice('Aoede');
    });

    await waitFor(() => {
      expect(mockFetchAudio).toHaveBeenCalledTimes(2);
    });

    expect(mockFetchAudio).toHaveBeenLastCalledWith(
      expect.objectContaining({
        voice: 'Aoede',
      })
    );
  });

  it('handles TTS API errors gracefully by enabling caption-only fallback', async () => {
    mockFetchAudio.mockRejectedValueOnce(new api.ApiError(502, 'Gemini TTS unavailable'));

    renderHook(() => useAudioNarration());

    await waitFor(() => {
      expect(useLessonStore.getState().audioError).toBe('Gemini TTS unavailable');
    });

    expect(useLessonStore.getState().captionOnlyFallback).toBe(true);
    expect(useLessonStore.getState().audioLoading).toBe(false);
  });

  it('does not fetch audio when narration is disabled by the user', async () => {
    act(() => {
      useLessonStore.getState().toggleNarration(); // narrationEnabled -> false
    });

    renderHook(() => useAudioNarration());

    expect(mockFetchAudio).not.toHaveBeenCalled();
    expect(useLessonStore.getState().audioLoading).toBe(false);
  });

  it('synchronizes timeline and captions via useLessonTimeline', async () => {
    act(() => {
      useLessonStore.getState().play();
    });

    const { result } = renderHook(() => useLessonTimeline());

    expect(result.current.audio).toBeDefined();
    const duration = result.current.getSceneDurationMs();
    expect(duration).toBeGreaterThan(0);

    // Initial caption matches offset 0 when playback loop ticks
    await waitFor(() => {
      expect(useLessonStore.getState().currentCaptionText).toBe('Hello, welcome to this lesson');
    });
  });

  it('updates caption, segment index, and active highlight term when seeking intra-scene', async () => {
    act(() => {
      useLessonStore.getState().play();
    });

    renderHook(() => useLessonTimeline());

    // Seek to 3000ms (within second caption segment: 2500ms - 5000ms)
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
