// Message types passed between popup ⇄ background ⇄ content script.
export const MSG = {
  /** popup/context-menu → content script: begin the region-capture overlay. */
  START_CAPTURE: 'ris:start-capture',
  /** content script → background: capture the visible tab; responds { dataUrl }. */
  CAPTURE_VIEWPORT: 'ris:capture-viewport',
  /** content script/popup → background: reverse-search a raw image (data URL). */
  SEARCH_IMAGE: 'ris:search-image',
} as const;

export interface CaptureViewportResponse {
  dataUrl: string | null;
}
