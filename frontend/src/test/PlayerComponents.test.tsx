import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useLessonStore } from '../stores/lessonStore';
import { PlayerViewport } from '../components/lesson/PlayerViewport';
import { PlayerControls } from '../components/lesson/PlayerControls';
import { ArchitectureScene } from '../components/scenes/ArchitectureScene';
import { CodeDiffScene } from '../components/scenes/CodeDiffScene';
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
    },
    {
      id: 'chk-02',
      statement: 'Check for complex nested conditionals where standard loops are clearer.',
      importance: 'caution',
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

  it('renders CompanionPanel with chapters, glossary, and interactive verification checklist', () => {
    render(<CompanionPanel />);

    // Chapters tab is active by default
    expect(screen.getByText(/Fundamentals & Syntax/i)).toBeInTheDocument();
    expect(screen.getByText(/Architecture & Runtime/i)).toBeInTheDocument();

    // Switch to Glossary Tab
    const glossaryTab = screen.getByRole('button', { name: /Glossary/i });
    fireEvent.click(glossaryTab);
    expect(screen.getByText(/List Comprehension/i)).toBeInTheDocument();
    expect(screen.getByText(/A concise declarative syntax/i)).toBeInTheDocument();

    // Switch to Verification Checklist Tab
    const checklistTab = screen.getByRole('button', { name: /Checklist/i });
    fireEvent.click(checklistTab);
    expect(screen.getByText(/Ensure input iterable is non-mutated/i)).toBeInTheDocument();
    expect(screen.getByText(/MUST-KNOW/i)).toBeInTheDocument();

    // Check item
    const itemText = screen.getByText(/Ensure input iterable is non-mutated/i);
    fireEvent.click(itemText);
    expect(useLessonStore.getState().checkedVerificationIds['chk-01']).toBe(true);
  });
});
