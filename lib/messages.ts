// Message types passed between popup ⇄ background ⇄ content script.
export const MSG = {
  /** popup/context-menu → content script: begin the region-capture overlay. */
  START_CAPTURE: 'ris:start-capture',
  /** content script → background: capture the visible tab; responds { dataUrl }. */
  CAPTURE_VIEWPORT: 'ris:capture-viewport',
  /** content script/popup → background: reverse-search a raw image (data URL). */
  SEARCH_IMAGE: 'ris:search-image',
  /** background → content script: grab an image's bytes in-page (blob:/data:/
   *  cookie-gated/CORS-blocked src) and reply via SEARCH_IMAGE. */
  GRAB_IMAGE: 'ris:grab-image',
  /** background → content script: which image was under the last right-click?
   *  Content replies { srcUrl: string | null }. Sent only when Chrome gave no
   *  info.srcUrl (overlay sites like Instagram). On null, content shows a toast. */
  RESOLVE_IMAGE: 'ris:resolve-image',

  // ── Face search ─────────────────────────────────────────────────────────
  /** background → content script: open the crop-assist overlay on an image
   *  (carries a clean data URL, or a srcUrl for the content script to grab). */
  START_FACE_CROP: 'ris:start-face-crop',
  /** popup → content script: region-capture a face from the visible tab. */
  START_FACE_CAPTURE: 'ris:start-face-capture',
  /** content script/popup → background: upload-search a face crop (data URL),
   *  face-optimized engine order (Yandex first). */
  SEARCH_FACE: 'ris:search-face',
  /** content script → background: face-search a public image URL directly
   *  (fallback when clean bytes to crop couldn't be obtained). */
  SEARCH_FACE_URL: 'ris:search-face-url',
} as const;

export interface CaptureViewportResponse {
  dataUrl: string | null;
}
