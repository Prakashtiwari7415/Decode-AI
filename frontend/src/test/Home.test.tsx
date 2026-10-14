import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

describe('Home Page Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLessonStore.setState({
      lesson: null,
      activeChapterIndex: 0,
      activeSceneIndex: 0,
      isPlaying: false,
    });
  });

  it('renders landing page with title, quick demo fixture buttons, and character limit indicator', () => {
    render(<Home />);

    expect(screen.getByText(/DecodeAI/i)).toBeInTheDocument();
    expect(screen.getByText(/Powered by Gemini 3.8 Flash/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Watch in English/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /हिन्दी में देखें/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hinglish/i })).toBeInTheDocument();
    expect(screen.getByText(/\/ 20,000 chars/i)).toBeInTheDocument();
  });

  it('updates character count and disables submit when content exceeds 20,000 characters', () => {
    render(<Home />);

    const textarea = screen.getByRole('textbox', { name: /Paste Code/i });
    const submitBtn = screen.getByRole('button', { name: /Generate with Gemini 3.8 Flash/i });

    // Initial state: not disabled by character count
    expect(submitBtn).not.toBeDisabled();

    // Type a string exceeding 20,000 characters
    const longString = 'a'.repeat(20001);
    fireEvent.change(textarea, { target: { value: longString } });

    expect(screen.getByText(/20,001 \/ 20,000 chars/i)).toBeInTheDocument();
    expect(submitBtn).toBeDisabled();
  });

  it('calls generateLesson with use_fixture=false when submitting custom content', async () => {
    const mockGenerate = vi.mocked(api.generateLesson).mockResolvedValueOnce(sampleLesson);
    render(<Home />);

    const textarea = screen.getByRole('textbox', { name: /Paste Code/i });
    fireEvent.change(textarea, { target: { value: 'def add(a, b):\n    return a + b' } });

    const submitBtn = screen.getByRole('button', { name: /Generate with Gemini 3.8 Flash/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalledTimes(1);
    });

    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'def add(a, b):\n    return a + b',
        use_fixture: false,
      })
    );
  });

  it('calls generateLesson with use_fixture=true when clicking quick demo fixture button', async () => {
    const mockGenerate = vi.mocked(api.generateLesson).mockResolvedValueOnce(sampleLesson);
    render(<Home />);

    const enFixtureBtn = screen.getByRole('button', { name: /Watch in English/i });
    fireEvent.click(enFixtureBtn);

    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalledTimes(1);
    });

    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        language: 'en',
        use_fixture: true,
      })
    );
  });

  it('displays error banner and retry button when generation fails', async () => {
    vi.mocked(api.generateLesson).mockRejectedValueOnce(
      new api.ApiError(401, 'GEMINI_API_KEY environment variable is not configured on the backend.')
    );

    render(<Home />);

    const textarea = screen.getByRole('textbox', { name: /Paste Code/i });
    fireEvent.change(textarea, { target: { value: 'function computeTotal() { return 42; }' } });

    const submitBtn = screen.getByRole('button', { name: /Generate with Gemini 3.8 Flash/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText(/Gemini API Key Required/i)).toBeInTheDocument();
    expect(screen.getByText(/HTTP 401/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry Request/i })).toBeInTheDocument();

    // Verify retry button fires another attempt
    vi.mocked(api.generateLesson).mockResolvedValueOnce(sampleLesson);
    const retryBtn = screen.getByRole('button', { name: /Retry Request/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(api.generateLesson).toHaveBeenCalledTimes(2);
    });
  });
});
