/**
 * Pure core of the popup's "Rate us" stars.
 *
 * 4 and 5 stars open this store's review page, 1 to 3 the feedback form, so a
 * complaint reaches the developer instead of the store. The stars show after
 * RUNS_TO_ASK successful searches, and never again once any star is clicked.
 * Nothing is promised for a rating: store policies forbid rewarding reviews.
 *
 * No browser imports live here on purpose: this module is unit-tested under
 * vitest/happy-dom, which has no WXT browser mock. All browser I/O lives in
 * ./rating-actions.ts.
 */

/** Successful searches (not per engine tab) before the stars show. */
export const RUNS_TO_ASK = 3;

/** The feedback form: one question, no name or email. */
export const FEEDBACK_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSfZEvLnywBj_woO7hRoThg6HWwfbHaDpennf325NruQN-5NOQ/viewform';

export interface RatingLinks {
  /** This build's store review page; null where we haven't published (./store-review-url.ts). */
  reviews: string | null;
  feedback: string;
}

export interface RatingState {
  /** Successful searches so far. */
  runs: number;
  /** The stars clicked, 1–5; 0 = not rated yet. */
  rated: number;
}

const isStars = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 5;
const isCount = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0;
const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/**
 * The state from storage; anything broken is a new user.
 *
 * `legacy` is the review card's state (`reviewPrompt`, 0.7.0–0.9.x), read only
 * when no rating was saved yet: its search count carries over, and "Leave a
 * review" counts as rated. Which star that was is unknown, so it reads as 5.
 */
export function normalizeRating(saved: unknown, legacy?: unknown): RatingState {
  if (saved === undefined) {
    const old = asRecord(legacy);
    if (old) {
      return { runs: isCount(old.successCount) ? old.successCount : 0, rated: old.reviewed === true ? 5 : 0 };
    }
  }
  const s = asRecord(saved) ?? {};
  return { runs: isCount(s.runs) ? s.runs : 0, rated: isStars(s.rated) ? s.rated : 0 };
}

/** +1 successful search; once rated there is nothing left to count. */
export const countRun = (s: RatingState): RatingState => (s.rated ? s : { ...s, runs: s.runs + 1 });

export function rate(s: RatingState, stars: number): RatingState {
  if (!isStars(stars)) throw new RangeError(`not a rating: ${stars}`);
  return { ...s, rated: stars };
}

/** Whether the stars show: enough searches, not rated, and both pages to send to exist. */
export const shouldAsk = (s: RatingState, links: RatingLinks): boolean =>
  !s.rated && s.runs >= RUNS_TO_ASK && !!links.reviews && !!links.feedback;

/** Where a click on `stars` goes. */
export function rateTarget(stars: number, links: RatingLinks): string {
  if (!isStars(stars)) throw new RangeError(`not a rating: ${stars}`);
  return (stars >= 4 ? links.reviews : links.feedback) ?? '';
}
