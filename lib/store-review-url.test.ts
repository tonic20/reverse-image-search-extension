// Pins the store→review-URL map. The bug this guards: v0.7.0 shipped a
// hardcoded Chrome Web Store URL, so the review prompt on any non-Chrome build
// sent users to a listing they hadn't installed from and couldn't review.
//
// reviewUrlFor() takes the target as an argument rather than reading
// import.meta.env.BROWSER, so every branch is testable without building.
import { describe, it, expect } from 'vitest';
import { REVIEW_URLS, reviewUrlFor } from './store-review-url';

describe('reviewUrlFor', () => {
  it('returns the Chrome Web Store reviews page for chrome', () => {
    expect(reviewUrlFor('chrome')).toBe(
      'https://chromewebstore.google.com/detail/jmfdmdfnhkgbnpnpignhjcokpllbnhpp/reviews',
    );
  });

  // Each becomes a real URL only once that listing is published. Deleting a
  // case here without adding the URL would silently re-point users at Chrome.
  it.each(['firefox', 'edge', 'opera'])('returns null for unpublished store %s', (target) => {
    expect(reviewUrlFor(target)).toBeNull();
  });

  it('returns null for an unknown or undefined target', () => {
    expect(reviewUrlFor('safari')).toBeNull();
    expect(reviewUrlFor(undefined)).toBeNull();
    expect(reviewUrlFor('')).toBeNull();
  });

  it('never maps a store to another store’s domain', () => {
    for (const [target, url] of Object.entries(REVIEW_URLS)) {
      const host = new URL(url).hostname;
      const expected: Record<string, string> = {
        chrome: 'chromewebstore.google.com',
        firefox: 'addons.mozilla.org',
        edge: 'microsoftedge.microsoft.com',
        opera: 'addons.opera.com',
      };
      expect(host, `${target} points at ${host}`).toBe(expected[target]);
    }
  });
});
