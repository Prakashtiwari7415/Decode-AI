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

