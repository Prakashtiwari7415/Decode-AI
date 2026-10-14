import { Lesson, LessonRequest, NarrationAudioRequest } from '../types/lesson';

/**
 * Custom error class representing API call failures.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly detail: string;

  constructor(status: number, detail: string) {
    super(`API Error ${status}: ${detail}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

const BASE_URL: string = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

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
    } catch {
      // Non-JSON error body; retain default statusText
    }

    throw new ApiError(response.status, detailMessage);
  }

  const data: Lesson = await response.json();
  return data;
}

/**
 * Requests synthesized WAV audio narration from backend /api/audio/narrate.
 *
 * @param req NarrationAudioRequest containing text, language, optional voice, and is_fixture flag.
 * @returns Promise resolving to the WAV audio Blob.
 * @throws ApiError when the backend responds with an error status.
 */
export async function fetchSceneNarrationAudio(req: NarrationAudioRequest): Promise<Blob> {
  const endpoint = `${BASE_URL}/api/audio/narrate`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'audio/wav',
    },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    let detailMessage = response.statusText || 'Audio generation error';

    try {
      const errorBody = await response.json();
      if (typeof errorBody.detail === 'string') {
        detailMessage = errorBody.detail;
      } else if (errorBody.title) {
        detailMessage = errorBody.title;
      }
    } catch {
      // Non-JSON response, keep default message
    }

    throw new ApiError(response.status, detailMessage);
  }

  const blob = await response.blob();
  return blob;
}
