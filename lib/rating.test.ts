import { describe, it, expect } from 'vitest';
import {
  RUNS_TO_ASK,
  RatingLinks,
  RatingState,
  normalizeRating,
  countRun,
  rate,
  shouldAsk,
  rateTarget,
} from './rating';

const LINKS: RatingLinks = { reviews: 'https://example.com/reviews', feedback: 'https://example.com/form' };
const NEW: RatingState = { runs: 0, rated: 0 };
const ready = (p: Partial<RatingState> = {}): RatingState => ({ runs: RUNS_TO_ASK, rated: 0, ...p });

describe('normalizeRating', () => {
  it('reads nothing saved, or something broken, as a new user', () => {
    for (const saved of [null, undefined, 'oops', [1], { runs: -3 }, { runs: 1.5, rated: 9 }, { runs: '2', rated: '5' }]) {
      expect(normalizeRating(saved), JSON.stringify(saved)).toEqual(NEW);
    }
  });
  it('keeps valid values', () => {
    expect(normalizeRating({ runs: 4, rated: 3 })).toEqual({ runs: 4, rated: 3 });
    expect(normalizeRating({ runs: 2 })).toEqual({ runs: 2, rated: 0 });
  });

  // Installs from 0.7.0 on kept the review card's state under `reviewPrompt`.
  // Its count carries over, and someone who already went to the store is not
  // asked again.
  describe('without a saved rating, from the old review card', () => {
    it('carries the search count over', () => {
      expect(normalizeRating(undefined, { successCount: 7, lastPromptAt: null, reviewed: false })).toEqual({ runs: 7, rated: 0 });
    });
    it('counts "Leave a review" as rated', () => {
      expect(normalizeRating(undefined, { successCount: 3, lastPromptAt: 1, reviewed: true }).rated).toBeGreaterThan(0);
    });
    it('ignores a card that was only shown or dismissed', () => {
      expect(normalizeRating(undefined, { successCount: 3, lastPromptAt: 1_700_000_000_000, reviewed: false }).rated).toBe(0);
    });
    it('reads a broken old state as a new user', () => {
      expect(normalizeRating(undefined, 'oops')).toEqual(NEW);
      expect(normalizeRating(undefined, { successCount: -1, reviewed: 'yes' })).toEqual(NEW);
    });
  });
  it('prefers a saved rating over the old card', () => {
    expect(normalizeRating({ runs: 1, rated: 0 }, { successCount: 9, reviewed: true })).toEqual({ runs: 1, rated: 0 });
  });
});

describe('shouldAsk', () => {
  it('waits for RUNS_TO_ASK successful searches', () => {
    expect(RUNS_TO_ASK).toBe(3);
    expect(shouldAsk(NEW, LINKS)).toBe(false);
    expect(shouldAsk(ready({ runs: RUNS_TO_ASK - 1 }), LINKS)).toBe(false);
    expect(shouldAsk(ready(), LINKS)).toBe(true);
  });
  it('never asks again once any star was clicked', () => {
    for (const stars of [1, 3, 5]) expect(shouldAsk(rate(ready(), stars), LINKS)).toBe(false);
  });
  // Both ends must exist: with no store listing the 4–5 stars lead nowhere,
  // with no form the 1–3 stars do — and a Firefox user must never be sent to
  // the Chrome Web Store (see store-review-url.ts).
  it('stays hidden without a review page or a feedback form', () => {
    expect(shouldAsk(ready(), { ...LINKS, reviews: null })).toBe(false);
    expect(shouldAsk(ready(), { ...LINKS, feedback: '' })).toBe(false);
  });
});

describe('transitions', () => {
  it('countRun adds one, until rated', () => {
    expect(countRun(NEW)).toEqual({ runs: 1, rated: 0 });
    const rated = { runs: 5, rated: 4 };
    expect(countRun(rated)).toBe(rated);
  });
  it('rate records the stars', () => {
    expect(rate(ready(), 2)).toEqual({ runs: RUNS_TO_ASK, rated: 2 });
  });
  it('rate refuses anything but 1–5', () => {
    for (const stars of [0, 6, 2.5, NaN]) expect(() => rate(ready(), stars)).toThrow(RangeError);
  });
  it('does not mutate its input', () => {
    const s = ready();
    countRun(s);
    rate(s, 5);
    expect(s).toEqual(ready());
  });
});

describe('rateTarget', () => {
  it('sends 4 and 5 stars to the store reviews, 1 to 3 to the form', () => {
    expect([1, 2, 3, 4, 5].map((n) => rateTarget(n, LINKS))).toEqual([
      LINKS.feedback,
      LINKS.feedback,
      LINKS.feedback,
      LINKS.reviews,
      LINKS.reviews,
    ]);
  });
  it('refuses anything but 1–5', () => {
    expect(() => rateTarget(0, LINKS)).toThrow(RangeError);
  });
});
