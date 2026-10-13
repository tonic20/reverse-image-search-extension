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
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const DOCS = path.join(import.meta.dirname, '../../docs/i18n/');
// docs/ is private and does not exist in the public mirror
// (github.com/tonic20/reverse-image-search-extension), a subtree split of
// extension/ alone. Skip rather than fail there. In the monorepo DOCS is
// always present, so every assertion below runs exactly as before.
// This must gate the `describe`s, not the `it`s: both suites call
// readFileSync in a describe body, which runs at collection time.
const HAS_DOCS = existsSync(DOCS);
const LOCALES = ['es', 'pt_BR', 'fr', 'de', 'ru', 'ja'];
// The CWS name, summary and detailed description moved to docs/store/_locales (tested at the end).
const REQUIRED = ['## Single-purpose', '## Permission justifications'];
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
    // `describe.skipIf` on the outer suite (and Vitest's cascading skip in
    // general) only skips `it` callbacks -- it does not stop the `describe`
    // factory itself from running at collection time. So this read, sitting
    // directly in a describe body, must guard itself too, even though its
    // sibling `it`s below are already skipped as descendants of the outer
    // `describe.skipIf(!HAS_DOCS)`.
    const body = HAS_DOCS ? readFileSync(filePath, 'utf8') : '';
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
    it('description does not claim stores we have not shipped to', () => {
      const closing = description.split('\n').filter(Boolean).at(-1)!;
      for (const store of ['Edge', 'Opera']) expect(closing).not.toContain(store);
    });
  });
});

describe.skipIf(!HAS_DOCS)('Russian face-search terminology', () => {
  // Same collection-time caveat as the AMO variant block above: this read is
  // directly in the describe body, so `skipIf` on this very describe does not
  // protect it -- only its child `it` (guarded by that skipIf) is skipped.
  const body = HAS_DOCS ? readFileSync(path.join(DOCS, 'store-listing.ru.md'), 'utf8') : '';
  it('uses the natural product label', () => {
    expect(body).toContain('«Поиск по лицу»');
    expect(body).not.toContain('«Искать это лицо»');
  });
});

// The store copy of every language lives in docs/store/_locales (appName, shortDesc, storeDesc);
// scripts/build-extension-locales.ts copies the name and short description into locales/*.yml.
// This catches an edit to one side that was not carried to the other.
const STORE = path.join(import.meta.dirname, '../../docs/store/_locales/');
const CATALOGS = path.join(import.meta.dirname, '../locales/');

describe.skipIf(!existsSync(STORE))('store name and short description in the extension', () => {
  const storeLocales = () => readdirSync(STORE).filter((l) => existsSync(path.join(STORE, l, 'messages.json')));
  const store = (l: string) => JSON.parse(readFileSync(path.join(STORE, l, 'messages.json'), 'utf8'));
  const catalog = (l: string) => parse(readFileSync(path.join(CATALOGS, `${l}.yml`), 'utf8')) as Record<string, string>;

  it('every store language has a catalog, and every catalog a store language', () => {
    const catalogs = readdirSync(CATALOGS).filter((f) => f.endsWith('.yml')).map((f) => f.replace(/\.yml$/, ''));
    expect(catalogs.sort()).toEqual(storeLocales().sort());
  });
  it('extName and extDescription are the store appName and shortDesc', () => {
    for (const l of storeLocales()) {
      expect(catalog(l).extName, l).toBe(store(l).appName.message);
      expect(catalog(l).extDescription, l).toBe(store(l).shortDesc.message);
    }
  });
  // CWS renders plain text, so a raw <canvas> would show literally to users and backticks would
  // too — hence "canvas element" in prose there, not code formatting.
  it('no store description carries a raw <canvas>', () => {
    for (const l of storeLocales()) expect(store(l).storeDesc.message, l).not.toMatch(/<canvas>/);
  });
  it('English is the source: the short description is package.json description', () => {
    const pkg = JSON.parse(readFileSync(path.join(import.meta.dirname, '../package.json'), 'utf8'));
    expect(store('en').shortDesc.message).toBe(pkg.description);
  });
});
