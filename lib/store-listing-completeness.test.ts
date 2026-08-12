// Deviation from the brief's verbatim snippet: the suite's default `happy-dom`
// environment (see vitest.config.ts) replaces the global `URL` constructor
// with happy-dom's DOM URL, which resolves relative URLs against a fake
// `http://localhost:3000` document location instead of `import.meta.url`.
// That breaks `fileURLToPath(new URL('../../docs/i18n/', import.meta.url))`
// with "The URL must be of scheme file". Rather than add a per-file
// `@vitest-environment node` pragma (which could clash with a future need for
// DOM APIs in this file), this file builds the docs path with Node's
// `path.join(import.meta.dirname, ...)` instead — that's environment-agnostic
// and needs no `new URL()` call at all. No assertions, locales, or required
// sections differ from the brief.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const DOCS = path.join(import.meta.dirname, '../../docs/i18n/');
// docs/ is private and does not exist in the public mirror
// (github.com/tonic20/reverse-image-search-extension), a subtree split of
// extension/ alone. Skip rather than fail there. In the monorepo DOCS is
// always present, so every assertion below runs exactly as before.
// This must gate the `describe`s, not the `it`s: both suites call
// readFileSync in a describe body, which runs at collection time.
const HAS_DOCS = existsSync(DOCS);
const LOCALES = ['es', 'pt_BR', 'fr', 'de', 'ru', 'ja'];
const REQUIRED = ['## Name', '## Summary', '## Detailed description', '## Single-purpose', '## Permission justifications'];
/** AMO needs its own summary (250 chars, not 132) and markdown description. */
const REQUIRED_AMO = ['## AMO Summary', '## AMO Detailed description'];
const AMO_SUMMARY_MAX = 250;

/** First fenced block after a heading — the copy-paste payload. */
function blockAfter(body: string, heading: string): string {
  const rest = body.split(heading)[1] ?? '';
  return (rest.split('```')[1] ?? '').trim();
}

describe.skipIf(!HAS_DOCS).each(LOCALES)('store-listing.%s.md', (loc) => {
  const filePath = path.join(DOCS, `store-listing.${loc}.md`);
  it('exists', () => expect(existsSync(filePath)).toBe(true));
  it('has every required section', () => {
    const body = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
    for (const h of [...REQUIRED, ...REQUIRED_AMO]) expect(body, h).toContain(h);
  });

  describe('AMO variant', () => {
    const body = readFileSync(filePath, 'utf8');
    const summary = blockAfter(body, '## AMO Summary');
    const description = blockAfter(body, '## AMO Detailed description');

    it(`summary is within AMO's ${AMO_SUMMARY_MAX}-char cap`, () => {
      expect(summary.length).toBeGreaterThan(0);
      expect(summary.length).toBeLessThanOrEqual(AMO_SUMMARY_MAX);
    });

    // The three defects that made the CWS body unusable on AMO. Each one
    // shipped in all six locales before this guard existed.
    it('description uses markdown headings, not the CWS ▍ glyph', () => {
      expect(description).not.toContain('▍');
      expect(description).toContain('**');
    });
    it('description escapes <canvas> so AMO’s sanitizer cannot strip it', () => {
      expect(description).not.toMatch(/(?<!`)<canvas>/);
    });
    // The CWS body needs the same tag gone for a different reason: CWS renders
    // plain text, so a raw <canvas> shows literally to users and backticks
    // would too — hence "canvas element" in prose there, not code formatting.
    it('CWS body carries no raw <canvas> either', () => {
      const cws = blockAfter(body, '## Detailed description');
      expect(cws).not.toMatch(/<canvas>/);
    });
    it('description does not claim stores we have not shipped to', () => {
      const closing = description.split('\n').filter(Boolean).at(-1)!;
      for (const store of ['Edge', 'Opera']) expect(closing).not.toContain(store);
    });
  });
});

describe.skipIf(!HAS_DOCS)('Russian face-search terminology', () => {
  const body = readFileSync(path.join(DOCS, 'store-listing.ru.md'), 'utf8');
  it('uses the natural product label', () => {
    expect(body).toContain('«Поиск по лицу»');
    expect(body).not.toContain('«Искать это лицо»');
  });
});
