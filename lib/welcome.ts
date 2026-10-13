// The welcome page opened once, right after install: reverseimage.app/<locale>/welcome. Its job is a
// first search on the page's sample photo, then pinning the icon for paste and capture. It needs
// facts only the extension knows: whether the icon is already on the toolbar (new Chrome pins new
// extensions itself unless the user turned that off), the browser (each has its own extensions
// button), and the exact context-menu entry, which Chrome titles with the localized manifest name —
// in 45 store languages that name is local while the page is English.
//
// In Chromium the page also gets the extension's id and connects to it (externally_connectable in
// wxt.config.ts, the listener in entrypoints/background.ts) for the pin state live.

/** Site the welcome page lives on. Empty string: nothing opens on install. Keep the default in
 *  sync with externally_connectable in wxt.config.ts. */
export const WELCOME_BASE: string =
  (import.meta.env.VITE_WELCOME_BASE as string | undefined) ?? 'https://reverseimage.app';

export type WelcomeBrowser = 'chrome' | 'edge' | 'firefox';

/** Site locales other than English, keyed by the language part of the browser UI language. */
const SITE_LOCALES: Record<string, string> = { es: 'es', pt: 'pt-br', fr: 'fr', de: 'de', ru: 'ru', ja: 'ja' };

/** The site locale for a browser UI language such as `pt-BR` or `es_419`; `null` for English. */
export function welcomeLocale(uiLanguage: string): string | null {
  const language = uiLanguage.toLowerCase().split(/[-_]/)[0] ?? '';
  return SITE_LOCALES[language] ?? null;
}

/** The welcome page address. Unknown facts are left out and the page shows steps that fit all. */
export function welcomeUrl(o: {
  base: string;
  locale: string | null;
  pinned?: boolean;
  browser: WelcomeBrowser;
  id?: string;
  menu?: string;
}): string {
  const url = new URL(o.locale ? `/${o.locale}/welcome` : '/welcome', o.base);
  if (o.pinned !== undefined) url.searchParams.set('pinned', o.pinned ? '1' : '0');
  url.searchParams.set('browser', o.browser);
  if (o.id) url.searchParams.set('id', o.id);
  if (o.menu) url.searchParams.set('menu', o.menu);
  return url.href;
}

/** What the extension sends to the connected welcome page. */
export type PinMessage = { pinned: boolean };
