import { describe, it, expect } from 'vitest';
import {
  splitIntoSentences,
  calibrateSceneSegments,
  findActiveSegment,
} from '../utils/captionTiming';
import { Scene } from '../types/lesson';

describe('captionTiming utility', () => {
  describe('splitIntoSentences', () => {
    it('splits standard English sentences on periods, question marks, and exclamation marks', () => {
      const text = 'Welcome to DecodeAI. How does this work? It turns complex code into video lessons! Let us begin.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toEqual([
        'Welcome to DecodeAI.',
        'How does this work?',
        'It turns complex code into video lessons!',
        'Let us begin.',
      ]);
    });

    it('splits Hindi sentences containing Devanagari danda । delimiters', () => {
      const hindiText = 'नमस्ते और DecodeAI में आपका स्वागत है। यह कोड विश्लेषण का उपकरण है। आइए इसे समझें।';
      const sentences = splitIntoSentences(hindiText);
      expect(sentences).toEqual([
        'नमस्ते और DecodeAI में आपका स्वागत है।',
        'यह कोड विश्लेषण का उपकरण है।',
        'आइए इसे समझें।',
      ]);
    });

    it('handles mixed Hinglish narration and technical abbreviations', () => {
      const hinglishText = 'Yeh function asynchronous queue process karta hai. Agar error aaye toh retry karo! Samajh gaye?';
      const sentences = splitIntoSentences(hinglishText);
      expect(sentences).toEqual([
        'Yeh function asynchronous queue process karta hai.',
        'Agar error aaye toh retry karo!',
        'Samajh gaye?',
      ]);
    });

    it('returns single element if text has no ending punctuation', () => {
      const text = 'Single sentence without terminal punctuation';
      expect(splitIntoSentences(text)).toEqual(['Single sentence without terminal punctuation']);
    });

    it('returns empty array for empty or whitespace-only strings', () => {
      expect(splitIntoSentences('')).toEqual([]);
      expect(splitIntoSentences('   \n  \t ')).toEqual([]);
    });
  });

  describe('calibrateSceneSegments', () => {
    const mockScene: Scene = {
      scene_id: 'test-scene-1',
      title: 'Testing Calibration',
      narration_text: 'Welcome to the pipeline. First we inspect the client request. Then we route through the API Gateway.',
      visual: {
        scene_type: 'diagram',
        highlighted_terms: ['client', 'API Gateway', 'pipeline'],
        animation_style: 'fade-slide',
      },
      captions: [
        { offset_ms: 0, duration_ms: 2500, text: 'Welcome to the pipeline.' },
        { offset_ms: 2500, duration_ms: 3000, text: 'First we inspect the client request.' },
        { offset_ms: 5500, duration_ms: 3500, text: 'Then we route through the API Gateway.' },
      ],
      uncertainty: 'none',
    };

    it('returns empty array if scene is null', () => {
      expect(calibrateSceneSegments(null, 10000)).toEqual([]);
    });

    it('calibrates segments against actual decoded audio duration with contiguous bounds', () => {
      const actualDurationMs = 9000;
      const segments = calibrateSceneSegments(mockScene, actualDurationMs);

      expect(segments).toHaveLength(3);

      // Verify contiguous non-overlapping intervals spanning exactly [0, actualDurationMs]
      expect(segments[0].startMs).toBe(0);
      expect(segments[0].endMs).toBe(segments[1].startMs);
      expect(segments[1].endMs).toBe(segments[2].startMs);
      expect(segments[2].endMs).toBe(actualDurationMs);

      // Verify each segment has valid positive duration
      segments.forEach((seg) => {
        expect(seg.durationMs).toBe(seg.endMs - seg.startMs);
        expect(seg.durationMs).toBeGreaterThan(0);
      });
    });

    it('extracts matching highlighted terms for each calibrated segment', () => {
      const segments = calibrateSceneSegments(mockScene, 9000);

      // Segment 0 mentions "pipeline"
      expect(segments[0].highlightedTerms).toContain('pipeline');
      expect(segments[0].highlightedTerms).not.toContain('API Gateway');

      // Segment 1 mentions "client"
      expect(segments[1].highlightedTerms).toContain('client');

      // Segment 2 mentions "API Gateway"
      expect(segments[2].highlightedTerms).toContain('API Gateway');
    });

    it('partitions narration_text by sentence when captions are empty in scene', () => {
      const sceneWithoutCaptions: Scene = {
        ...mockScene,
        captions: [],
      };

      const segments = calibrateSceneSegments(sceneWithoutCaptions, 12000);
      expect(segments).toHaveLength(3);
      expect(segments[0].text).toBe('Welcome to the pipeline.');
      expect(segments[0].startMs).toBe(0);
      expect(segments[2].endMs).toBe(12000);
    });

    it('estimates target duration reasonably when actualDurationMs is not provided', () => {
      const segments = calibrateSceneSegments(mockScene, null);
      expect(segments.length).toBe(3);
      expect(segments[0].startMs).toBe(0);
      expect(segments[2].endMs).toBeGreaterThanOrEqual(4000);
    });
  });

  describe('findActiveSegment', () => {
    const mockSegments = [
      {
        id: 'seg-0',
        index: 0,
        startMs: 0,
        endMs: 3000,
        durationMs: 3000,
        text: 'Segment 0',
        highlightedTerms: ['zero'],
      },
      {
        id: 'seg-1',
        index: 1,
        startMs: 3000,
        endMs: 7000,
        durationMs: 4000,
        text: 'Segment 1',
        highlightedTerms: ['one'],
      },
      {
        id: 'seg-2',
        index: 2,
        startMs: 7000,
        endMs: 10000,
        durationMs: 3000,
        text: 'Segment 2',
        highlightedTerms: ['two'],
      },
    ];

    it('returns null when segments list is empty', () => {
      expect(findActiveSegment([], 1500)).toBeNull();
    });

    it('clamps to first segment when elapsedMs <= 0', () => {
      expect(findActiveSegment(mockSegments, -500)?.index).toBe(0);
      expect(findActiveSegment(mockSegments, 0)?.index).toBe(0);
    });

    it('returns exact active segment based on elapsedMs interval [startMs, endMs)', () => {
      expect(findActiveSegment(mockSegments, 1500)?.index).toBe(0);
      expect(findActiveSegment(mockSegments, 3000)?.index).toBe(1);
      expect(findActiveSegment(mockSegments, 6999)?.index).toBe(1);
      expect(findActiveSegment(mockSegments, 7000)?.index).toBe(2);
      expect(findActiveSegment(mockSegments, 8500)?.index).toBe(2);
    });

    it('clamps to last segment when elapsedMs >= last.endMs', () => {
      expect(findActiveSegment(mockSegments, 10000)?.index).toBe(2);
      expect(findActiveSegment(mockSegments, 15000)?.index).toBe(2);
    });
  });
});
