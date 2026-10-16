import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Home } from '../pages/Home';
import { useLessonStore } from '../stores/lessonStore';
import * as api from '../services/api';
import { Lesson } from '../types/lesson';

vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api');
  return {
    ...actual,
    generateLesson: vi.fn(),
  };
});

const sampleLesson: Lesson = {
  lesson_id: 'lesson-fixture-en',
  title: 'Python List Comprehensions',
  language: 'en',
  content_type: 'explanation',
  total_estimated_duration_ms: 22000,
  chapters: [
    {
      chapter_id: 'chap-1',
      title: 'Transformation Basics',
      summary: 'Summary of basics',
      scenes: [
        {
          scene_id: 'sc-1',
          title: 'Scene 1',
          narration_text: 'Narration text',
          visual: {
            scene_type: 'text',
            highlighted_terms: ['Comprehensions'],
            animation_style: 'fade-slide',
          },
          captions: [{ offset_ms: 0, duration_ms: 3000, text: 'Captions here' }],
          uncertainty: 'none',
        },
      ],
    },
  ],
  glossary: [],
  verification_checklist: [],
  gemini_model_version: 'fixture-v1',
  generated_at: '2026-10-15T00:00:00Z',
};

describe('Home Page — Product UX & Failure Recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLessonStore.setState({
      lesson: null,
      activeChapterIndex: 0,
      activeSceneIndex: 0,
      isPlaying: false,
    });
  });

  it('renders clean product landing page with no milestone or model provider badges', () => {
    render(<Home />);

    // Brand and value proposition
    expect(screen.getByText(/^DecodeAI$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Understand complex technical concepts through visual lessons/i)
    ).toBeInTheDocument();

    // Primary action button is "Generate lesson"
    expect(screen.getByRole('button', { name: /^Generate lesson$/i })).toBeInTheDocument();

    // Secondary action button to explore examples
    const exploreButtons = screen.getAllByRole('button', { name: /Explore example lessons/i });
    expect(exploreButtons.length).toBeGreaterThan(0);

    // Verify developer and provider branding is strictly absent from user-facing UI
    expect(screen.queryByText(/Milestone 2B/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Milestone/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Powered by Gemini 3.8 Flash/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Generate with Gemini/i)).not.toBeInTheDocument();

    // Initial empty input state and character limit indicator
    const textarea = screen.getByRole('textbox', { name: /Paste Code/i }) as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
    expect(screen.getByText(/0 \/ 20,000 chars/i)).toBeInTheDocument();
  });

  it('validates minimum input length and shows inline error without calling API', async () => {
    const mockGenerate = vi.mocked(api.generateLesson);
    render(<Home />);

    const textarea = screen.getByRole('textbox', { name: /Paste Code/i });
    fireEvent.change(textarea, { target: { value: 'short' } });

    const submitBtn = screen.getByRole('button', { name: /^Generate lesson$/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Content must be at least 10 characters long/i)).toBeInTheDocument();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('updates character count and disables submit when content exceeds 20,000 characters', () => {
    render(<Home />);

    const textarea = screen.getByRole('textbox', { name: /Paste Code/i });
    const submitBtn = screen.getByRole('button', { name: /^Generate lesson$/i });

    expect(submitBtn).not.toBeDisabled();

    // Type exceeding 20,000 chars
    const longString = 'a'.repeat(20001);
    fireEvent.change(textarea, { target: { value: longString } });

    expect(screen.getByText(/20,001 \/ 20,000 chars/i)).toBeInTheDocument();
    expect(submitBtn).toBeDisabled();
  });

  it('calls generateLesson with use_fixture=false when submitting valid custom content', async () => {
    const mockGenerate = vi.mocked(api.generateLesson).mockResolvedValueOnce(sampleLesson);
    render(<Home />);

    const textarea = screen.getByRole('textbox', { name: /Paste Code/i });
    fireEvent.change(textarea, { target: { value: 'def compute_hash(data):\n    return sha256(data)' } });

    const submitBtn = screen.getByRole('button', { name: /^Generate lesson$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalledTimes(1);
    });

    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'def compute_hash(data):\n    return sha256(data)',
        use_fixture: false,
      })
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 2, name: /Python List Comprehensions/i })
      ).toBeInTheDocument();
    });
  });

  it('disables submit button and shows loading state during active generation', async () => {
    let resolvePromise: (val: Lesson) => void;
    vi.mocked(api.generateLesson).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
    );

    render(<Home />);

    const textarea = screen.getByRole('textbox', { name: /Paste Code/i });
    fireEvent.change(textarea, { target: { value: 'function authenticateUser(req) { return true; }' } });

    const submitBtn = screen.getByRole('button', { name: /^Generate lesson$/i });
    fireEvent.click(submitBtn);

    // Verify loading state
    expect(screen.getByText(/Generating lesson\.\.\./i)).toBeInTheDocument();
    expect(screen.getByText(/Synthesizing Interactive Lesson/i)).toBeInTheDocument();
    expect(screen.getByText(/Analyzing code structure, patterns, and concepts\.\.\./i)).toBeInTheDocument();

    // Cleanup hanging promise and wait for completion
    resolvePromise!(sampleLesson);
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 2, name: /Python List Comprehensions/i })
      ).toBeInTheDocument();
    });
  });

  it('opens ExampleLessonsModal and allows watching an example lesson with use_fixture=true', async () => {
    const mockGenerate = vi.mocked(api.generateLesson).mockResolvedValueOnce(sampleLesson);
    render(<Home />);

    // Click "Explore example lessons" in the top bar
    const exploreBtn = screen.getAllByRole('button', { name: /Explore example lessons/i })[0];
    fireEvent.click(exploreBtn);

    // Modal opens
    const modal = screen.getByRole('dialog');
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText(/JSON Web Tokens \(JWT\) Architecture/i)).toBeInTheDocument();
    expect(within(modal).getByText(/Python List Comprehensions & Loop Refactoring/i)).toBeInTheDocument();

    // Click Watch Example inside the modal dialog
    const watchButtons = within(modal).getAllByRole('button', { name: /Watch example/i });
    fireEvent.click(watchButtons[0]);

    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalledTimes(1);
    });

    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        use_fixture: true,
      })
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 2, name: /Python List Comprehensions/i })
      ).toBeInTheDocument();
    });
  });

  it('renders friendly Recovery Panel for HTTP 429 rate limits, preserves user input, and retries successfully', async () => {
    vi.mocked(api.generateLesson).mockRejectedValueOnce(
      new api.ApiError(429, 'Rate limit exceeded on upstream AI model')
    );

    render(<Home />);

    const userSnippet = 'class CacheManager:\n    def __init__(self):\n        self._cache = {}';
    const textarea = screen.getByRole('textbox', { name: /Paste Code/i });
    fireEvent.change(textarea, { target: { value: userSnippet } });

    const submitBtn = screen.getByRole('button', { name: /^Generate lesson$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // Friendly recovery categorization
    expect(screen.getByText(/Generation Limit Reached/i)).toBeInTheDocument();
    expect(screen.getByText(/Rate Limit \(429\)/i)).toBeInTheDocument();
    expect(screen.getByText(/The AI service is experiencing high demand right now/i)).toBeInTheDocument();

    // Verify user input snippet is strictly preserved
    expect((screen.getByRole('textbox', { name: /Paste Code/i }) as HTMLTextAreaElement).value).toBe(
      userSnippet
    );

    // Verify Try Again button works
    vi.mocked(api.generateLesson).mockResolvedValueOnce(sampleLesson);
    const retryBtn = screen.getByRole('button', { name: /Try again/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(api.generateLesson).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 2, name: /Python List Comprehensions/i })
      ).toBeInTheDocument();
    });
  });

  it('renders friendly Recovery Panel for HTTP 503 and 504 without leaking server internals', async () => {
    vi.mocked(api.generateLesson).mockRejectedValueOnce(
      new api.ApiError(503, 'Upstream model service temporarily overloaded')
    );

    render(<Home />);

    const textarea = screen.getByRole('textbox', { name: /Paste Code/i });
    fireEvent.change(textarea, { target: { value: 'SELECT * FROM users WHERE active = true;' } });

    const submitBtn = screen.getByRole('button', { name: /^Generate lesson$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText(/Service Temporarily Unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Service Busy \(503\)/i)).toBeInTheDocument();
    expect(screen.getByText(/The AI generation service is temporarily busy/i)).toBeInTheDocument();
  });
});
