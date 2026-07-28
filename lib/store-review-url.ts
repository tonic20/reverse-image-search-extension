/**
 * Where "Leave a review" should send the user, per store.
 *
 * Every store has its own listing and its own review page, and the id/slug is
 * assigned when the listing is created — so a URL only exists once we've
 * actually published there. Anything not listed here resolves to `null`, which
 * suppresses the review prompt entirely rather than sending someone to a store
 * they didn't install from. (Before this existed, the Chrome Web Store URL was
 * hardcoded, so a Firefox user clicking through landed on a CWS listing they
 * could not review.)
 *
 * The lookup key is WXT's build-time `import.meta.env.BROWSER`, so each package
 * is compiled with exactly one outcome — no runtime UA sniffing.
 *
 * To enable a store: publish, then add its review URL below.
 */
const CHROME_REVIEW_URL =
  'https://chromewebstore.google.com/detail/jmfdmdfnhkgbnpnpignhjcokpllbnhpp/reviews';

export const REVIEW_URLS: Readonly<Record<string, string>> = {
  chrome: CHROME_REVIEW_URL,
  // firefox: 'https://addons.mozilla.org/firefox/addon/<slug>/reviews/'
  //   Pending — AMO assigns the slug at submission. Until then the prompt stays
  //   suppressed on Firefox.
  // edge:    'https://microsoftedge.microsoft.com/addons/detail/<id>' — not submitted yet.
  // opera:   'https://addons.opera.com/en/extensions/details/<slug>/' — not submitted yet.
};

/**
 * Review URL for a build target, or null when we haven't published there.
 * Exists for the unit tests: it exercises every branch without a build.
 */
export function reviewUrlFor(browser: string | undefined): string | null {
  if (!browser) return null;
  return REVIEW_URLS[browser] ?? null;
}

/**
 * Resolved for this build. `null` => never show the review prompt.
 *
 * Written as an explicit build-flag ternary rather than
 * `reviewUrlFor(import.meta.env.BROWSER)`. That map lookup is a *runtime*
 * property access, so rollup has to keep every store's URL in every bundle —
 * the Firefox package literally shipped a chromewebstore.google.com string.
 * With the flag inlined to `false`, the branch and the URL are both
 * dead-code-eliminated, and the Firefox build contains no Chrome link at all.
 * Guarded by a test that greps the built bundles.
 *
 * Add a store here and to REVIEW_URLS together when its listing goes live.
 */
export const STORE_REVIEW_URL: string | null = import.meta.env.CHROME ? CHROME_REVIEW_URL : null;
