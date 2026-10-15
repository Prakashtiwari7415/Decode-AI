import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useLessonStore } from '../stores/lessonStore';
import { PlayerViewport } from '../components/lesson/PlayerViewport';
import { PlayerControls } from '../components/lesson/PlayerControls';
import { ArchitectureScene } from '../components/scenes/ArchitectureScene';
import { CodeDiffScene } from '../components/scenes/CodeDiffScene';
import { TextConceptScene } from '../components/scenes/TextConceptScene';
import { CompanionPanel } from '../components/lesson/CompanionPanel';
import { Lesson } from '../types/lesson';

const mockLesson: Lesson = {
  lesson_id: 'test-player-lesson',
  title: 'Understanding Python Comprehensions',
  language: 'en',
  content_type: 'explanation',
  total_estimated_duration_ms: 18000,
  chapters: [
    {
      chapter_id: 'chap-1',
      title: 'Fundamentals & Syntax',
      summary: 'Learn syntax transformation basics',
      scenes: [
        {
          scene_id: 'sc-1',
          title: 'Loop to Comprehension',
          narration_text: 'Notice how three lines condense into one declarative statement.',
          visual: {
            scene_type: 'code_diff',
            before_code: 'result = []\nfor x in items:\n  result.append(x * 2)',
            after_code: 'result = [x * 2 for x in items]',
            language: 'python',
            highlighted_terms: ['append', 'for'],
            animation_style: 'highlight-sweep',
          },
          captions: [{ offset_ms: 0, duration_ms: 5000, text: 'Three lines condense into one.' }],
          uncertainty: 'none',
          grounding_category: 'observed',
          what_to_verify: ['Check that items is iterable before execution.'],
        },
      ],
    },
    {
      chapter_id: 'chap-2',
      title: 'Architecture & Runtime',
      summary: 'Pipeline architecture and memory layout',
      scenes: [
        {
          scene_id: 'sc-2',
          title: 'System Execution Pipeline',
          narration_text: 'The developer client sends requests to the API Gateway.',
          visual: {
            scene_type: 'diagram',
            highlighted_terms: ['Developer Client', 'API Gateway', 'Python VM Engine'],
            animation_style: 'fade-slide',
          },
          captions: [{ offset_ms: 0, duration_ms: 6000, text: 'Request flows to API Gateway.' }],
          uncertainty: 'low',
          uncertainty_note: 'Runtime speed depends on Python interpreter version',
          grounding_category: 'inferred',
          what_to_verify: ['Inspect API gateway connection limits.'],
        },
      ],
    },
  ],
  glossary: [
    {
      term: 'List Comprehension',
      definition: 'A concise declarative syntax to construct new lists from iterables.',
      example: '[x * 2 for x in items]',
    },
  ],
  verification_checklist: [
    {
      id: 'chk-01',
      statement: 'Ensure input iterable is non-mutated after execution.',
      importance: 'must-know',
      grounding: 'needs_verification',
    },
    {
      id: 'chk-02',
      statement: 'Check for complex nested conditionals where standard loops are clearer.',
      importance: 'caution',
      grounding: 'needs_verification',
    },
  ],
  gemini_model_version: 'gemini-2.5-flash',
  generated_at: '2026-10-15T00:00:00Z',
};

describe('Player Components', () => {
  beforeEach(() => {
    useLessonStore.getState().setLesson(mockLesson);
  });

  it('renders PlayerViewport with chapter title, scene badges, and model version badge', () => {
    render(<PlayerViewport />);

    expect(screen.getByText(/Fundamentals & Syntax/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Loop to Comprehension/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/PAUSED/i)).toBeInTheDocument();
    expect(screen.getByText(/gemini-2.5-flash/i)).toBeInTheDocument();
  });

  it('renders Fixture Demo badge when lesson is an offline fixture', () => {
    useLessonStore.getState().setLesson({
      ...mockLesson,
      lesson_id: 'lesson-fixture-en',
    });
    render(<PlayerViewport />);
    expect(screen.getByText(/Fixture Demo/i)).toBeInTheDocument();
  });

  it('renders PlayerControls with accessible buttons and allows play/pause toggle', () => {
    render(<PlayerControls />);

    const playBtn = screen.getByRole('button', { name: 'Play' });
    expect(playBtn).toBeInTheDocument();

    fireEvent.click(playBtn);
    expect(useLessonStore.getState().isPlaying).toBe(true);
  });

  it('renders voice selector dropdown in PlayerControls and updates selected voice', () => {
    render(<PlayerControls />);

    const voiceSelect = screen.getByRole('combobox', { name: 'Select Voice' });
    expect(voiceSelect).toBeInTheDocument();
    expect(voiceSelect).toHaveValue('Puck');

    // Change to Fenrir
    fireEvent.change(voiceSelect, { target: { value: 'Fenrir' } });
    expect(useLessonStore.getState().selectedVoice).toBe('Fenrir');
  });

  it('toggles speech narration mute state via PlayerControls', () => {
    render(<PlayerControls />);

    const narrationBtn = screen.getByRole('button', { name: 'Toggle Speech Narration' });
    expect(narrationBtn).toBeInTheDocument();

    // Currently not muted -> click mutes
    fireEvent.click(narrationBtn);
    expect(useLessonStore.getState().isMuted).toBe(true);

    // Click again unmutes
    fireEvent.click(narrationBtn);
    expect(useLessonStore.getState().isMuted).toBe(false);
  });

  it('renders audio loading and error banners in PlayerControls', () => {
    // 1. Audio Loading banner
    useLessonStore.getState().setAudioLoading(true);
    const { rerender } = render(<PlayerControls />);
    expect(screen.getByText(/Synthesizing scene audio with Gemini TTS/i)).toBeInTheDocument();

    // 2. Audio Error banner
    useLessonStore.getState().setAudioLoading(false);
    useLessonStore.getState().setAudioError('TTS provider error 502');
    rerender(<PlayerControls />);
    expect(screen.getByText(/TTS provider error 502/i)).toBeInTheDocument();

    // Click caption-only mode button on error banner
    const captionOnlyBtn = screen.getByRole('button', { name: 'Caption-Only Mode' });
    fireEvent.click(captionOnlyBtn);
    expect(useLessonStore.getState().captionOnlyFallback).toBe(true);
  });

  it('renders voice status pill, loading pill, and caption-only pill in PlayerViewport', () => {
    // Default: voice pill
    const { rerender } = render(<PlayerViewport />);
    expect(screen.getByText(/🎙️/)).toBeInTheDocument();

    // Audio loading pill
    useLessonStore.getState().setAudioLoading(true);
    rerender(<PlayerViewport />);
    expect(screen.getByText(/Generating Voice.../i)).toBeInTheDocument();

    // Caption only fallback pill
    useLessonStore.getState().setAudioLoading(false);
    useLessonStore.getState().setCaptionOnlyFallback(true);
    rerender(<PlayerViewport />);
    expect(screen.getByText(/Caption Only/i)).toBeInTheDocument();
  });

  it('renders ArchitectureScene with all system pipeline nodes and labels', () => {
    const visual = mockLesson.chapters[1].scenes[0].visual;
    render(<ArchitectureScene visual={visual} title="System Execution Pipeline" />);

    expect(screen.getAllByText(/Developer Client/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/DecodeAI Frontend/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/API Gateway/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Python VM Engine/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Memory Store/i).length).toBeGreaterThan(0);
  });

  it('renders CodeDiffScene with before and after code versions and copy button', () => {
    const visual = mockLesson.chapters[0].scenes[0].visual;
    render(<CodeDiffScene visual={visual} title="Loop to Comprehension" />);

    expect(screen.getByText(/Before: Traditional Imperative Loop/i)).toBeInTheDocument();
    expect(screen.getByText(/After: Declarative List Comprehension/i)).toBeInTheDocument();
    expect(screen.getByText(/Copy Code/i)).toBeInTheDocument();
  });

  it('renders CompanionPanel with chapters, notes, and interactive practice checklist', () => {
    render(<CompanionPanel />);

    // Chapters tab is active by default
    expect(screen.getByText(/Fundamentals & Syntax/i)).toBeInTheDocument();
    expect(screen.getByText(/Architecture & Runtime/i)).toBeInTheDocument();

    // Switch to Notes Tab
    const notesTab = screen.getByRole('button', { name: /Notes/i });
    fireEvent.click(notesTab);
    expect(screen.getByText(/List Comprehension/i)).toBeInTheDocument();
    expect(screen.getByText(/A concise declarative syntax/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Scene Takeaway/i)).toBeInTheDocument();

    // Switch to Practice Tab
    const practiceTab = screen.getByRole('button', { name: /Practice/i });
    fireEvent.click(practiceTab);
    expect(screen.getAllByText(/Ensure input iterable is non-mutated/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/MUST-KNOW/i)).toBeInTheDocument();

    // Toggle checklist item
    const itemText = screen.getAllByText(/Ensure input iterable is non-mutated/i)[0];
    fireEvent.click(itemText);
    expect(useLessonStore.getState().checkedVerificationIds['chk-01']).toBe(true);

    // Knowledge Self-Check questions are present
    expect(screen.getByText(/Knowledge Self-Check/i)).toBeInTheDocument();

    // Safety guarantee notice is visible
    expect(screen.getByText(/DecodeAI never executes pasted code/i)).toBeInTheDocument();
  });

  it('triggers intra-scene seeking via rewind and forward buttons in PlayerControls', () => {
    act(() => {
      useLessonStore.getState().setActiveSceneDurationMs(10000);
      useLessonStore.getState().seekSceneMs(6000);
      useLessonStore.getState().clearSeekTarget();
    });

    render(<PlayerControls />);

    // Check time display renders MM:SS / MM:SS
    expect(screen.getByText('00:06')).toBeInTheDocument();
    expect(screen.getByText('00:10')).toBeInTheDocument();

    // Click rewind 5s -> should seek to 1000ms
    const rewindBtn = screen.getByRole('button', { name: 'Rewind 5 seconds' });
    act(() => {
      fireEvent.click(rewindBtn);
    });
    expect(useLessonStore.getState().seekTargetMs).toBe(1000);
    expect(useLessonStore.getState().sceneElapsedMs).toBe(1000);

    // Update to 7000ms
    act(() => {
      useLessonStore.getState().clearSeekTarget();
      useLessonStore.getState().seekSceneMs(7000);
      useLessonStore.getState().clearSeekTarget();
    });

    // Click forward 5s -> should clamp to scene duration 10000ms (7000 + 5000 clamped to 10000)
    const forwardBtn = screen.getByRole('button', { name: 'Forward 5 seconds' });
    act(() => {
      fireEvent.click(forwardBtn);
    });
    expect(useLessonStore.getState().seekTargetMs).toBe(10000);
  });

  it('dynamically highlights architecture pipeline nodes coordinated with activeHighlightTerm', () => {
    const visual = mockLesson.chapters[1].scenes[0].visual;

    // Set active highlight term to 'API Gateway'
    useLessonStore.getState().setActiveHighlightTerm('API Gateway');

    render(<ArchitectureScene visual={visual} title="System Execution Pipeline" />);

    // When API Gateway is mentioned, phase 2 of 3 is active
    expect(screen.getByText(/Phase 2 of 3/i)).toBeInTheDocument();

    // Clean up
    useLessonStore.getState().setActiveHighlightTerm(null);
  });

  it('renders Evidence Grounding badges and trust indicators in PlayerViewport and CompanionPanel', () => {
    // 1. PlayerViewport renders Observed Fact badge
    render(<PlayerViewport />);
    expect(screen.getAllByText(/Observed/i).length).toBeGreaterThan(0);

    // 2. CompanionPanel renders checklist with practice tab
    render(<CompanionPanel />);
    const practiceTab = screen.getByRole('button', { name: /Practice/i });
    fireEvent.click(practiceTab);

    // Verification checklist items
    expect(screen.getAllByText(/Ensure input iterable is non-mutated/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/MUST-KNOW/i)).toBeInTheDocument();

    // Static analysis safety guarantee
    expect(screen.getByText(/DecodeAI never executes pasted code/i)).toBeInTheDocument();
  });

  it('renders JWT lesson scenes dynamically with zero Python list-comprehension leakage', () => {
    const jwtVisualText = {
      scene_type: 'text' as const,
      highlighted_terms: ['JWT', 'stateless', 'claims', 'bearer token'],
      animation_style: 'fade-slide' as const,
    };

    const jwtVisualDiff = {
      scene_type: 'code_diff' as const,
      before_code: '// Encoded JWT String\neyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      after_code: '// Decoded JWT Structure\n{\n  "header": { "alg": "HS256" },\n  "payload": { "sub": "123" }\n}',
      language: 'json',
      highlighted_terms: ['header', 'payload', 'signature', 'HS256'],
      animation_style: 'highlight-sweep' as const,
    };

    const jwtVisualArch = {
      scene_type: 'diagram' as const,
      mermaid_definition: 'graph LR\n  Client[Client App] --> Auth[Auth Server]\n  Auth --> API[Resource API]\n  API --> Data[(Protected Resource)]',
      highlighted_terms: ['Client App', 'Auth Server', 'Resource API', 'Protected Resource'],
      animation_style: 'fade-slide' as const,
    };

    // 1. Render Text Concept Scene
    const { container: textContainer } = render(
      <TextConceptScene
        visual={jwtVisualText}
        title="What is a JSON Web Token?"
        narrationText="A JSON Web Token is a compact, URL-safe means of representing claims."
        whatToVerify={['Verify token transmitted over HTTPS.']}
      />
    );
    expect(screen.getByText(/What is a JSON Web Token\?/i)).toBeInTheDocument();
    expect(screen.getByText(/representing claims/i)).toBeInTheDocument();
    expect(textContainer.textContent).not.toContain('.append()');
    expect(textContainer.textContent).not.toContain('Python virtual machine');
    expect(textContainer.textContent).not.toContain('C-speed');

    // 2. Render Architecture Scene
    const { container: archContainer } = render(
      <ArchitectureScene visual={jwtVisualArch} title="Stateless Request Flow" />
    );
    expect(screen.getAllByText(/Client App/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Auth Server/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Resource API/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Protected Resource/i).length).toBeGreaterThan(0);
    expect(archContainer.textContent).not.toContain('Python VM Engine');
    expect(archContainer.textContent).not.toContain('.append()');

    // 2. Render Code Diff Scene
    const { container: diffContainer } = render(
      <CodeDiffScene visual={jwtVisualDiff} title="Token Structure Breakdown" />
    );
    expect(screen.getByText(/Encoded JWT String/i)).toBeInTheDocument();
    expect(screen.getByText(/Decoded JWT Structure/i)).toBeInTheDocument();
    expect(diffContainer.textContent).not.toContain('Traditional Imperative Loop');
    expect(diffContainer.textContent).not.toContain('Declarative List Comprehension');
    expect(diffContainer.textContent).not.toContain('cpython');
  });

  it('resets player state completely without leaking state when switching lessons', () => {
    // Dirty state on initial lesson
    act(() => {
      useLessonStore.getState().selectChapter(1);
      useLessonStore.getState().selectScene(1, 0);
      useLessonStore.getState().setSceneElapsedMs(8500);
      useLessonStore.getState().setActiveHighlightTerm('API Gateway');
      useLessonStore.getState().setCurrentCaptionText('Old caption text');
      useLessonStore.getState().toggleVerificationItem('chk-01');
    });

    expect(useLessonStore.getState().activeChapterIndex).toBe(1);
    expect(useLessonStore.getState().sceneElapsedMs).toBe(8500);
    expect(useLessonStore.getState().activeHighlightTerm).toBe('API Gateway');
    expect(useLessonStore.getState().checkedVerificationIds['chk-01']).toBe(true);

    // Load new lesson
    act(() => {
      useLessonStore.getState().setLesson({
        ...mockLesson,
        lesson_id: 'lesson-fixture-jwt',
        title: 'JSON Web Tokens',
      });
    });

    const state = useLessonStore.getState();
    expect(state.activeChapterIndex).toBe(0);
    expect(state.activeSceneIndex).toBe(0);
    expect(state.sceneElapsedMs).toBe(0);
    expect(state.activeHighlightTerm).toBeNull();
    expect(state.currentCaptionText).toBe('');
    expect(Object.keys(state.checkedVerificationIds)).toHaveLength(0);
    expect(state.isPlaying).toBe(false);
  });
});
