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
  const stored = await chrome.storage.sync.get(DEFAULTS);
  return { ...DEFAULTS, ...stored } as Settings;
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  await chrome.storage.sync.set(patch);
}
