/**
 * Pure policy core for the in-product review prompt.
 *
 * No browser imports live here on purpose: this module is unit-tested under
 * vitest/happy-dom, which has no WXT browser mock. All browser I/O lives in
 * ./review-prompt-actions.ts.
 */

export interface ReviewPromptState {
  /** Successful search actions so far (not per engine tab). */
  successCount: number;
  /** Epoch ms the prompt was last shown; null = never shown. */
  lastPromptAt: number | null;
  /** User clicked "Leave a review" — terminal, never prompt again. */
  reviewed: boolean;
}

export const DEFAULT_STATE: ReviewPromptState = {
  successCount: 0,
  lastPromptAt: null,
  reviewed: false,
};

export const THRESHOLD = 3;
export const DEFER_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Whether to show the prompt now, given the stored state and current time.
 *
 * `canReview` is passed in rather than read here so this module stays free of
 * browser/build imports (see the file header). It is false on any build whose
 * store we haven't published to — see ./store-review-url.ts. Without it there
 * is nowhere to send the user, so asking is worse than staying quiet.
 */
export function shouldPrompt(
  state: ReviewPromptState,
  now: number,
  canReview: boolean,
): boolean {
  if (!canReview) return false;
  if (state.reviewed) return false;
  if (state.successCount < THRESHOLD) return false;
  if (state.lastPromptAt !== null && now - state.lastPromptAt < DEFER_MS) return false;
  return true;
}

/** +1 successful search, unless the user has already reviewed (then stop counting). */
export function incrementSuccess(state: ReviewPromptState): ReviewPromptState {
  if (state.reviewed) return state;
  return { ...state, successCount: state.successCount + 1 };
}

/** Record that the prompt was shown now (also serves as a 90-day defer). */
export function withPromptShown(state: ReviewPromptState, now: number): ReviewPromptState {
  return { ...state, lastPromptAt: now };
}

/** Mark the user as having reviewed — terminal. */
export function withReviewed(state: ReviewPromptState): ReviewPromptState {
  return { ...state, reviewed: true };
}
