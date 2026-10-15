import { Scene } from '../types/lesson';

export interface TimedNarrationSegment {
  id: string;
  index: number;
  startMs: number;
  endMs: number;
  durationMs: number;
  text: string;
  highlightedTerms: string[];
}

/**
 * Splits a text into natural sentences across English, Hindi (पूर्णविराम ।), and mixed Hinglish.
 */
export function splitIntoSentences(text: string): string[] {
  if (!text || !text.trim()) return [];

  // Match sentence delimiters: period followed by space, exclamation, question mark, or devanagari danda ।
  const sentences = text
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return sentences.length > 0 ? sentences : [text.trim()];
}

/**
 * Calibrates scene caption slices against estimated scene duration.
 *
 * This calibration engine produces contiguous, non-overlapping sentence-level
 * segments partitioning [0, targetDurationMs] proportionally to character weights,
 * eliminating dead zones, gaps, and premature subtitle cutoffs.
 */
export function calibrateSceneSegments(
  scene: Scene | null,
  actualDurationMs: number | null
): TimedNarrationSegment[] {
  if (!scene) return [];

  const rawCaptions = scene.captions && scene.captions.length > 0 ? scene.captions : [];
  const terms = scene.visual?.highlighted_terms || [];

  // Determine target total duration
  let targetTotalMs = actualDurationMs && actualDurationMs > 0 ? actualDurationMs : null;

  if (!targetTotalMs) {
    if (rawCaptions.length > 0) {
      const last = rawCaptions[rawCaptions.length - 1];
      targetTotalMs = Math.max(last.offset_ms + last.duration_ms, 4000);
    } else {
      const words = scene.narration_text.split(/\s+/).length;
      targetTotalMs = Math.max(Math.round((words / 125) * 60 * 1000), 4000);
    }
  }

  // 1. If discrete captions exist in the lesson schema
  if (rawCaptions.length > 0) {
    // Calculate total weight by text length or duration
    const totalChars = rawCaptions.reduce((acc, c) => acc + Math.max(c.text.trim().length, 1), 0);
    const segments: TimedNarrationSegment[] = [];
    let currentStartMs = 0;

    rawCaptions.forEach((caption, idx) => {
      const isLast = idx === rawCaptions.length - 1;
      const charWeight = Math.max(caption.text.trim().length, 1) / totalChars;

      let segDurationMs: number;
      if (isLast) {
        segDurationMs = Math.max(targetTotalMs! - currentStartMs, 500);
      } else {
        segDurationMs = Math.round(targetTotalMs! * charWeight);
      }

      const endMs = isLast ? targetTotalMs! : currentStartMs + segDurationMs;

      // Extract matching highlighted terms present in this segment
      const lowerText = caption.text.toLowerCase();
      const matchedTerms = terms.filter((term) =>
        lowerText.includes(term.toLowerCase().trim())
      );

      segments.push({
        id: `${scene.scene_id}-seg-${idx}`,
        index: idx,
        startMs: currentStartMs,
        endMs,
        durationMs: endMs - currentStartMs,
        text: caption.text.trim(),
        highlightedTerms: matchedTerms,
      });

      currentStartMs = endMs;
    });

    return segments;
  }

  // 2. If captions are missing, partition narration_text by sentence
  const sentences = splitIntoSentences(scene.narration_text);
  const totalChars = sentences.reduce((acc, s) => acc + Math.max(s.length, 1), 0);
  const segments: TimedNarrationSegment[] = [];
  let currentStartMs = 0;

  sentences.forEach((sentence, idx) => {
    const isLast = idx === sentences.length - 1;
    const charWeight = Math.max(sentence.length, 1) / totalChars;

    const segDurationMs = isLast
      ? Math.max(targetTotalMs! - currentStartMs, 500)
      : Math.round(targetTotalMs! * charWeight);

    const endMs = isLast ? targetTotalMs! : currentStartMs + segDurationMs;

    const lowerText = sentence.toLowerCase();
    const matchedTerms = terms.filter((term) =>
      lowerText.includes(term.toLowerCase().trim())
    );

    segments.push({
      id: `${scene.scene_id}-seg-${idx}`,
      index: idx,
      startMs: currentStartMs,
      endMs,
      durationMs: endMs - currentStartMs,
      text: sentence,
      highlightedTerms: matchedTerms,
    });

    currentStartMs = endMs;
  });

  return segments;
}

/**
 * Finds the active segment for the given elapsed time.
 * Returns the exact segment encompassing elapsedMs, clamping to boundaries.
 */
export function findActiveSegment(
  segments: TimedNarrationSegment[],
  elapsedMs: number
): TimedNarrationSegment | null {
  if (!segments || segments.length === 0) return null;

  if (elapsedMs <= 0) return segments[0];

  const last = segments[segments.length - 1];
  if (elapsedMs >= last.endMs) return last;

  const found = segments.find((seg) => elapsedMs >= seg.startMs && elapsedMs < seg.endMs);
  return found || last;
}
