import { Lesson, LessonRequest, NarrationAudioRequest } from '../types/lesson';

/**
 * Custom error class representing API call failures.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly detail: string;
  public readonly retryAfter?: number;

  constructor(status: number, detail: string, retryAfter?: number) {
    super(`API Error ${status}: ${detail}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.retryAfter = retryAfter;
  }
}

const BASE_URL: string = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

// Client-side in-flight request map for single-flight deduplication
const inFlightAudioRequests = new Map<string, Promise<Blob>>();

/**
 * Clear in-flight audio requests (useful for test resets).
 */
export function clearInFlightAudioRequests(): void {
  inFlightAudioRequests.clear();
}

/**
 * Sends a generation request to the backend and returns the synthesized Lesson.
 *
 * @param req LessonRequest payload containing content, content_type, language, and detail_level.
 * @returns Promise resolving to the generated Lesson.
 * @throws ApiError when the backend responds with a non-2xx HTTP status.
 */
export async function generateLesson(req: LessonRequest): Promise<Lesson> {
  const endpoint = `${BASE_URL}/api/lessons/generate`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    let detailMessage = response.statusText || 'Unknown error';
    let retryAfter: number | undefined;

    const retryHeader = response.headers.get('Retry-After');
    if (retryHeader) {
      const parsed = parseInt(retryHeader, 10);
      if (!Number.isNaN(parsed)) retryAfter = parsed;
    }

    try {
      const errorBody = await response.json();
      if (typeof errorBody.detail === 'string') {
        detailMessage = errorBody.detail;
      } else if (Array.isArray(errorBody.detail)) {
        detailMessage = errorBody.detail
          .map((item: { msg?: string; loc?: string[] }) => item.msg || JSON.stringify(item))
          .join('; ');
      } else if (errorBody.detail) {
        detailMessage = JSON.stringify(errorBody.detail);
      } else if (errorBody.title) {
        detailMessage = errorBody.title;
      }
      if (errorBody.retry_after && typeof errorBody.retry_after === 'number') {
        retryAfter = errorBody.retry_after;
      }
    } catch {
      // Non-JSON error body; retain default statusText
    }

    throw new ApiError(response.status, detailMessage, retryAfter);
  }

  const data: Lesson = await response.json();
  return data;
}

/**
 * Requests synthesized WAV audio narration from backend /api/audio/narrate with single-flight deduplication.
 *
 * @param req NarrationAudioRequest containing text, language, optional voice, and is_fixture flag.
 * @param signal Optional AbortSignal to cancel in-flight request when user navigates away.
 * @returns Promise resolving to the WAV audio Blob.
 * @throws ApiError when the backend responds with an error status.
 */
export async function fetchSceneNarrationAudio(
  req: NarrationAudioRequest,
  signal?: AbortSignal
): Promise<Blob> {
  const endpoint = `${BASE_URL}/api/audio/narrate`;
  const key = `${req.language}:${req.voice || 'Puck'}:${req.is_fixture ? '1' : '0'}:${req.text.trim()}`;

  // Check if an identical request is already actively in-flight
  const existingPromise = inFlightAudioRequests.get(key);
  if (existingPromise) {
    return existingPromise;
  }

  const fetchPromise = (async () => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'audio/wav',
        },
        body: JSON.stringify(req),
        signal,
      });

      if (!response.ok) {
        let detailMessage = response.statusText || 'Audio generation error';
        let retryAfter: number | undefined;

        const retryHeader = response.headers.get('Retry-After');
        if (retryHeader) {
          const parsed = parseInt(retryHeader, 10);
          if (!Number.isNaN(parsed)) retryAfter = parsed;
        }

        try {
          const errorBody = await response.json();
          if (typeof errorBody.detail === 'string') {
            detailMessage = errorBody.detail;
          } else if (errorBody.title) {
            detailMessage = errorBody.title;
          }
          if (errorBody.retry_after && typeof errorBody.retry_after === 'number') {
            retryAfter = errorBody.retry_after;
          }
        } catch {
          // Non-JSON response, keep default message
        }

        throw new ApiError(response.status, detailMessage, retryAfter);
      }

      const blob = await response.blob();
      return blob;
    } finally {
      inFlightAudioRequests.delete(key);
    }
  })();

  inFlightAudioRequests.set(key, fetchPromise);
  return fetchPromise;
}
