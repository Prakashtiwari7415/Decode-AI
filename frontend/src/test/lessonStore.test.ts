import { describe, it, expect, beforeEach } from 'vitest';
import { useLessonStore } from '../stores/lessonStore';
import { Lesson } from '../types/lesson';

const mockLesson: Lesson = {
  lesson_id: 'test-lesson-001',
  title: 'Test Educational Lesson',
  language: 'en',
  content_type: 'explanation',
  total_estimated_duration_ms: 12000,
  chapters: [
    {
      chapter_id: 'ch-1',
      title: 'Chapter 1: Basics',
      summary: 'Introduction to fundamentals',
      scenes: [
        {
          scene_id: 'sc-1-1',
          title: 'Scene 1.1 Intro',
          narration_text: 'Welcome to this lesson.',
          visual: {
            scene_type: 'text',
            highlighted_terms: ['welcome'],
            animation_style: 'fade-slide',
          },
          captions: [{ offset_ms: 0, duration_ms: 3000, text: 'Welcome to this lesson.' }],
          uncertainty: 'none',
        },
        {
          scene_id: 'sc-1-2',
          title: 'Scene 1.2 Transformation',
          narration_text: 'Here is the code transformation.',
          visual: {
            scene_type: 'code_diff',
            before_code: 'for x in items:\n  result.append(x)',
            after_code: '[x for x in items]',
            highlighted_terms: ['append', 'for'],
            animation_style: 'highlight-sweep',
          },
          captions: [{ offset_ms: 0, duration_ms: 3000, text: 'Code transformation.' }],
          uncertainty: 'none',
        },
      ],
    },
    {
      chapter_id: 'ch-2',
      title: 'Chapter 2: Architecture',
      summary: 'Architecture and runtime flow',
      scenes: [
        {
          scene_id: 'sc-2-1',
          title: 'Scene 2.1 Architecture',
          narration_text: 'Understanding request flow.',
          visual: {
            scene_type: 'diagram',
            highlighted_terms: ['Client', 'API'],
            animation_style: 'fade-slide',
          },
          captions: [{ offset_ms: 0, duration_ms: 3000, text: 'Request flow.' }],
          uncertainty: 'low',
          uncertainty_note: 'Runtime version dependent',
        },
      ],
    },
  ],
  glossary: [
    { term: 'Comprehension', definition: 'Syntax sugar for creating lists', example: '[x for x in y]' },
  ],
  verification_checklist: [
    { id: 'v1', statement: 'Check empty input returns empty list', importance: 'must-know' },
  ],
  gemini_model_version: 'gemini-2.5-flash',
  generated_at: '2026-10-15T00:00:00Z',
};

describe('useLessonStore', () => {
  beforeEach(() => {
    useLessonStore.getState().setLesson(mockLesson);
  });

  it('initializes with lesson data and resets active indices', () => {
    const state = useLessonStore.getState();
    expect(state.lesson).toBeDefined();
    expect(state.lesson?.title).toBe('Test Educational Lesson');
    expect(state.activeChapterIndex).toBe(0);
    expect(state.activeSceneIndex).toBe(0);
    expect(state.isPlaying).toBe(false);
  });

  it('correctly toggles play and pause', () => {
    const store = useLessonStore.getState();
    expect(store.isPlaying).toBe(false);

    store.play();
    expect(useLessonStore.getState().isPlaying).toBe(true);

    store.pause();
    expect(useLessonStore.getState().isPlaying).toBe(false);

    store.togglePlay();
    expect(useLessonStore.getState().isPlaying).toBe(true);
  });

  it('advances through scenes and across chapters with nextScene()', () => {
    const store = useLessonStore.getState();

    // From Ch 0 Scene 0 -> Ch 0 Scene 1
    const res1 = store.nextScene();
    expect(res1).toBe(true);
    expect(useLessonStore.getState().activeChapterIndex).toBe(0);
    expect(useLessonStore.getState().activeSceneIndex).toBe(1);

    // From Ch 0 Scene 1 -> Ch 1 Scene 0
    const res2 = store.nextScene();
    expect(res2).toBe(true);
    expect(useLessonStore.getState().activeChapterIndex).toBe(1);
    expect(useLessonStore.getState().activeSceneIndex).toBe(0);

    // Reaching the end returns false and pauses
    const res3 = store.nextScene();
    expect(res3).toBe(false);
    expect(useLessonStore.getState().isPlaying).toBe(false);
  });

  it('navigates backward with prevScene()', () => {
    const store = useLessonStore.getState();
    store.selectScene(1, 0); // Ch 1 Scene 0

    const res = store.prevScene();
    expect(res).toBe(true);
    expect(useLessonStore.getState().activeChapterIndex).toBe(0);
    expect(useLessonStore.getState().activeSceneIndex).toBe(1);
  });

  it('toggles mute, captions, and adjusts playback speed', () => {
    const store = useLessonStore.getState();
    expect(store.isMuted).toBe(false);
    store.toggleMute();
    expect(useLessonStore.getState().isMuted).toBe(true);

    expect(store.captionsEnabled).toBe(true);
    store.toggleCaptions();
    expect(useLessonStore.getState().captionsEnabled).toBe(false);

    store.setPlaybackSpeed(1.5);
    expect(useLessonStore.getState().playbackSpeed).toBe(1.5);
  });

  it('toggles verification checklist item check state', () => {
    const store = useLessonStore.getState();
    expect(store.checkedVerificationIds['v1']).toBeFalsy();

    store.toggleVerificationItem('v1');
    expect(useLessonStore.getState().checkedVerificationIds['v1']).toBe(true);

    store.toggleVerificationItem('v1');
    expect(useLessonStore.getState().checkedVerificationIds['v1']).toBe(false);
  });

  it('manages speech narration state and Web Speech API toggles', () => {
    const store = useLessonStore.getState();

    // Default narration state
    expect(store.narrationEnabled).toBe(false);
    expect(store.isSpeaking).toBe(false);
    expect(store.speechSupported).toBe(true);

    // Toggle narration
    store.toggleNarration();
    expect(useLessonStore.getState().narrationEnabled).toBe(true);
    store.toggleNarration();
    expect(useLessonStore.getState().narrationEnabled).toBe(false);

    // Set speaking state
    store.setIsSpeaking(true);
    expect(useLessonStore.getState().isSpeaking).toBe(true);
    store.setIsSpeaking(false);
    expect(useLessonStore.getState().isSpeaking).toBe(false);

    // Active scene duration
    store.setActiveSceneDurationMs(8500);
    expect(useLessonStore.getState().activeSceneDurationMs).toBe(8500);

    // Reset clears state
    store.reset();
    const resetState = useLessonStore.getState();
    expect(resetState.lesson).toBeNull();
    expect(resetState.activeChapterIndex).toBe(0);
    expect(resetState.activeSceneIndex).toBe(0);
    expect(resetState.isPlaying).toBe(false);
    expect(resetState.isSpeaking).toBe(false);
    expect(resetState.activeSceneDurationMs).toBeNull();
    expect(resetState.activeSegmentIndex).toBe(0);
    expect(resetState.seekTargetMs).toBeNull();
  });

  it('manages segment tracking and intra-scene seeking', () => {
    const store = useLessonStore.getState();

    // Default segment index
    expect(store.activeSegmentIndex).toBe(0);
    expect(store.seekTargetMs).toBeNull();

    // Set active segment index
    store.setActiveSegmentIndex(2);
    expect(useLessonStore.getState().activeSegmentIndex).toBe(2);

    // Intra-scene seeking
    store.seekSceneMs(4500);
    expect(useLessonStore.getState().seekTargetMs).toBe(4500);
    expect(useLessonStore.getState().sceneElapsedMs).toBe(4500);

    // Clear seek target
    store.clearSeekTarget();
    expect(useLessonStore.getState().seekTargetMs).toBeNull();
    expect(useLessonStore.getState().sceneElapsedMs).toBe(4500);
  });

  it('accurately derives PlaybackStatus for each state of the player lifecycle', () => {
    const store = useLessonStore.getState();

    // With lesson loaded and initial paused state
    expect(store.getPlaybackStatus()).toBe('paused');

    // When user plays
    store.play();
    expect(store.getPlaybackStatus()).toBe('playing');

    // When user pauses
    store.pause();
    expect(store.getPlaybackStatus()).toBe('paused');

    // When lesson is reset
    store.reset();
    expect(store.getPlaybackStatus()).toBe('idle');
  });
});
