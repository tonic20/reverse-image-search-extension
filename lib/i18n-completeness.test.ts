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
const SUBSTITUTION_ARITY: Record<string, number> = { status_reload: 1, popup_hint_html: 1 };
// Locales with the whole UI translated. Every other locale carries only the store name and
// short description (the manifest keys); Chrome falls back to en for the rest of the UI.
const UI_LOCALES = ['es', 'pt_BR', 'fr', 'de', 'ru', 'ja'];

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
const nameOnlyLocales = otherLocales.filter((l) => !UI_LOCALES.includes(l));

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

describe.each(UI_LOCALES)('locale %s matches en', (locale) => {
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

describe.each(nameOnlyLocales)('locale %s (name and description only)', (locale) => {
  const msgs = load(locale);
  it('has exactly the manifest keys, non-empty', () => {
    expect(Object.keys(msgs).sort()).toEqual([...REQUIRED_MANIFEST_KEYS].sort());
    for (const k of REQUIRED_MANIFEST_KEYS) expect(msgs[k]?.trim(), k).toBeTruthy();
  });
});

describe('extension locale coverage', () => {
  it('ships every UI locale', () => {
    for (const l of UI_LOCALES) expect(otherLocales).toContain(l);
  });
});

// The store shows 45 characters of the name in search results.
const NAME_MAX = 45;

describe.each(['en', ...otherLocales])('locale %s manifest name', (locale) => {
  const msgs = locale === 'en' ? en : load(locale);
  it(`extName is at most ${NAME_MAX} code points`, () => {
    expect([...(msgs.extName ?? '')].length).toBeLessThanOrEqual(NAME_MAX);
  });
});

// Chrome Web Store caps the manifest `description` field (populated here via
// __MSG_extDescription__) at 132 characters. A longer localized value fails
// submission, so this guard measures every locale's extDescription by code
// point (not UTF-16 .length, which would misreport around astral chars).
const MANIFEST_DESCRIPTION_MAX = 132;

describe.each(['en', ...otherLocales])('locale %s manifest description', (locale) => {
  const msgs = locale === 'en' ? en : load(locale);
  it(`extDescription is at most ${MANIFEST_DESCRIPTION_MAX} code points`, () => {
    const value = msgs.extDescription ?? '';
    expect([...value].length).toBeLessThanOrEqual(MANIFEST_DESCRIPTION_MAX);
  });
});

// The context-menu parent is titled with the localized manifest name, so the popup hint takes
// extName as $1 instead of spelling the name out (entrypoints/popup/main.ts).
describe.each(['en', ...UI_LOCALES])('locale %s popup hint', (locale) => {
  const msgs = locale === 'en' ? en : load(locale);
  it('names the context menu parent through the extName substitution', () => {
    expect(msgs.popup_hint_html).toContain('<b>$1</b>');
  });
});

describe('Russian face-search label', () => {
  const ru = load('ru');
  it('uses the natural noun phrase in compact UI actions', () => {
    expect(ru.search_this_face).toBe('Поиск по лицу');
    expect(ru.menu_face).toBe('🔍 Поиск по лицу…');
  });
});
