import { browser } from 'wxt/browser';
import {
  DEFAULT_STATE,
  ReviewPromptState,
  incrementSuccess,
  withPromptShown,
  withReviewed,
} from './review-prompt';

const KEY = 'reviewPrompt';
const CWS_REVIEW_URL =
  'https://chromewebstore.google.com/detail/jmfdmdfnhkgbnpnpignhjcokpllbnhpp/reviews';
const SUPPORT_URL = 'https://reverseimage.app/support';

/** Read the prompt state from storage.local, merged over defaults. */
export async function getState(): Promise<ReviewPromptState> {
  const stored = (await browser.storage.local.get(KEY))[KEY] as
    | Partial<ReviewPromptState>
    | undefined;
  return { ...DEFAULT_STATE, ...stored };
}

async function writeState(next: ReviewPromptState): Promise<void> {
  await browser.storage.local.set({ [KEY]: next });
}

/** Count one successful search action (fire-and-forget from the search path). */
export async function recordSuccessfulSearch(): Promise<void> {
  await writeState(incrementSuccess(await getState()));
}

/** Stamp the prompt as shown now (renders => 90-day defer even if just closed). */
export async function markPromptShown(now: number): Promise<void> {
  await writeState(withPromptShown(await getState(), now));
}

/** "Leave a review": open the CWS reviews page and never prompt again. */
export async function onReview(): Promise<void> {
  await browser.tabs.create({ url: CWS_REVIEW_URL });
  await writeState(withReviewed(await getState()));
}

/** "Send feedback instead": open /support privately (already deferred on render). */
export async function onFeedback(): Promise<void> {
  await browser.tabs.create({ url: SUPPORT_URL });
}

/** "Not now": nothing beyond the defer already stamped by markPromptShown. */
export function onLater(): void {
  // Intentionally empty — kept for symmetry and a clear call site in the popup.
}
