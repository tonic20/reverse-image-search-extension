// The "actual search": we don't match images ourselves — we hand the image URL
// to an existing engine and open its results page. These redirect endpoints are
// UNDOCUMENTED and can change; keep this list hot-updatable (see /v1/config).
// Verified current: 2026-07 (Bing switched to the searchbyimage endpoint).
//
// DESKTOP ONLY for Bing: `searchbyimage` returns 404 to mobile user-agents
// (verified 2026-08-14). Firefox for Android hits this today.
//
// The marketing site keeps its own copy in backend/app/models/search_engine.rb.
// The published mirror forbids reading outside extension/ (AGENTS.md), so the
// duplication is structural — change both together, and run
// `bin/rails engines:smoke` in backend/ to check them.

export interface Engine {
  id: string;
  name: string;
  /** Build a results URL from a PUBLICLY FETCHABLE image URL. */
  byUrl: (imageUrl: string) => string;
}

const enc = encodeURIComponent;

export const ENGINES: Record<string, Engine> = {
  google: {
    id: 'google',
    name: 'Google Lens',
    byUrl: (u) => `https://lens.google.com/uploadbyurl?url=${enc(u)}`,
  },
  bing: {
    id: 'bing',
    name: 'Bing Visual',
    // The old `search?q=imgurl:…&iss=sbi` syntax now bounces to Bing's drop-image
    // landing (FORM=SBIRDI). The `searchbyimage` endpoint with `cbir=sbi&imgurl=`
    // still returns results. Verified 2026-07.
    byUrl: (u) => `https://www.bing.com/images/searchbyimage?cbir=sbi&imgurl=${enc(u)}`,
  },
  yandex: {
    id: 'yandex',
    name: 'Yandex',
    byUrl: (u) => `https://yandex.com/images/search?rpt=imageview&url=${enc(u)}`,
  },
  tineye: {
    id: 'tineye',
    name: 'TinEye',
    byUrl: (u) => `https://tineye.com/search?url=${enc(u)}`,
  },
};

/** Default enabled engines, in display/open order. User can reorder/toggle. */
export const DEFAULT_ENGINE_ORDER: string[] = ['google', 'yandex', 'bing', 'tineye'];

/**
 * Face-search order. Yandex first — its similarity model is the strongest for
 * people — then Google Lens + Bing. TinEye is excluded: it does exact-duplicate
 * matching, which is useless for finding a *person*.
 */
export const FACE_ENGINE_ORDER: string[] = ['yandex', 'google', 'bing'];

export function engineList(order: string[] = DEFAULT_ENGINE_ORDER): Engine[] {
  return order.map((id) => ENGINES[id]).filter(Boolean);
}
