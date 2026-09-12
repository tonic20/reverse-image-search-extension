import { browser } from 'wxt/browser';
import { getSettings } from './settings';
import { API_BASE } from './config';
import {
  ReportingContext,
  SearchAction,
  countingEnabled,
  countingHeaders,
  searchEventRequest,
  signalsOptOut,
} from './telemetry';

/** The AMO data type our counting falls under. Must match wxt.config.ts. */
const DATA_COLLECTION = 'technicalAndInteraction';

/**
 * Firefox's own answer to whether we may count, or null where the browser has
 * no opinion to give.
 *
 * The presence of the `data_collection` key in getAll() is Mozilla's documented
 * feature detection for the built-in consent experience, so one call both
 * detects the feature and reads the answer. Detecting the capability rather
 * than the browser is deliberate: Firefox below 140 has no such permission and
 * must keep using our checkbox.
 *
 * Never throws. A browser that rejects the call is a browser with no opinion.
 */
async function dataCollectionConsent(): Promise<boolean | null> {
  try {
    const all = (await browser.permissions.getAll()) as { data_collection?: string[] };
    if (!all || !('data_collection' in all)) return null;
    return (all.data_collection ?? []).includes(DATA_COLLECTION);
  } catch {
    return null;
  }
}

/** True when the browser owns this decision, so the popup must not offer it. */
export async function browserOwnsDataConsent(): Promise<boolean> {
  return (await dataCollectionConsent()) !== null;
}

/** This build's version, or '' if the manifest can't be read. */
function version(): string {
  try {
    return browser.runtime.getManifest().version ?? '';
  } catch {
    return '';
  }
}

/**
 * One place both the beacon and the headers read, so an opt-out of either kind
 * stops both. The browser signal is checked here rather than in the beacon for
 * exactly that reason: Do Not Track must not leave the version header running.
 */
export async function reportingContext(): Promise<ReportingContext> {
  const { countSearches } = await getSettings();
  const enabled = countingEnabled(
    countSearches,
    await dataCollectionConsent(),
    signalsOptOut(globalThis.navigator),
  );
  return { enabled, version: version() };
}

/**
 * Headers to add to a request we are already making. Empty when opted out.
 *
 * Never throws. This runs inside the presign call, so an exception would fall
 * into searchImageBlob's catch and send the user to the Lens fallback tab
 * instead of their results — counting must cost a count, never a search.
 *
 * This does not make search independent of settings: searchImageBlob reads
 * engineOrder from the same store afterwards and always has. It only ensures
 * counting adds no new failure mode on top of that one.
 */
export async function uploadHeaders(
  action: SearchAction | undefined,
): Promise<Record<string, string>> {
  try {
    return countingHeaders(action, await reportingContext());
  } catch {
    return {};
  }
}

/**
 * Count one direct search — the path that otherwise contacts nothing.
 *
 * Fire-and-forget, and failures are swallowed on purpose: the user came here to
 * search, not to deliver a count.
 */
export async function countDirectSearch(action: SearchAction): Promise<void> {
  try {
    const req = searchEventRequest(action, await reportingContext(), API_BASE);
    if (!req) return;
    await fetch(req.url, req.init);
  } catch {
    // Nothing to do and nothing to tell the user.
  }
}
