import { browser } from 'wxt/browser';
import { DEFAULT_ENGINE_ORDER } from './engines';

export interface Settings {
  /** Enabled engine ids, in open order. */
  engineOrder: string[];
  /** Open the extra ("All engines") tabs in the background. */
  openInBackground: boolean;
  /**
   * Report that a search happened — a label and a timestamp, never the image or
   * its address. Off suppresses the beacon AND the version header, so opting
   * out is total rather than partial.
   */
  countSearches: boolean;
}

const DEFAULTS: Settings = {
  engineOrder: DEFAULT_ENGINE_ORDER,
  openInBackground: true,
  countSearches: true,
};

export async function getSettings(): Promise<Settings> {
  const stored = (await browser.storage.sync.get([
    'engineOrder',
    'openInBackground',
    'countSearches',
  ])) as Partial<Settings>;
  return { ...DEFAULTS, ...stored };
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  await browser.storage.sync.set(patch as Record<string, unknown>);
}
