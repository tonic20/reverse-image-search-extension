import { browser } from 'wxt/browser';
import { getSettings } from './settings';
import { API_BASE } from './config';
import {
  ReportingContext,
  SearchAction,
  countingHeaders,
  searchEventRequest,
  signalsOptOut,
} from './telemetry';

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
  const enabled = countSearches && !signalsOptOut(globalThis.navigator);
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
