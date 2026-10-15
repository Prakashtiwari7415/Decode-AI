import { create } from 'zustand';
import { Lesson, Chapter, Scene, PlaybackStatus } from '../types/lesson';

export interface LessonState {
  lesson: Lesson | null;
  activeChapterIndex: number;
  activeSceneIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  isMuted: boolean;
  captionsEnabled: boolean;
  sceneElapsedMs: number;
  currentCaptionText: string;
  activeHighlightTerm: string | null;
  checkedVerificationIds: Record<string, boolean>;

  // Speech Narration State (Browser Web Speech API)
  narrationEnabled: boolean;
  isSpeaking: boolean;
  speechSupported: boolean;
  activeSceneDurationMs: number | null;

  // Synchronized Playback & Seeking State
  activeSegmentIndex: number;
  seekTargetMs: number | null;

  // Computed helper methods
  getCurrentChapter: () => Chapter | null;
  getCurrentScene: () => Scene | null;
  getTotalScenes: () => number;
  getGlobalSceneIndex: () => number;
  getPlaybackStatus: () => PlaybackStatus;

  // Actions
  setLesson: (lesson: Lesson | null) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  restart: () => void;
  nextScene: () => boolean;
  prevScene: () => boolean;
  selectChapter: (index: number) => void;
  selectScene: (chapterIndex: number, sceneIndex: number) => void;
  toggleMute: () => void;
  toggleCaptions: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setSceneElapsedMs: (ms: number) => void;
  setCurrentCaptionText: (text: string) => void;
  setActiveHighlightTerm: (term: string | null) => void;
  toggleVerificationItem: (id: string) => void;

  // Speech Narration Actions
  setNarrationEnabled: (enabled: boolean) => void;
  toggleNarration: () => void;
  setIsSpeaking: (isSpeaking: boolean) => void;
  setSpeechSupported: (supported: boolean) => void;
  setActiveSceneDurationMs: (ms: number | null) => void;
  reset: () => void;

  // Synchronized Playback Actions
  setActiveSegmentIndex: (index: number) => void;
  seekSceneMs: (targetMs: number) => void;
  clearSeekTarget: () => void;
}

const initialSpeechState = {
  narrationEnabled: false,
  isSpeaking: false,
  speechSupported: true,
  activeSceneDurationMs: null,
  activeSegmentIndex: 0,
  seekTargetMs: null as number | null,
};

export const useLessonStore = create<LessonState>((set, get) => ({
  lesson: null,
  activeChapterIndex: 0,
  activeSceneIndex: 0,
  isPlaying: false,
  playbackSpeed: 1,
  isMuted: false,
  captionsEnabled: true,
  sceneElapsedMs: 0,
  currentCaptionText: '',
  activeHighlightTerm: null,
  checkedVerificationIds: {},
  ...initialSpeechState,

  getCurrentChapter: () => {
    const { lesson, activeChapterIndex } = get();
    if (!lesson || !lesson.chapters[activeChapterIndex]) return null;
    return lesson.chapters[activeChapterIndex];
  },

  getCurrentScene: () => {
    const chapter = get().getCurrentChapter();
    if (!chapter) return null;
    const { activeSceneIndex } = get();
    return chapter.scenes[activeSceneIndex] ?? null;
  },

  getTotalScenes: () => {
    const { lesson } = get();
    if (!lesson) return 0;
    return lesson.chapters.reduce((acc, ch) => acc + ch.scenes.length, 0);
  },

  getGlobalSceneIndex: () => {
    const { lesson, activeChapterIndex, activeSceneIndex } = get();
    if (!lesson) return 0;
    let count = 0;
    for (let c = 0; c < activeChapterIndex; c++) {
      count += lesson.chapters[c].scenes.length;
    }
    return count + activeSceneIndex;
  },

  getPlaybackStatus: (): PlaybackStatus => {
    const { lesson, isPlaying } = get();
    if (!lesson) return 'idle';
    return isPlaying ? 'playing' : 'paused';
  },

  setLesson: (lesson: Lesson | null) => {
    set({
      lesson,
      activeChapterIndex: 0,
      activeSceneIndex: 0,
      isPlaying: false,
      sceneElapsedMs: 0,
      currentCaptionText: '',
      activeHighlightTerm: null,
      checkedVerificationIds: {},
      ...initialSpeechState,
    });
  },

  play: () => set({ isPlaying: true }),

  pause: () => set({ isPlaying: false }),

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  restart: () => {
    set({
      activeChapterIndex: 0,
      activeSceneIndex: 0,
      sceneElapsedMs: 0,
      currentCaptionText: '',
      activeHighlightTerm: null,
      activeSegmentIndex: 0,
      seekTargetMs: null,
      activeSceneDurationMs: null,
      isSpeaking: false,
      isPlaying: true,
    });
  },

  nextScene: () => {
    const { lesson, activeChapterIndex, activeSceneIndex } = get();
    if (!lesson) return false;

    const currentChapter = lesson.chapters[activeChapterIndex];
    if (activeSceneIndex + 1 < currentChapter.scenes.length) {
      set({
        activeSceneIndex: activeSceneIndex + 1,
        sceneElapsedMs: 0,
        currentCaptionText: '',
        activeHighlightTerm: null,
        activeSegmentIndex: 0,
        seekTargetMs: null,
        activeSceneDurationMs: null,
        isSpeaking: false,
      });
      return true;
    }

    if (activeChapterIndex + 1 < lesson.chapters.length) {
      set({
        activeChapterIndex: activeChapterIndex + 1,
        activeSceneIndex: 0,
        sceneElapsedMs: 0,
        currentCaptionText: '',
        activeHighlightTerm: null,
        activeSegmentIndex: 0,
        seekTargetMs: null,
        activeSceneDurationMs: null,
        isSpeaking: false,
      });
      return true;
    }

    // Reached the end of the lesson
    set({ isPlaying: false, sceneElapsedMs: 0, activeHighlightTerm: null, isSpeaking: false });
    return false;
  },

  prevScene: () => {
    const { lesson, activeChapterIndex, activeSceneIndex } = get();
    if (!lesson) return false;

    if (activeSceneIndex > 0) {
      set({
        activeSceneIndex: activeSceneIndex - 1,
        sceneElapsedMs: 0,
        currentCaptionText: '',
        activeHighlightTerm: null,
        activeSegmentIndex: 0,
        seekTargetMs: null,
        activeSceneDurationMs: null,
        isSpeaking: false,
      });
      return true;
    }

    if (activeChapterIndex > 0) {
      const prevChapter = lesson.chapters[activeChapterIndex - 1];
      set({
        activeChapterIndex: activeChapterIndex - 1,
        activeSceneIndex: prevChapter.scenes.length - 1,
        sceneElapsedMs: 0,
        currentCaptionText: '',
        activeHighlightTerm: null,
        activeSegmentIndex: 0,
        seekTargetMs: null,
        activeSceneDurationMs: null,
        isSpeaking: false,
      });
      return true;
    }

    return false;
  },

  selectChapter: (index: number) => {
    const { lesson } = get();
    if (!lesson || index < 0 || index >= lesson.chapters.length) return;
    set({
      activeChapterIndex: index,
      activeSceneIndex: 0,
      sceneElapsedMs: 0,
      currentCaptionText: '',
      activeHighlightTerm: null,
      activeSegmentIndex: 0,
      seekTargetMs: null,
      activeSceneDurationMs: null,
      isSpeaking: false,
    });
  },

  selectScene: (chapterIndex: number, sceneIndex: number) => {
    const { lesson } = get();
    if (!lesson || chapterIndex < 0 || chapterIndex >= lesson.chapters.length) return;
    const chapter = lesson.chapters[chapterIndex];
    if (sceneIndex < 0 || sceneIndex >= chapter.scenes.length) return;

    set({
      activeChapterIndex: chapterIndex,
      activeSceneIndex: sceneIndex,
      sceneElapsedMs: 0,
      currentCaptionText: '',
      activeHighlightTerm: null,
      activeSegmentIndex: 0,
      seekTargetMs: null,
      activeSceneDurationMs: null,
      isSpeaking: false,
    });
  },

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

  toggleCaptions: () => set((state) => ({ captionsEnabled: !state.captionsEnabled })),

  setPlaybackSpeed: (playbackSpeed: number) => set({ playbackSpeed }),

  setSceneElapsedMs: (sceneElapsedMs: number) => set({ sceneElapsedMs }),

  setCurrentCaptionText: (currentCaptionText: string) => set({ currentCaptionText }),

  setActiveHighlightTerm: (activeHighlightTerm: string | null) => set({ activeHighlightTerm }),

  toggleVerificationItem: (id: string) =>
    set((state) => ({
      checkedVerificationIds: {
        ...state.checkedVerificationIds,
        [id]: !state.checkedVerificationIds[id],
      },
    })),

  // Speech Narration Actions
  setNarrationEnabled: (narrationEnabled: boolean) => set({ narrationEnabled }),

  toggleNarration: () => set((state) => ({ narrationEnabled: !state.narrationEnabled })),

  setIsSpeaking: (isSpeaking: boolean) => set({ isSpeaking }),

  setSpeechSupported: (speechSupported: boolean) => set({ speechSupported }),

  setActiveSceneDurationMs: (activeSceneDurationMs: number | null) =>
    set({ activeSceneDurationMs }),

  // Synchronized Playback Actions
  setActiveSegmentIndex: (activeSegmentIndex: number) => set({ activeSegmentIndex }),

  seekSceneMs: (targetMs: number) => {
    const { activeSceneDurationMs } = get();
    const maxDuration =
      activeSceneDurationMs && activeSceneDurationMs > 0 ? activeSceneDurationMs : 60000;
    const clamped = Math.max(0, Math.min(targetMs, maxDuration));
    set({ sceneElapsedMs: clamped, seekTargetMs: clamped });
  },

  clearSeekTarget: () => set({ seekTargetMs: null }),

  reset: () =>
    set({
      lesson: null,
      activeChapterIndex: 0,
      activeSceneIndex: 0,
      isPlaying: false,
      playbackSpeed: 1,
      isMuted: false,
      captionsEnabled: true,
      sceneElapsedMs: 0,
      currentCaptionText: '',
      activeHighlightTerm: null,
      checkedVerificationIds: {},
      ...initialSpeechState,
    }),
}));
