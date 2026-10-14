import { Lesson, LessonRequest } from '../types/lesson';

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
