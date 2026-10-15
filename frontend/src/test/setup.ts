import '@testing-library/jest-dom';
import { vi } from 'vitest';

// JSDOM audio element mocks
window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(() => Promise.resolve());
window.HTMLMediaElement.prototype.pause = vi.fn();
window.HTMLMediaElement.prototype.load = vi.fn();

Object.defineProperty(window.HTMLMediaElement.prototype, 'duration', {
  get() {
    return 5.0;
  },
  configurable: true,
});

Object.defineProperty(window.HTMLMediaElement.prototype, 'readyState', {
  get() {
    return 4;
  },
  configurable: true,
});

// URL object URL mocks
window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-audio-url');
window.URL.revokeObjectURL = vi.fn();

// Web Speech API mock for JSDOM
if (typeof window !== 'undefined') {
  const mockSynth = {
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn().mockReturnValue([
      { name: 'Google US English', lang: 'en-US', default: true },
      { name: 'Google Hindi', lang: 'hi-IN', default: false },
    ]),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    paused: false,
    pending: false,
    speaking: false,
  };

  class MockUtterance {
    text: string;
    lang = 'en-US';
    rate = 1;
    voice: any = null;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: ((e: any) => void) | null = null;
    constructor(text: string = '') {
      this.text = text;
    }
  }

  Object.defineProperty(window, 'speechSynthesis', {
    value: mockSynth,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    value: MockUtterance,
    writable: true,
    configurable: true,
  });
}

