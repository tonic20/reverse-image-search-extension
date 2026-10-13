import { describe, it, expect } from 'vitest';
import { welcomeLocale, welcomeUrl } from './welcome';

describe('welcomeLocale', () => {
  it.each([
    ['es', 'es'], ['es-419', 'es'], ['es_419', 'es'],
    ['pt-BR', 'pt-br'], ['pt_PT', 'pt-br'], ['pt', 'pt-br'],
    ['fr-CA', 'fr'], ['de-AT', 'de'], ['ru', 'ru'], ['ja', 'ja'],
    ['en-US', null], ['sv', null], ['zh-CN', null], ['', null],
  ])('%s → %s', (ui, locale) => {
    expect(welcomeLocale(ui)).toBe(locale);
  });
});

describe('welcomeUrl', () => {
  const base = 'https://reverseimage.app';

  it('puts English at the root and other locales under their prefix', () => {
    expect(new URL(welcomeUrl({ base, locale: null, browser: 'chrome' })).pathname).toBe('/welcome');
    expect(new URL(welcomeUrl({ base, locale: 'pt-br', browser: 'chrome' })).pathname).toBe('/pt-br/welcome');
  });

  it('carries pin state, browser, id and the menu name', () => {
    const q = new URL(welcomeUrl({ base, locale: 'ru', pinned: false, browser: 'edge', id: 'abc', menu: 'Bildsök - Reverse Image Search' })).searchParams;
    expect(q.get('pinned')).toBe('0');
    expect(q.get('browser')).toBe('edge');
    expect(q.get('id')).toBe('abc');
    expect(q.get('menu')).toBe('Bildsök - Reverse Image Search');
  });

  it('leaves out what is not known', () => {
    const q = new URL(welcomeUrl({ base, locale: null, browser: 'firefox' })).searchParams;
    expect(q.has('pinned')).toBe(false);
    expect(q.has('id')).toBe(false);
    expect(q.has('menu')).toBe(false);
    expect(q.get('browser')).toBe('firefox');
  });

  it('writes pinned=1 when the icon is on the toolbar', () => {
    expect(new URL(welcomeUrl({ base, locale: null, pinned: true, browser: 'chrome' })).searchParams.get('pinned')).toBe('1');
  });
});
