import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STATE,
  DEFER_MS,
  THRESHOLD,
  ReviewPromptState,
  shouldPrompt,
  incrementSuccess,
  withPromptShown,
  withReviewed,
} from './review-prompt';

const NOW = 1_700_000_000_000; // fixed epoch ms for deterministic tests
const state = (p: Partial<ReviewPromptState> = {}): ReviewPromptState => ({ ...DEFAULT_STATE, ...p });

describe('shouldPrompt', () => {
  it('is false below the threshold', () => {
    expect(shouldPrompt(state({ successCount: THRESHOLD - 1 }), NOW, true)).toBe(false);
  });
  it('is true at the threshold when never prompted', () => {
    expect(shouldPrompt(state({ successCount: THRESHOLD }), NOW, true)).toBe(true);
  });
  it('is false once reviewed, regardless of count', () => {
    expect(shouldPrompt(state({ successCount: THRESHOLD + 10, reviewed: true }), NOW, true)).toBe(false);
  });
  it('is false within the defer window', () => {
    expect(shouldPrompt(state({ successCount: THRESHOLD, lastPromptAt: NOW - (DEFER_MS - 1) }), NOW, true)).toBe(false);
  });
  it('is true after the defer window elapses', () => {
    expect(shouldPrompt(state({ successCount: THRESHOLD, lastPromptAt: NOW - DEFER_MS }), NOW, true)).toBe(true);
  });

  // Without a store review URL there is nowhere to send the user, so the card
  // must never render — otherwise Firefox users get pointed at the Chrome Web
  // Store, which is the bug this parameter exists to prevent.
  it('is false without a review URL, even when otherwise eligible', () => {
    expect(shouldPrompt(state({ successCount: THRESHOLD }), NOW, false)).toBe(false);
  });
  it('is false without a review URL after the defer window too', () => {
    expect(
      shouldPrompt(state({ successCount: THRESHOLD + 99, lastPromptAt: NOW - DEFER_MS }), NOW, false),
    ).toBe(false);
  });
});

describe('pure transitions', () => {
  it('incrementSuccess adds one', () => {
    expect(incrementSuccess(state({ successCount: 2 })).successCount).toBe(3);
  });
  it('incrementSuccess is a no-op once reviewed', () => {
    const s = state({ successCount: 5, reviewed: true });
    expect(incrementSuccess(s)).toEqual(s);
  });
  it('withPromptShown stamps lastPromptAt', () => {
    expect(withPromptShown(state(), NOW).lastPromptAt).toBe(NOW);
  });
  it('withReviewed sets reviewed true', () => {
    expect(withReviewed(state()).reviewed).toBe(true);
  });
  it('transitions do not mutate the input', () => {
    const s = state({ successCount: 1 });
    incrementSuccess(s);
    expect(s.successCount).toBe(1);
  });
});
