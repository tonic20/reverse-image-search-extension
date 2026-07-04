import { browser } from 'wxt/browser';
import { DEFAULT_ENGINE_ORDER } from './engines';

export interface Settings {
  /** Enabled engine ids, in open order. */
  engineOrder: string[];
  /** Open the extra ("All engines") tabs in the background. */
  openInBackground: boolean;
}

const DEFAULTS: Settings = {
  engineOrder: DEFAULT_ENGINE_ORDER,
  openInBackground: true,
};

export async function getSettings(): Promise<Settings> {
  const stored = (await browser.storage.sync.get([
    'engineOrder',
    'openInBackground',
  ])) as Partial<Settings>;
  return { ...DEFAULTS, ...stored };
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  await browser.storage.sync.set(patch as Record<string, unknown>);
}
