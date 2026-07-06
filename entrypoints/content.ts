import { browser } from 'wxt/browser';
import { MSG, type CaptureViewportResponse } from '../lib/messages';
import { T } from '../lib/theme';

// WXT auto-imports `defineContentScript`.
export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    browser.runtime.onMessage.addListener((message) => {
      const msg = message as { type?: string; srcUrl?: string; dataUrl?: string };
      if (msg?.type === MSG.START_CAPTURE) startCapture(false);
      else if (msg?.type === MSG.START_FACE_CAPTURE) startCapture(true);
      else if (msg?.type === MSG.GRAB_IMAGE && msg.srcUrl) void grabImage(msg.srcUrl);
      else if (msg?.type === MSG.START_FACE_CROP) void startFaceCrop(msg.dataUrl, msg.srcUrl);
    });
  },
});

let active = false;

/**
 * Grab an image's bytes from inside the page.
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

function startCapture(faceMode = false) {
  if (active) return;
  active = true;

  ensureOverlayStyles();
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    cursor: 'crosshair',
    background: 'rgba(15,23,42,0.28)',
  });

  const box = document.createElement('div');
  Object.assign(box.style, {
    position: 'fixed',
    border: `2px solid ${T.brand[600]}`,
    borderRadius: '6px',
    background: 'transparent',
    boxShadow: '0 0 0 9999px rgba(15,23,42,0.28)',
    display: 'none',
    pointerEvents: 'none',
  });
  overlay.appendChild(box);

  const hint = document.createElement('div');
  hint.textContent = faceMode
    ? 'Drag a box around the face · Esc to cancel'
    : 'Drag to select an area · Esc to cancel';
  Object.assign(hint.style, {
    position: 'fixed',
    top: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: T.slate[900],
    color: '#fff',
    font: `500 12px ${T.font}`,
    padding: '6px 12px',
    borderRadius: T.radius.pill,
    boxShadow: T.shadow.md,
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
    void finish(r.x, r.y, r.w, r.h, faceMode);
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

async function finish(x: number, y: number, w: number, h: number, faceMode = false) {
  try {
    // Overlay is already removed; wait two frames so the screenshot is clean.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));

    const resp = (await browser.runtime.sendMessage({
      type: MSG.CAPTURE_VIEWPORT,
    })) as CaptureViewportResponse;

    if (!resp?.dataUrl) return;
    const cropped = await cropDataUrl(resp.dataUrl, x, y, w, h);
    await browser.runtime.sendMessage({
      type: faceMode ? MSG.SEARCH_FACE : MSG.SEARCH_IMAGE,
      dataUrl: cropped,
    });
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

// ── "Search this face" — crop assist + ethics gate ─────────────────────────

const ETHICS_LINE = 'For verifying people, sources & authenticity — not stalking or harassment. Follow local law.';

/**
 * Entry from the context menu. `dataUrl` is clean bytes grabbed by the worker;
 * if it's absent (blob:/cookie-gated) we grab in-page. Then: first-run ethics
 * gate → crop overlay → face-order upload search.
 */
async function startFaceCrop(dataUrl?: string, srcUrl?: string) {
  if (active) return;
  try {
    let clean = dataUrl;
    if (!clean && srcUrl) {
      try {
        clean = await fetchAsDataUrl(srcUrl);
      } catch {
        try {
          clean = elementToDataUrl(srcUrl);
        } catch {
          clean = undefined;
        }
      }
    }
    if (!clean) {
      // Couldn't get croppable bytes — degrade to a whole-image URL face search.
      if (srcUrl) await browser.runtime.sendMessage({ type: MSG.SEARCH_FACE_URL, srcUrl });
      return;
    }
    if (!(await ensureFaceEthicsAck())) return; // user declined the notice
    openCropOverlay(clean);
  } catch (err) {
    console.error('[RIS] face crop failed:', err);
    active = false;
  }
}

async function ensureFaceEthicsAck(): Promise<boolean> {
  const { faceEthicsAckd } = (await browser.storage.local.get('faceEthicsAckd')) as {
    faceEthicsAckd?: boolean;
  };
  if (faceEthicsAckd) return true;
  const ok = await showEthicsGate();
  if (ok) await browser.storage.local.set({ faceEthicsAckd: true });
  return ok;
}

/** First-run responsible-use notice; resolves true if the user acknowledges. */
function showEthicsGate(): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = fullscreenOverlay('rgba(0,0,0,0.8)');
    const card = document.createElement('div');
    Object.assign(card.style, {
      maxWidth: '440px',
      background: '#fff',
      color: '#111827',
      borderRadius: '14px',
      padding: '24px',
      font: '14px/1.55 system-ui, sans-serif',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    });
    card.innerHTML =
      '<h2 style="margin:0 0 10px;font-size:18px">Search this face — responsible use</h2>' +
      '<p style="margin:0 0 10px">Face search is powerful. Use it to <b>reunite sources, ' +
      'verify authenticity, and spot fakes or impersonation</b>.</p>' +
      '<p style="margin:0 0 16px">Do <b>not</b> use it to stalk, harass, or identify people ' +
      'without a legitimate reason. You are responsible for complying with your local laws.</p>';

    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', gap: '8px', justifyContent: 'flex-end' });
    const cancel = gateButton('Cancel', false);
    const ok = gateButton('I understand', true);
    const done = (v: boolean) => {
      overlay.remove();
      window.removeEventListener('keydown', onKey);
      resolve(v);
    };
    cancel.onclick = () => done(false);
    ok.onclick = () => done(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') done(false);
    };
    window.addEventListener('keydown', onKey);

    row.append(cancel, ok);
    card.append(row);
    overlay.append(card);
    document.documentElement.append(overlay);
  });
}

/** The crop-assist modal: show the image, drag a box around the face, confirm. */
function openCropOverlay(dataUrl: string) {
  active = true;

  const overlay = fullscreenOverlay('rgba(0,0,0,0.82)');
  Object.assign(overlay.style, {
    flexDirection: 'column',
    gap: '12px',
    padding: '20px',
    boxSizing: 'border-box',
  });

  const top = document.createElement('div');
  top.textContent = `Drag a box around the face, then Search. ${ETHICS_LINE}`;
  Object.assign(top.style, {
    color: '#e5e7eb',
    font: '13px/1.4 system-ui, sans-serif',
    textAlign: 'center',
    maxWidth: '680px',
  });

  const wrap = document.createElement('div');
  Object.assign(wrap.style, { position: 'relative', display: 'inline-block', lineHeight: '0' });

  const img = document.createElement('img');
  img.src = dataUrl;
  img.draggable = false;
  Object.assign(img.style, {
    maxWidth: 'min(90vw, 900px)',
    maxHeight: '72vh',
    display: 'block',
    userSelect: 'none',
  });

  const box = document.createElement('div');
  Object.assign(box.style, {
    position: 'absolute',
    border: '2px solid #4f46e5',
    boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
    display: 'none',
    pointerEvents: 'none',
  });

  wrap.append(img, box);

  const bar = document.createElement('div');
  Object.assign(bar.style, { display: 'flex', gap: '8px' });
  const cancelBtn = gateButton('Cancel', false);
  const searchBtn = gateButton('Search this face', true);
  bar.append(cancelBtn, searchBtn);

  overlay.append(top, wrap, bar);
  document.documentElement.append(overlay);

  // Drag-to-draw a crop rectangle, in image-relative CSS pixels.
  let sel: { left: number; top: number; w: number; h: number } | null = null;
  let dragging = false;
  let sx = 0;
  let sy = 0;

  const rel = (e: MouseEvent) => {
    const r = img.getBoundingClientRect();
    return {
      x: Math.min(Math.max(e.clientX - r.left, 0), r.width),
      y: Math.min(Math.max(e.clientY - r.top, 0), r.height),
    };
  };
  const onDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    const p = rel(e);
    sx = p.x;
    sy = p.y;
    sel = { left: sx, top: sy, w: 0, h: 0 };
    drawSel();
  };
  const onMove = (e: MouseEvent) => {
    if (!dragging) return;
    const p = rel(e);
    sel = {
      left: Math.min(sx, p.x),
      top: Math.min(sy, p.y),
      w: Math.abs(p.x - sx),
      h: Math.abs(p.y - sy),
    };
    drawSel();
  };
  const onUp = () => {
    dragging = false;
    if (sel && (sel.w < 8 || sel.h < 8)) sel = null;
    drawSel();
  };
  const drawSel = () => {
    if (!sel || sel.w < 1 || sel.h < 1) {
      box.style.display = 'none';
      return;
    }
    box.style.display = 'block';
    box.style.left = `${sel.left}px`;
    box.style.top = `${sel.top}px`;
    box.style.width = `${sel.w}px`;
    box.style.height = `${sel.h}px`;
  };

  const cleanup = () => {
    img.removeEventListener('mousedown', onDown);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('keydown', onKey);
    overlay.remove();
    active = false;
  };
  const confirm = async () => {
    try {
      const out = sel ? cropImageRegion(img, sel) : dataUrl;
      cleanup();
      await browser.runtime.sendMessage({ type: MSG.SEARCH_FACE, dataUrl: out });
    } catch (err) {
      console.error('[RIS] face crop confirm failed:', err);
      cleanup();
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') cleanup();
    else if (e.key === 'Enter') void confirm();
  };

  img.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  window.addEventListener('keydown', onKey);
  cancelBtn.onclick = cleanup;
  searchBtn.onclick = () => void confirm();
}

/** Crop a display-relative rectangle out of a loaded <img> at its natural res. */
function cropImageRegion(
  img: HTMLImageElement,
  sel: { left: number; top: number; w: number; h: number },
): string {
  const scaleX = img.naturalWidth / img.clientWidth;
  const scaleY = img.naturalHeight / img.clientHeight;
  const sx = Math.round(sel.left * scaleX);
  const sy = Math.round(sel.top * scaleY);
  const sw = Math.max(1, Math.round(sel.w * scaleX));
  const sh = Math.max(1, Math.round(sel.h * scaleY));
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL('image/png');
}

// Inject hover/transition rules once. Base styles stay inline (host-page CSS
// isolation); only interactive states — which inline styles can't express —
// live here, scoped by the `ris-` class prefix to avoid host-page bleed.
function ensureOverlayStyles(): void {
  if (document.getElementById('ris-style')) return;
  const style = document.createElement('style');
  style.id = 'ris-style';
  style.textContent = `
    .ris-btn {
      font: 500 14px ${T.font};
      padding: 9px 16px;
      border-radius: 10px;
      cursor: pointer;
      border: 1px solid transparent;
      transition: background .15s ease, box-shadow .15s ease;
    }
    .ris-btn--primary { background: ${T.brand[600]}; color: #fff; box-shadow: ${T.shadow.brand}; }
    .ris-btn--primary:hover { background: ${T.brand[700]}; }
    .ris-btn--secondary { background: #fff; color: ${T.slate[700]}; border-color: ${T.slate[200]}; }
    .ris-btn--secondary:hover { background: ${T.slate[50]}; }
  `;
  document.documentElement.appendChild(style);
}

function fullscreenOverlay(bg: string): HTMLDivElement {
  ensureOverlayStyles();
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: bg,
  });
  return el;
}

function gateButton(label: string, primary: boolean): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.className = `ris-btn ${primary ? 'ris-btn--primary' : 'ris-btn--secondary'}`;
  return b;
}
