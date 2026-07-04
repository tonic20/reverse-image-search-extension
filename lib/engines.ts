// The "actual search": we don't match images ourselves — we hand the image URL
// to an existing engine and open its results page. These redirect endpoints are
// UNDOCUMENTED and can change; keep this list hot-updatable (see /v1/config).
// Verified current: 2026-07.

export interface Engine {
  id: string;
  name: string;
  /** Best-at hint, shown in UI. */
  note?: string;
  /** Build a results URL from a PUBLICLY FETCHABLE image URL. */
  byUrl: (imageUrl: string) => string;
}

const enc = encodeURIComponent;

export const ENGINES: Record<string, Engine> = {
  google: {
    id: 'google',
    name: 'Google Lens',
    note: 'Similar images, products, general',
    byUrl: (u) => `https://lens.google.com/uploadbyurl?url=${enc(u)}`,
  },
  bing: {
    id: 'bing',
    name: 'Bing Visual',
    note: 'General + good OCR',
    byUrl: (u) =>
      `https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:${enc(u)}`,
  },
  yandex: {
    id: 'yandex',
    name: 'Yandex',
    note: 'Best for faces / people',
    byUrl: (u) => `https://yandex.com/images/search?rpt=imageview&url=${enc(u)}`,
  },
  tineye: {
    id: 'tineye',
    name: 'TinEye',
    note: 'Exact matches / where it first appeared',
    byUrl: (u) => `https://tineye.com/search?url=${enc(u)}`,
  },
};

/** Default enabled engines, in display/open order. User can reorder/toggle. */
export const DEFAULT_ENGINE_ORDER: string[] = ['google', 'yandex', 'bing', 'tineye'];

export function engineList(order: string[] = DEFAULT_ENGINE_ORDER): Engine[] {
  return order.map((id) => ENGINES[id]).filter(Boolean);
}
