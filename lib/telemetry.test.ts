import { describe, it, expect, vi } from 'vitest';
import {
  ACTION_HEADER,
  VERSION_HEADER,
  EVENT_NAME,
  SEARCH_ACTIONS,
  DIRECT_ACTIONS,
  UPLOAD_ACTIONS,
  countingHeaders,
  menuAction,
  searchEventRequest,
  signalsOptOut,
  uploadAction,
} from './telemetry';

const ON = { enabled: true, version: '0.7.2' };
const OFF = { enabled: false, version: '0.7.2' };

describe('countingHeaders', () => {
  it('reports the action and the version', () => {
    expect(countingHeaders('upload_capture', ON)).toEqual({
      [ACTION_HEADER]: 'upload_capture',
      [VERSION_HEADER]: '0.7.2',
    });
  });

  it('reports nothing at all when the user opted out', () => {
    expect(countingHeaders('upload_capture', OFF)).toEqual({});
  });

  it('omits a version it could not read rather than inventing one', () => {
    expect(countingHeaders('upload_capture', { enabled: true, version: '' })).toEqual({
      [ACTION_HEADER]: 'upload_capture',
    });
  });

  // The upload still has to work and still reports its version; only the
  // attribution is missing, which is exactly what NULL in that column means.
  it('reports the version without an action when the action is unknown', () => {
    expect(countingHeaders(undefined, ON)).toEqual({ [VERSION_HEADER]: '0.7.2' });
  });
});

describe('searchEventRequest', () => {
  it('posts the allowlisted event name to the events endpoint', () => {
    const req = searchEventRequest('direct_all', ON, 'https://reverseimage.app');

    expect(req?.url).toBe('https://reverseimage.app/v1/events');
    expect(req?.init.method).toBe('POST');
    expect(req?.init.keepalive).toBe(true);
    expect(String(req?.init.body)).toBe(`name=${EVENT_NAME}`);
    expect(req?.init.headers).toMatchObject({ [ACTION_HEADER]: 'direct_all' });
  });

  it('builds nothing when the user opted out', () => {
    expect(searchEventRequest('direct_all', OFF, 'https://reverseimage.app')).toBeNull();
  });
});

describe('uploadAction', () => {
  it('passes an upload action through', () => {
    expect(uploadAction('upload_paste')).toBe('upload_paste');
  });

  // A content script injected before an update sends no action. Labelling its
  // upload anyway would invent a number; the column is meant to go NULL.
  it('reports nothing rather than guessing', () => {
    for (const value of [undefined, null, 42, 'upload_evil', 'UPLOAD_PASTE', '']) {
      expect(uploadAction(value)).toBeUndefined();
    }
  });

  // An upload is not a direct search, whatever the message claims.
  it('refuses a direct action on an upload message', () => {
    expect(uploadAction('direct_google')).toBeUndefined();
  });
});

describe('menuAction', () => {
  it('maps the all-engines item and each engine item', () => {
    expect(menuAction('ris-all', 'ris-all')).toBe('direct_all');
    expect(menuAction('google', 'ris-all')).toBe('direct_google');
    expect(menuAction('tineye', 'ris-all')).toBe('direct_tineye');
  });

  it('falls back to all-engines for a menu id it does not know', () => {
    expect(menuAction('ris-something-new', 'ris-all')).toBe('direct_all');
  });
});

describe('signalsOptOut', () => {
  // Firefox's background is an event page with a navigator; Chrome's service
  // worker has no DNT to read. Absent is not consent, it just means the browser
  // never offered the signal here.
  it('honours Do Not Track and Global Privacy Control where they exist', () => {
    expect(signalsOptOut({ doNotTrack: '1' })).toBe(true);
    expect(signalsOptOut({ doNotTrack: 'yes' })).toBe(true);
    expect(signalsOptOut({ globalPrivacyControl: true })).toBe(true);
  });

  it('is false when the signals are absent or unset', () => {
    expect(signalsOptOut({})).toBe(false);
    expect(signalsOptOut({ doNotTrack: '0', globalPrivacyControl: false })).toBe(false);
    expect(signalsOptOut(undefined)).toBe(false);
  });
});

describe('the action lists', () => {
  it('covers all eleven actions, split by path', () => {
    expect(SEARCH_ACTIONS).toHaveLength(11);
    expect(DIRECT_ACTIONS).toHaveLength(6);
    expect(UPLOAD_ACTIONS).toHaveLength(5);
  });
});

describe('uploadHeaders', () => {
  it('returns no headers rather than throwing when settings cannot be read', async () => {
    vi.doMock('./settings', () => ({ getSettings: async () => { throw new Error('storage gone'); } }));
    vi.doMock('wxt/browser', () => ({ browser: { runtime: { getManifest: () => ({ version: '0.7.2' }) } } }));
    vi.doMock('./config', () => ({ API_BASE: 'https://example.test' }));
    const { uploadHeaders } = await import('./telemetry-actions');

    await expect(uploadHeaders('upload_capture')).resolves.toEqual({});
  });
});
