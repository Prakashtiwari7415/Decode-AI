// Enums
export type Language = 'en' | 'hi' | 'hinglish';
export type ContentType = 'prompt' | 'code_diff' | 'terminal' | 'completion' | 'explanation';
export type SceneType = 'text' | 'code_diff' | 'terminal' | 'diagram' | 'comparison';
export type UncertaintyLevel = 'none' | 'low' | 'medium' | 'high';
export type DetailLevel = 'brief' | 'standard' | 'deep';
export type VerificationImportance = 'must-know' | 'nice-to-know' | 'caution';
export type AnimationStyle = 'fade-slide' | 'typewriter' | 'highlight-sweep';

// Request
export interface LessonRequest {
  content: string;
  content_type: ContentType;
  language: Language;
  detail_level: DetailLevel;
}

// Response models
export interface VisualSpec {
  scene_type: SceneType;
  before_code?: string;
  after_code?: string;
  language?: string;
  command?: string;
  output?: string;
  exit_code?: number;
  mermaid_definition?: string;
  highlighted_terms: string[];
  animation_style: AnimationStyle;
}

export interface Caption {
  offset_ms: number;
  duration_ms: number;
  text: string;
}

export interface GlossaryEntry {
  term: string;
  definition: string;
  example?: string;
}

export interface VerificationItem {
  id: string;
  statement: string;
  importance: VerificationImportance;
}

export interface Scene {
  scene_id: string;
  title: string;
  narration_text: string;
  visual: VisualSpec;
  captions: Caption[];
  uncertainty: UncertaintyLevel;
  uncertainty_note?: string;
}

export interface Chapter {
  chapter_id: string;
  title: string;
  summary: string;
  scenes: Scene[];
}

export interface Lesson {
  lesson_id: string;
  title: string;
  language: Language;
  content_type: ContentType;
  total_estimated_duration_ms: number;
  chapters: Chapter[];
  glossary: GlossaryEntry[];
  verification_checklist: VerificationItem[];
  gemini_model_version: string;
  generated_at: string;
}
