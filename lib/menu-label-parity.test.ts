// The public site tells users which context-menu item to click. When the
// shipped label and that copy drift apart, the instructions point at something
// that isn't in the menu — and the failure is silent, because nothing links the
// two. It has already happened three times: privacy, guide, and support all
// said "Search image (upload)" long after the item was renamed to
// menu_all_engines_upload. Notably only the ENGLISH pages drifted each time;
// the six translations stayed correct, so a reader of the English site got the
// worst instructions.
//
// This pins every public page that references the upload flow to the exact
// string the extension ships for that locale.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '../..');
const PAGES_DIR = path.join(ROOT, 'backend/app/views/pages');
// backend/ is private and does not exist in the public mirror, a subtree split
// of extension/ alone. Skip rather than fail there. Unlike the store-listing
// suite, this file's outside reads sit in `it` callbacks, so collection is
// safe and one guard on the top-level describe is enough. shippedLabel() reads
// ../locales/, which is inside extension/ and must keep working.
const HAS_PAGES = existsSync(PAGES_DIR);

/** extension locale code → backend view filename infix ('' for English). */
const LOCALES: Record<string, string> = {
  en: '',
  de: '.de',
  es: '.es',
  fr: '.fr',
  ja: '.ja',
  pt_BR: '.pt-br',
  ru: '.ru',
};

/** Public pages that instruct the user to pick the upload menu item. */
const PAGES = ['guide', 'support', 'privacy'];

/** Labels the copy used to carry. Regressing to one of these is the bug. */
const STALE = ['Search image (upload)', 'All engines (upload)'];

function shippedLabel(locale: string): string {
  const yml = readFileSync(path.join(import.meta.dirname, `../locales/${locale}.yml`), 'utf8');
  const match = yml.match(/^menu_all_engines_upload:\s*(.+?)\s*$/m);
  if (!match) throw new Error(`menu_all_engines_upload missing from locales/${locale}.yml`);
  return match[1];
}

describe.skipIf(!HAS_PAGES).each(Object.entries(LOCALES))('%s public pages', (locale, infix) => {
  const label = shippedLabel(locale);

  it.each(PAGES)('%s page uses the shipped menu label verbatim', (page) => {
    const body = readFileSync(path.join(PAGES_DIR, `${page}${infix}.html.erb`), 'utf8');
    expect(body, `${page}${infix}.html.erb must name the item exactly "${label}"`).toContain(label);
  });

  it.each(PAGES)('%s page has no stale menu label', (page) => {
    const body = readFileSync(path.join(PAGES_DIR, `${page}${infix}.html.erb`), 'utf8');
    // The stale English strings are substrings of nothing in the localized
    // copy, so this is safe to assert for every locale.
    for (const bad of STALE) expect(body).not.toContain(bad);
  });
});
