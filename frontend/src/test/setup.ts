import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { JSDOM } from 'jsdom';

// vitest 4.1.10's jsdom pool does not expose `localStorage`/`sessionStorage`
// on the global scope (jsdom only provides them when instantiated directly).
// Polyfill both from a throwaway JSDOM instance so every test file can rely
// on window.localStorage/window.sessionStorage being present.
if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.sessionStorage === 'undefined') {
  const { window } = new JSDOM('', { url: 'http://localhost:3000/' });

  if (typeof globalThis.localStorage === 'undefined') {
    globalThis.localStorage = window.localStorage;
  }
  if (typeof globalThis.sessionStorage === 'undefined') {
    globalThis.sessionStorage = window.sessionStorage;
  }
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
