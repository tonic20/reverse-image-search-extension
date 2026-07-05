import { browser } from 'wxt/browser';
import { MSG, type CaptureViewportResponse } from '../lib/messages';

// WXT auto-imports `defineContentScript`.
export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    browser.runtime.onMessage.addListener((message) => {
      const msg = message as { type?: string; srcUrl?: string };
      if (msg?.type === MSG.START_CAPTURE) startCapture();
      else if (msg?.type === MSG.GRAB_IMAGE && msg.srcUrl) void grabImage(msg.srcUrl);
    });
  },
});

let active = false;

/**
 * Phase 0.3b — grab an image's bytes from inside the page.
 *
 * The background worker delegates here only when it couldn't fetch the bytes
 * itself: `blob:` URLs are page-scoped, and some images need the page's session
 * cookies / same-origin referer. An in-page fetch has both. If that fails
 * (cross-origin without CORS), fall back to drawing the live <img> element to a
 * canvas — which works for same-origin and CORS-enabled images.
 */
async function grabImage(srcUrl: string) {
  try {
    const dataUrl = await fetchAsDataUrl(srcUrl).catch(() => elementToDataUrl(srcUrl));
    if (!dataUrl) {
      console.warn('[RIS] could not grab image bytes in-page:', srcUrl);
      return;
    }
    await browser.runtime.sendMessage({ type: MSG.SEARCH_IMAGE, dataUrl });
  } catch (err) {
    console.error('[RIS] in-page image grab failed:', err);
  }
}

async function fetchAsDataUrl(srcUrl: string): Promise<string> {
  const res = await fetch(srcUrl, { credentials: 'include' });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const blob = await res.blob();
  if (blob.size === 0 || !blob.type.startsWith('image/')) throw new Error('not an image');
  return await blobToDataUrl(blob);
}

/** Fallback: find the matching <img> in the DOM and rasterize it. */
function elementToDataUrl(srcUrl: string): string {
  const img = Array.from(document.images).find(
    (el) => el.currentSrc === srcUrl || el.src === srcUrl,
  );
  if (!img || !img.complete || img.naturalWidth === 0) throw new Error('image element not found');
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(img, 0, 0);
  // Throws SecurityError if the canvas is tainted (cross-origin, no CORS).
  return canvas.toDataURL('image/png');
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

function startCapture() {
  if (active) return;
  active = true;

  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    cursor: 'crosshair',
    background: 'rgba(0,0,0,0.25)',
  });

  const box = document.createElement('div');
  Object.assign(box.style, {
    position: 'fixed',
    border: '2px solid #4f46e5',
    background: 'rgba(79,70,229,0.15)',
    display: 'none',
    pointerEvents: 'none',
  });
  overlay.appendChild(box);

  const hint = document.createElement('div');
  hint.textContent = 'Drag to select an area · Esc to cancel';
  Object.assign(hint.style, {
    position: 'fixed',
    top: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#111827',
    color: '#fff',
    font: '12px system-ui, sans-serif',
    padding: '6px 10px',
    borderRadius: '8px',
    pointerEvents: 'none',
  });
  overlay.appendChild(hint);

  document.documentElement.appendChild(overlay);

  let startX = 0;
  let startY = 0;
  let dragging = false;

  const rectOf = (e: MouseEvent) => ({
    x: Math.min(startX, e.clientX),
    y: Math.min(startY, e.clientY),
    w: Math.abs(e.clientX - startX),
    h: Math.abs(e.clientY - startY),
  });

  const onDown = (e: MouseEvent) => {
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    box.style.display = 'block';
    draw(e);
  };
  const onMove = (e: MouseEvent) => {
    if (dragging) draw(e);
  };
  const draw = (e: MouseEvent) => {
    const r = rectOf(e);
    box.style.left = `${r.x}px`;
    box.style.top = `${r.y}px`;
    box.style.width = `${r.w}px`;
    box.style.height = `${r.h}px`;
  };
  const onUp = (e: MouseEvent) => {
    if (!dragging) return;
    dragging = false;
    const r = rectOf(e);
    cleanup();
    if (r.w < 8 || r.h < 8) {
      active = false;
      return;
    }
    void finish(r.x, r.y, r.w, r.h);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      cleanup();
      active = false;
    }
  };

  function cleanup() {
    overlay.removeEventListener('mousedown', onDown);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('keydown', onKey);
    overlay.remove();
  }

  overlay.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  window.addEventListener('keydown', onKey);
}

async function finish(x: number, y: number, w: number, h: number) {
  try {
    // Overlay is already removed; wait two frames so the screenshot is clean.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));

    const resp = (await browser.runtime.sendMessage({
      type: MSG.CAPTURE_VIEWPORT,
    })) as CaptureViewportResponse;

    if (!resp?.dataUrl) return;
    const cropped = await cropDataUrl(resp.dataUrl, x, y, w, h);
    await browser.runtime.sendMessage({ type: MSG.SEARCH_IMAGE, dataUrl: cropped });
  } catch (err) {
    console.error('[RIS] region capture failed:', err);
  } finally {
    active = false;
  }
}

function cropDataUrl(dataUrl: string, x: number, y: number, w: number, h: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // captureVisibleTab returns device pixels; selection is in CSS px.
      const dpr = window.devicePixelRatio || 1;
      const cw = Math.round(w * dpr);
      const ch = Math.round(h * dpr);
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('no 2d context'));
        return;
      }
      ctx.drawImage(img, Math.round(x * dpr), Math.round(y * dpr), cw, ch, 0, 0, cw, ch);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('screenshot decode failed'));
    img.src = dataUrl;
  });
}
