import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { generateLesson, ApiError } from '../services/api';

describe('API Service (api.ts)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('successfully calls POST /api/lessons/generate and returns Lesson JSON', async () => {
    const fakeLesson = {
      lesson_id: 'lesson-123',
      title: 'Testing Python Generative Lesson',
      language: 'en',
      content_type: 'explanation',
      total_estimated_duration_ms: 12000,
      chapters: [],
      glossary: [],
      verification_checklist: [],
      gemini_model_version: 'gemini-3.8-flash',
      generated_at: '2026-10-15T00:00:00Z',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => fakeLesson,
    } as unknown as Response);

    const result = await generateLesson({
      content: 'def add(a, b): return a + b',
      content_type: 'explanation',
      language: 'en',
      detail_level: 'standard',
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/lessons/generate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    );
    expect(result.lesson_id).toBe('lesson-123');
    expect(result.title).toBe('Testing Python Generative Lesson');
  });

  it('parses error detail from API responses in generateLesson and throws ApiError', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      headers: new Headers(),
      json: async () => ({ detail: 'Prohibited injection pattern' }),
    } as unknown as Response);

    await expect(
      generateLesson({
        content: 'alert("test")',
        content_type: 'explanation',
        language: 'en',
        detail_level: 'standard',
      })
    ).rejects.toThrow('Prohibited injection pattern');
  });

  it('parses array of validation errors in generateLesson', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: new Headers(),
      json: async () => ({
        detail: [{ msg: 'String should have at least 10 characters' }],
      }),
    } as unknown as Response);

    let caughtError: ApiError | null = null;
    try {
      await generateLesson({
        content: 'short',
        content_type: 'explanation',
        language: 'en',
        detail_level: 'standard',
      });
    } catch (err) {
      if (err instanceof ApiError) {
        caughtError = err;
      }
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError?.status).toBe(422);
    expect(caughtError?.detail).toBe('String should have at least 10 characters');
  });

  it('parses Retry-After header on HTTP 429 when present', async () => {
    const headers = new Headers();
    headers.set('Retry-After', '30');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers,
      json: async () => ({
        title: 'Quota Exceeded',
        detail: 'Rate limit reached',
        retry_after: 30,
      }),
    } as unknown as Response);

    let caughtError: ApiError | null = null;
    try {
      await generateLesson({
        content: 'def test(): pass',
        content_type: 'explanation',
        language: 'en',
        detail_level: 'standard',
      });
    } catch (err) {
      if (err instanceof ApiError) {
        caughtError = err;
      }
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError?.status).toBe(429);
    expect(caughtError?.retryAfter).toBe(30);
  });
});
