import { describe, it, expect, vi, beforeEach } from 'vitest';

const created: string[] = [];
const calls: { url: string; init: RequestInit }[] = [];
const SETTINGS = { engineOrder: ['google'], openInBackground: true, countSearches: true };
// A stable mock, declared once. Per-test behaviour is set through this fn, never
// by re-mocking the module later: search.ts is imported below, and a vi.doMock
// after that point does not replace a dependency the module already holds.
const getSettings = vi.fn(async () => SETTINGS as Record<string, unknown>);

vi.mock('wxt/browser', () => ({
  browser: {
    tabs: { create: async (opts: { url: string }) => void created.push(opts.url) },
    runtime: { getManifest: () => ({ version: '0.7.2' }) },
    storage: { local: { get: async () => ({}), set: async () => {} } },
  },
}));
vi.mock('./settings', () => ({ getSettings: () => getSettings() }));
vi.mock('./config', () => ({ API_BASE: 'https://example.test' }));

const { searchImageBlob } = await import('./search');
const { ACTION_HEADER, VERSION_HEADER } = await import('./telemetry');
const { ENGINES } = await import('./engines');

/** What search.ts opens when an upload search fails outright. */
const FALLBACK_URL = 'https://lens.google.com/';

function headersOf(index: number): Record<string, string> {
  return (calls[index].init.headers ?? {}) as Record<string, string>;
}

beforeEach(() => {
  created.length = 0;
  calls.length = 0;
  getSettings.mockReset();
  getSettings.mockResolvedValue(SETTINGS as Record<string, unknown>);
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return {
      ok: true,
      json: async () => ({ upload: { url: 'https://s3.test/', fields: {} }, get_url: 'https://s3.test/x' }),
    } as unknown as Response;
  });
});

describe('upload attribution', () => {
  it('reports the entry point and version on the presign request', async () => {
    await searchImageBlob(new Blob(['x'], { type: 'image/png' }), 'upload_capture');

    expect(calls[0].url).toBe('https://example.test/v1/uploads');
    expect(headersOf(0)).toMatchObject({ [ACTION_HEADER]: 'upload_capture', [VERSION_HEADER]: '0.7.2' });
  });

  // A content script injected before the update sends no action. The upload
  // must still work and still report its version; only the label is missing.
  it('reports no entry point when the caller could not name one', async () => {
    await searchImageBlob(new Blob(['x'], { type: 'image/png' }), undefined);

    expect(headersOf(0)[ACTION_HEADER]).toBeUndefined();
    expect(headersOf(0)[VERSION_HEADER]).toBe('0.7.2');
  });

  it('sends neither header when counting is off', async () => {
    getSettings.mockResolvedValue({ ...SETTINGS, countSearches: false });

    await searchImageBlob(new Blob(['x'], { type: 'image/png' }), 'upload_capture');

    expect(headersOf(0)[ACTION_HEADER]).toBeUndefined();
    expect(headersOf(0)[VERSION_HEADER]).toBeUndefined();
  });

  // An upload search is counted by its presign request. A second event would
  // double-count it.
  it('sends no event alongside an upload', async () => {
    await searchImageBlob(new Blob(['x'], { type: 'image/png' }), 'upload_paste');

    expect(calls.filter((c) => c.url.includes('/v1/events'))).toHaveLength(0);
  });

  // A failing telemetry read must cost a count, not the search. The FIRST
  // getSettings call is the one inside uploadHeaders; the second is the ordinary
  // engineOrder read that searchImageBlob has always done and that a search
  // genuinely depends on. Only the first is made to fail.
  //
  // Asserting `created` is non-empty would not prove this: the catch path opens
  // a Lens fallback tab, which also fills that array. The test has to say which
  // URL opened.
  it('completes the search when the telemetry read throws', async () => {
    getSettings.mockRejectedValueOnce(new Error('storage gone'));

    await searchImageBlob(new Blob(['x'], { type: 'image/png' }), 'upload_capture');

    expect(calls.map((c) => c.url)).toEqual(['https://example.test/v1/uploads', 'https://s3.test/']);
    // Built from the engine itself rather than pasted in: Google's success URL
    // is lens.google.com/uploadbyurl?url=… and its failure fallback is the bare
    // lens.google.com/, so the two differ by path, not host. Asserting "no URL
    // containing lens.google.com" would fail on a working search.
    expect(created).toEqual([ENGINES.google.byUrl('https://s3.test/x')]);
    expect(created).not.toContain(FALLBACK_URL);
    expect(headersOf(0)).toEqual({ 'Content-Type': 'application/json' });
  });
});
