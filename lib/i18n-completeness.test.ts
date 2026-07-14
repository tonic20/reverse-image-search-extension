// @vitest-environment node
//
// Deviation from the brief's verbatim snippet: the suite's default `happy-dom`
// environment (see vitest.config.ts) replaces the global `URL` constructor
// with happy-dom's DOM URL, which resolves relative URLs against a fake
// `http://localhost:3000` document location instead of `import.meta.url`.
// That breaks `fileURLToPath(new URL('../locales/', import.meta.url))` with
// "The URL must be of scheme file". This file needs only Node's fs/yaml APIs
// (no DOM), so it opts back into the real Node environment per-file via this
// docblock — the only supported, non-global way to fix it. No assertions,
// keys, or catalog values differ from the brief.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const LOCALES_DIR = fileURLToPath(new URL('../locales/', import.meta.url));
const REQUIRED_MANIFEST_KEYS = ['extName', 'extDescription'];
// Keys carrying a positional substitution; arity must match across locales.
const SUBSTITUTION_ARITY: Record<string, number> = { status_reload: 1 };

function load(locale: string): Record<string, string> {
  return parse(readFileSync(`${LOCALES_DIR}${locale}.yml`, 'utf8')) as Record<string, string>;
}
function countPlaceholders(v: string): number {
  const m = v.match(/\$\d/g);
  return m ? new Set(m).size : 0;
}

const en = load('en');
const enKeys = Object.keys(en).sort();
const otherLocales = readdirSync(LOCALES_DIR)
  .filter((f) => f.endsWith('.yml') && f !== 'en.yml')
  .map((f) => f.replace(/\.yml$/, ''));

describe('en.yml catalog', () => {
  it('defines the manifest keys, non-empty', () => {
    for (const k of REQUIRED_MANIFEST_KEYS) expect(en[k]?.trim()).toBeTruthy();
  });
  it('has every value a non-empty string', () => {
    for (const [k, v] of Object.entries(en)) {
      expect(typeof v, k).toBe('string');
      expect(v.trim(), k).toBeTruthy();
    }
  });
});

describe.each(otherLocales)('locale %s matches en', (locale) => {
  const msgs = load(locale);
  it('has exactly the same keys as en (no missing, no extra)', () => {
    expect(Object.keys(msgs).sort()).toEqual(enKeys);
  });
  it('has every value non-empty', () => {
    for (const [k, v] of Object.entries(msgs)) expect(v?.toString().trim(), k).toBeTruthy();
  });
  it('preserves substitution arity', () => {
    for (const [k, n] of Object.entries(SUBSTITUTION_ARITY)) {
      expect(countPlaceholders(msgs[k] ?? ''), k).toBe(n);
    }
  });
});
