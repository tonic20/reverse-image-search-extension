import { describe, it, expect } from 'vitest';
import { MSG } from './messages';
import { routeSearchMessage, SearchHandlers } from './search-router';

function spy() {
  const seen: unknown[][] = [];
  const handlers: SearchHandlers = {
    upload: (...args) => void seen.push(['upload', ...args]),
    face: (...args) => void seen.push(['face', ...args]),
    faceUrl: (...args) => void seen.push(['faceUrl', ...args]),
  };
  return { seen, handlers };
}

describe('routeSearchMessage', () => {
  it('carries the popup paste through as a paste', () => {
    const { seen, handlers } = spy();

    routeSearchMessage({ type: MSG.SEARCH_IMAGE, dataUrl: 'd', action: 'upload_paste' }, handlers);

    expect(seen).toEqual([['upload', 'd', 'upload_paste', undefined]]);
  });

  it('carries a region capture through as a capture', () => {
    const { seen, handlers } = spy();

    routeSearchMessage({ type: MSG.SEARCH_IMAGE, dataUrl: 'd', action: 'upload_capture' }, handlers);

    expect(seen[0]?.[2]).toBe('upload_capture');
  });

  // GRAB_IMAGE replies come back as SEARCH_IMAGE carrying whatever the
  // background sent out, so the menu-vs-overlay distinction has to survive the
  // round trip through the content script.
  it('preserves the menu and overlay distinction through a grab reply', () => {
    const { seen, handlers } = spy();

    routeSearchMessage({ type: MSG.SEARCH_IMAGE, dataUrl: 'd', action: 'upload_menu', engineIds: ['google'] }, handlers);
    routeSearchMessage({ type: MSG.SEARCH_IMAGE, dataUrl: 'd', action: 'upload_overlay', engineIds: ['google'] }, handlers);

    expect(seen.map((s) => s[2])).toEqual(['upload_menu', 'upload_overlay']);
  });

  it('routes a face crop as a face search', () => {
    const { seen, handlers } = spy();

    routeSearchMessage({ type: MSG.SEARCH_FACE, dataUrl: 'd', action: 'upload_face' }, handlers);

    expect(seen).toEqual([['face', 'd', 'upload_face']]);
  });

  // The legacy case: a content script injected before this update names nothing.
  // The search must still run, and the attribution must be absent, not invented.
  it('routes a message with no action, reporting none', () => {
    const { seen, handlers } = spy();

    routeSearchMessage({ type: MSG.SEARCH_IMAGE, dataUrl: 'd' }, handlers);

    expect(seen).toEqual([['upload', 'd', undefined, undefined]]);
  });

  it('refuses a direct action on an upload message', () => {
    const { seen, handlers } = spy();

    routeSearchMessage({ type: MSG.SEARCH_IMAGE, dataUrl: 'd', action: 'direct_google' }, handlers);

    expect(seen[0]?.[2]).toBeUndefined();
  });

  it('ignores a message that is not a search', () => {
    const { seen, handlers } = spy();

    expect(routeSearchMessage({ type: MSG.CAPTURE_VIEWPORT }, handlers)).toBe(false);
    expect(seen).toEqual([]);
  });
});
