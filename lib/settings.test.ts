import { describe, it, expect, vi, beforeEach } from 'vitest';

const store: Record<string, unknown> = {};

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      sync: {
        get: async (keys: string[]) =>
          Object.fromEntries(keys.filter((k) => k in store).map((k) => [k, store[k]])),
        set: async (patch: Record<string, unknown>) => Object.assign(store, patch),
      },
    },
  },
}));

const { getSettings, setSettings } = await import('./settings');

describe('countSearches', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
  });

  it('counts searches unless the user turns it off', async () => {
    expect((await getSettings()).countSearches).toBe(true);
  });

  it('remembers being turned off', async () => {
    await setSettings({ countSearches: false });
    expect((await getSettings()).countSearches).toBe(false);
  });
});
