import { browser } from 'wxt/browser';
import { ENGINES } from './engines';

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
 * Phase 0.2 path: a raw image (pasted or captured) that has no public URL.
 * Google Lens accepts a direct multipart upload and 303-redirects to its
 * results page, so we can search without a backend.
 *
 * Phase 0.3 (SPEC §7) will instead upload the bytes to S3 to mint a public
 * URL, then run ALL engines via openUrlSearches — the two paths converge.
 */
export async function searchImageByUpload(dataUrl: string): Promise<void> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const form = new FormData();
    form.append('encoded_image', blob, 'image.png');

    const res = await fetch('https://lens.google.com/v3/upload', {
      method: 'POST',
      body: form,
    });

    // Following redirects yields the Lens results page URL.
    const url = res.url && res.url.includes('lens.google.com') ? res.url : 'https://lens.google.com/';
    await browser.tabs.create({ url });
  } catch (err) {
    console.error('[RIS] upload search failed:', err);
    // Fallback: open Lens so the user can drop the image manually.
    await browser.tabs.create({ url: 'https://lens.google.com/' });
  }
}
