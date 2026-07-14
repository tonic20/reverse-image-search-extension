import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { localizeDom } from './dom-i18n';

const stub = (key: string) => `T:${key}`;

describe('localizeDom', () => {
  it('sets textContent from data-i18n', () => {
    document.body.innerHTML = `<span data-i18n="popup_capture">old</span>`;
    localizeDom(document, stub);
    expect(document.querySelector('span')!.textContent).toBe('T:popup_capture');
  });
  it('sets innerHTML from data-i18n-html', () => {
    document.body.innerHTML = `<p data-i18n-html="popup_hint_html">old</p>`;
    localizeDom(document, () => 'a <b>b</b>');
    expect(document.querySelector('p')!.innerHTML).toBe('a <b>b</b>');
  });
  it('leaves elements without the attributes untouched', () => {
    document.body.innerHTML = `<span>keep</span>`;
    localizeDom(document, stub);
    expect(document.querySelector('span')!.textContent).toBe('keep');
  });
});

// Deviation from the brief's verbatim snippet: happy-dom (this suite's default
// environment; see vitest.config.ts) replaces the global `URL` constructor
// with its DOM URL, which resolves relative URLs against a fake
// `http://localhost:3000` document location instead of `import.meta.url`. That
// breaks `fileURLToPath(new URL('../foo', import.meta.url))` with "The URL
// must be of scheme file" (see lib/i18n-completeness.test.ts, which hits the
// identical problem and works around it by forcing the plain Node test
// environment for that whole file via a per-file pragma comment).
// This file can't use that same per-file override, because the `localizeDom`
// tests above need happy-dom's DOM APIs. NOTE: do not literally spell out
// that pragma's directive text here — Vitest's scanner matches it anywhere in
// a file's source, not just as a leading docblock, and would silently flip
// this whole file to the plain Node environment (breaking `document` above).
// `path.join(import.meta.dirname, ...)` sidesteps the global URL polyfill
// entirely and works under both environments.
describe('popup data-i18n keys', () => {
  const html = readFileSync(join(import.meta.dirname, '../entrypoints/popup/index.html'), 'utf8');
  const en = parse(readFileSync(join(import.meta.dirname, '../locales/en.yml'), 'utf8')) as Record<string, string>;
  const keys = [...html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)].map((m) => m[1]);

  it('finds data-i18n attributes in the popup', () => {
    expect(keys.length).toBeGreaterThan(0);
  });
  it.each(keys)('key "%s" is defined in en.yml', (key) => {
    expect(en[key]?.trim()).toBeTruthy();
  });
});
