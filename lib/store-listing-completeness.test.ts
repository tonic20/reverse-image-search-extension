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
const LOCALES = ['es', 'pt_BR', 'fr', 'de', 'ru', 'ja'];
const REQUIRED = ['## Name', '## Summary', '## Detailed description', '## Single-purpose', '## Permission justifications'];

describe.each(LOCALES)('store-listing.%s.md', (loc) => {
  const filePath = path.join(DOCS, `store-listing.${loc}.md`);
  it('exists', () => expect(existsSync(filePath)).toBe(true));
  it('has every required section', () => {
    const body = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
    for (const h of REQUIRED) expect(body, h).toContain(h);
  });
});
