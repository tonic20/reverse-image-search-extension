import { browser } from 'wxt/browser';
import { RatingState, countRun, normalizeRating, rate } from './rating';

const KEY = 'rating';
/** The review card's state before the stars (0.7.0–0.9.x); ignored once a rating is saved. */
const LEGACY_KEY = 'reviewPrompt';

/** Read the rating state from storage.local, seeded from the old review card on first read. */
export async function getRating(): Promise<RatingState> {
  const stored = await browser.storage.local.get([KEY, LEGACY_KEY]);
  return normalizeRating(stored[KEY], stored[LEGACY_KEY]);
}

async function writeRating(next: RatingState): Promise<void> {
  await browser.storage.local.set({ [KEY]: next });
}

/** Count one successful search action (fire-and-forget from the search path). */
export async function recordSuccessfulSearch(): Promise<void> {
  const now = await getRating();
  const next = countRun(now);
  if (next !== now) await writeRating(next);
}

/**
 * A star was clicked: record it, then open where it leads.
 *
 * In that order on purpose. The new tab takes focus and the popup closes with
 * it, so a write started after tabs.create may never finish, and the stars
 * would ask again next time.
 */
export async function onRate(stars: number, url: string): Promise<void> {
  await writeRating(rate(await getRating(), stars));
  await browser.tabs.create({ url });
}
