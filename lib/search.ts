import { browser } from 'wxt/browser';
import { ENGINES } from './engines';
import { getSettings } from './settings';
import { API_BASE } from './config';

/** Phase 0.1 path: image already has a public URL → open each engine's results. */
export function openUrlSearches(
  imageUrl: string,
  engineIds: string[],
  openInBackground = true,
): void {
  engineIds.forEach((id, i) => {
    const engine = ENGINES[id];
    if (!engine) return;
    void browser.tabs.create({
      url: engine.byUrl(imageUrl),
      active: i === 0 ? true : !openInBackground,
    });
  });
}

/**
 * Phase 0.3 path: a raw image (pasted, captured, or byte-grabbed) with no
 * public URL.
 *
 * We ask our backend for presigned S3 URLs (the bucket stays fully private),
 * PUT the bytes straight to S3, then run every enabled engine on the temporary
 * presigned GET URL — so captured/pasted/Instagram images search across ALL
 * engines, not just Lens. See SPEC §7.
 */
export async function searchImageBlob(blob: Blob): Promise<void> {
  try {
    if (blob.size === 0) throw new Error('empty image blob');
    const contentType = blob.type || 'image/png';

    // 1) Presign (bucket is private; nothing is ever made public). The backend
    //    returns a presigned POST with an S3-enforced size cap.
    const presignRes = await fetch(`${API_BASE}/v1/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_type: contentType }),
    });
    if (!presignRes.ok) throw new Error(`presign failed: ${presignRes.status}`);
    const { upload, get_url, max_bytes } = (await presignRes.json()) as {
      upload: { url: string; fields: Record<string, string> };
      get_url: string;
      max_bytes?: number;
    };

    // Friendly early reject (S3 would 400 EntityTooLarge anyway).
    if (max_bytes && blob.size > max_bytes) {
      throw new Error(`image too large: ${blob.size} > ${max_bytes}`);
    }

    // 2) POST the bytes straight to S3 (they never touch our server). The `file`
    //    field MUST come last, after all signed policy fields. This runs in the
    //    background worker, whose host permissions bypass page CORS.
    const form = new FormData();
    for (const [k, v] of Object.entries(upload.fields)) form.append(k, v);
    form.append('file', blob, 'image');
    const putRes = await fetch(upload.url, { method: 'POST', body: form });
    if (!putRes.ok) throw new Error(`s3 upload failed: ${putRes.status}`);

    // 3) Run every enabled engine on the short-lived presigned GET URL.
    const { engineOrder, openInBackground } = await getSettings();
    openUrlSearches(get_url, engineOrder, openInBackground);
  } catch (err) {
    console.error('[RIS] upload search failed:', err);
    // Fallback so the user isn't stranded.
    await browser.tabs.create({ url: 'https://lens.google.com/' });
  }
}

/** Convenience wrapper: search a raw image given as a data: URL. */
export async function searchImageByUpload(dataUrl: string): Promise<void> {
  const blob = await (await fetch(dataUrl)).blob();
  return searchImageBlob(blob);
}

/**
 * Phase 0.3b: grab an image's bytes from the background service worker.
 *
 * The worker holds `<all_urls>` host permissions, so its fetch is NOT subject
 * to page CORS — it can read the bytes of most CDN images (Instagram/Pinterest
 * public CDNs, hotlink-protected images) that the plain redirect method can't
 * hand to a search engine. Returns null for the cases only the page can reach
 * (`blob:`/`data:` are page-scoped; some images need the page's session
 * cookies) so the caller can fall back to a content-script grab.
 */
export async function grabImageBlobFromBackground(srcUrl: string): Promise<Blob | null> {
  if (srcUrl.startsWith('blob:') || srcUrl.startsWith('data:')) return null;
  try {
    const res = await fetch(srcUrl, { credentials: 'omit' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size === 0 || !blob.type.startsWith('image/')) return null;
    return blob;
  } catch {
    return null;
  }
}
