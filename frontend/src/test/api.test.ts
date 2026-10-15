import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  fetchSceneNarrationAudio,
  generateLesson,
  clearInFlightAudioRequests,
  ApiError,
} from '../services/api';

describe('API Service (api.ts)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    clearInFlightAudioRequests();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('coalesces concurrent narration audio requests for identical text into a single fetch call', async () => {
    let fetchCount = 0;
    const fakeBlob = new Blob(['RIFFaudio'], { type: 'audio/wav' });

    global.fetch = vi.fn().mockImplementation(async () => {
      fetchCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        ok: true,
        status: 200,
        blob: async () => fakeBlob,
        headers: new Headers(),
      } as unknown as Response;
    });

    const req = {
      text: 'Concurrent narration request text.',
      language: 'en' as const,
      voice: 'Puck' as const,
      is_fixture: false,
    };

    // Fire 3 simultaneous requests for identical input
    const [blob1, blob2, blob3] = await Promise.all([
      fetchSceneNarrationAudio(req),
      fetchSceneNarrationAudio(req),
      fetchSceneNarrationAudio(req),
    ]);

    // Single-flight deduplication: exactly 1 fetch invocation
    expect(fetchCount).toBe(1);
    expect(blob1).toBe(blob2);
    expect(blob2).toBe(blob3);
  });

  it('parses Retry-After header and body on HTTP 429 and attaches retryAfter to ApiError', async () => {
    const errorBody = {
      type: 'https://errors.decodeai.dev/rate-limit',
      title: 'Gemini TTS Rate Limit',
      status: 429,
      detail: 'Resource quota exhausted for model.',
      retry_after: 25,
    };

    const headers = new Headers();
    headers.set('Retry-After', '25');

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers,
      json: async () => errorBody,
    } as unknown as Response);

    const req = {
      text: 'Text under rate limit',
      language: 'en' as const,
      voice: 'Kore' as const,
    };

    let caughtError: ApiError | null = null;
    try {
      await fetchSceneNarrationAudio(req);
    } catch (err) {
      if (err instanceof ApiError) {
        caughtError = err;
      }
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError?.status).toBe(429);
    expect(caughtError?.detail).toBe('Resource quota exhausted for model.');
    expect(caughtError?.retryAfter).toBe(25);
  });

  it('honors AbortSignal when user cancels request in-flight', async () => {
    const controller = new AbortController();

    global.fetch = vi.fn().mockImplementation((_url, opts) => {
      if (opts?.signal?.aborted) {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      }
      return new Promise((_resolve, reject) => {
        opts?.signal?.addEventListener('abort', () => {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    });

    const req = {
      text: 'Long audio generation',
      language: 'en' as const,
      voice: 'Puck' as const,
    };

    const promise = fetchSceneNarrationAudio(req, controller.signal);
    controller.abort();

    await expect(promise).rejects.toThrow('The operation was aborted');
  });

  it('parses error detail from API responses in generateLesson', async () => {
    global.fetch = vi.fn().mockResolvedValue({
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
});
