/**
 * Pure core for search counting: what we report, and the request that carries it.
 *
 * No browser imports live here on purpose — the same reason review-prompt.ts
 * has none. This module is unit-tested under vitest/happy-dom, which has no WXT
 * browser mock; all browser I/O lives in ./telemetry-actions.ts.
 *
 * What is reported is a label and a timestamp. Never the image, never its
 * address, never an identifier — the server drops anything off its own
 * allowlist, so this side and that side have to agree on the spelling.
 */

/** Where a search started. Must match ClientAction::ACTIONS on the server. */
export const SEARCH_ACTIONS = [
  'direct_google',
  'direct_yandex',
  'direct_bing',
  'direct_tineye',
  'direct_all',
  'direct_face',
  'upload_menu',
  'upload_overlay',
  'upload_face',
  'upload_capture',
  'upload_paste',
] as const;

export type SearchAction = (typeof SEARCH_ACTIONS)[number];

export const DIRECT_ACTIONS = SEARCH_ACTIONS.filter((a) => a.startsWith('direct_'));
export const UPLOAD_ACTIONS = SEARCH_ACTIONS.filter((a) => a.startsWith('upload_'));

export const VERSION_HEADER = 'X-Extension-Version';
export const ACTION_HEADER = 'X-Extension-Action';
/** The one name the server's event allowlist accepts from us. */
export const EVENT_NAME = 'extension_search';

export interface ReportingContext {
  /** The `countSearches` setting. False means report nothing at all. */
  enabled: boolean;
  /** This build's manifest version; empty if it couldn't be read. */
  version: string;
}

/**
 * Headers for a request we are making anyway (the presign call).
 *
 * The upload path costs no extra request: the entry point and version travel on
 * the request that was already going out.
 */
/**
 * Whether counting is on, given every switch that can turn it off.
 *
 * `browserConsent` is Firefox's own data-collection permission: true or false
 * where the browser owns the decision, null where it has no such concept —
 * Chrome, and Firefox before 140.
 *
 * Where the browser owns it, our stored setting is not consulted at all. The
 * popup hides its checkbox there, so that setting is whatever it happened to be
 * beforehand; letting an invisible switch override the visible one is how you
 * end up reporting against a refusal the user believes they recorded.
 *
 * A browser privacy signal still vetoes either way — it costs nothing and it is
 * the only control left on Firefox below 140.
 */
export function countingEnabled(
  setting: boolean,
  browserConsent: boolean | null,
  optedOutBySignal: boolean,
): boolean {
  if (optedOutBySignal) return false;
  return browserConsent ?? setting;
}

export function countingHeaders(
  action: SearchAction | undefined,
  ctx: ReportingContext,
): Record<string, string> {
  if (!ctx.enabled) return {};

  const headers: Record<string, string> = {};
  // An action we do not recognise is left off entirely, so the column goes NULL.
  // A stale content script — one injected before an update — sends none, and a
  // guessed label would be a fabricated number in a table people read as fact.
  if (action) headers[ACTION_HEADER] = action;
  if (ctx.version) headers[VERSION_HEADER] = ctx.version;
  return headers;
}

/**
 * The direct path's beacon — the only request that path ever makes.
 *
 * `keepalive` because the search opens new tabs immediately afterwards; the
 * request must not be cut off by the worker going idle. Returns null rather
 * than throwing when counting is off, so the caller has one thing to check.
 */
export function searchEventRequest(
  action: SearchAction,
  ctx: ReportingContext,
  apiBase: string,
): { url: string; init: RequestInit } | null {
  if (!ctx.enabled) return null;

  return {
    url: `${apiBase}/v1/events`,
    init: {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...countingHeaders(action, ctx),
      },
      body: new URLSearchParams({ name: EVENT_NAME }).toString(),
    },
  };
}

/**
 * Narrow a value off a runtime message to a known UPLOAD action.
 *
 * Messages cross the content-script boundary, so the action arrives as a plain
 * string — and from a script that may predate the update that started sending
 * one. Unknown means undefined, never a default: the upload still happens and
 * still reports its version, it simply carries no attribution.
 *
 * The upload subset, not all actions, because every message that carries one is
 * an upload path: a message claiming `direct_google` must not label an upload.
 */
export function uploadAction(value: unknown): SearchAction | undefined {
  return (UPLOAD_ACTIONS as readonly string[]).includes(value as string)
    ? (value as SearchAction)
    : undefined;
}

/**
 * Which direct action a context-menu id represents.
 *
 * The per-engine items carry the engine id as their menu id, so the mapping is
 * mechanical. An id we do not recognise is `undefined`, not a guess: the caller
 * builds `ids = [menuItemId]`, which matches no engine and opens no tab, so no
 * search happens — recording one anyway would be a fabricated attribution.
 */
export function menuAction(menuItemId: string, allId: string): SearchAction | undefined {
  if (menuItemId === allId) return 'direct_all';

  const candidate = `direct_${menuItemId}`;
  return (DIRECT_ACTIONS as readonly string[]).includes(candidate)
    ? (candidate as SearchAction)
    : undefined;
}

/**
 * Whether the browser itself says not to count.
 *
 * Firefox's MV3 background is an event page with a DOM, so it has a navigator
 * and can carry Do Not Track / Global Privacy Control; Chrome's service worker
 * does not. Absent is not consent — it only means the browser never offered the
 * signal here, which is why the settings checkbox exists as well.
 */
export function signalsOptOut(nav: unknown): boolean {
  const n = nav as { doNotTrack?: unknown; globalPrivacyControl?: unknown } | undefined;
  return n?.doNotTrack === '1' || n?.doNotTrack === 'yes' || n?.globalPrivacyControl === true;
}
