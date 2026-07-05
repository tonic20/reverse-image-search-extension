import { browser } from 'wxt/browser';
import { engineList, FACE_ENGINE_ORDER } from '../lib/engines';
import { getSettings } from '../lib/settings';
import { MSG } from '../lib/messages';
import {
  openUrlSearches,
  searchImageByUpload,
  searchImageBlob,
  grabImageBlobFromBackground,
  blobToDataUrlSW,
} from '../lib/search';

const ALL_ID = 'ris-all';
const UPLOAD_ID = 'ris-upload';
const FACE_ID = 'ris-face';
const CAPTURE_ID = 'ris-capture';

// WXT auto-imports `defineBackground`.
export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => void rebuildMenus());
  browser.runtime.onStartup.addListener(() => void rebuildMenus());
  browser.storage.onChanged.addListener((_changes, area) => {
    if (area === 'sync') void rebuildMenus();
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    void handleMenuClick(String(info.menuItemId), info.srcUrl, tab?.id);
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const msg = message as { type?: string; dataUrl?: string; srcUrl?: string };

    if (msg?.type === MSG.CAPTURE_VIEWPORT) {
      const windowId = sender.tab?.windowId;
      const shot =
        windowId != null
          ? browser.tabs.captureVisibleTab(windowId, { format: 'png' as const })
          : browser.tabs.captureVisibleTab({ format: 'png' as const });
      shot
        .then((dataUrl) => sendResponse({ dataUrl }))
        .catch((err) => {
          console.error('[RIS] captureVisibleTab failed:', err);
          sendResponse({ dataUrl: null });
        });
      return true; // keep the channel open for the async response
    }

    if (msg?.type === MSG.SEARCH_IMAGE && msg.dataUrl) {
      void searchImageByUpload(msg.dataUrl);
    }

    if (msg?.type === MSG.SEARCH_FACE && msg.dataUrl) {
      void searchImageByUpload(msg.dataUrl, FACE_ENGINE_ORDER);
    }

    if (msg?.type === MSG.SEARCH_FACE_URL && msg.srcUrl) {
      void faceSearchUrl(msg.srcUrl);
    }
    return undefined;
  });
});

async function faceSearchUrl(srcUrl: string) {
  const { openInBackground } = await getSettings();
  openUrlSearches(srcUrl, FACE_ENGINE_ORDER, openInBackground);
}

async function rebuildMenus() {
  await browser.contextMenus.removeAll();
  const { engineOrder } = await getSettings();

  // Flat menu: every action is a TOP-LEVEL item — no parent of our own. Chrome
  // auto-collapses an extension's multiple top-level items into a single submenu
  // named after the extension ("Reverse Image Search"), so this is exactly one
  // level deep. (An explicit parent on top of that is what double-nested before.)

  // Per-engine, on an image.
  for (const e of engineList(engineOrder)) {
    browser.contextMenus.create({ id: e.id, title: e.name, contexts: ['image'] });
  }
  browser.contextMenus.create({ id: 'sep', type: 'separator', contexts: ['image'] });

  browser.contextMenus.create({ id: ALL_ID, title: 'All engines', contexts: ['image'] });
  // Byte-grab path for images the redirect method can't reach (Instagram,
  // Pinterest, hotlink-protected CDNs, blob:/data:). See SPEC §7 / Phase 0.3b.
  browser.contextMenus.create({
    id: UPLOAD_ID,
    title: 'All engines (upload — Instagram/Pinterest)',
    contexts: ['image'],
  });

  browser.contextMenus.create({ id: 'sep2', type: 'separator', contexts: ['image'] });
  // Face-search flow (Phase 0.4): crop-assist → Yandex-first engine order.
  browser.contextMenus.create({ id: FACE_ID, title: '🔍 Search this face…', contexts: ['image'] });

  // Anywhere on the page: capture a region to search (for images with no usable
  // URL, or to search just part of the page).
  browser.contextMenus.create({
    id: CAPTURE_ID,
    title: 'Capture region to search',
    contexts: ['page', 'image', 'selection'],
  });
}

async function handleMenuClick(menuItemId: string, srcUrl: string | undefined, tabId: number | undefined) {
  if (menuItemId === CAPTURE_ID) {
    if (tabId != null) await browser.tabs.sendMessage(tabId, { type: MSG.START_CAPTURE });
    return;
  }

  if (menuItemId === UPLOAD_ID) {
    if (srcUrl) await grabAndSearch(srcUrl, tabId);
    return;
  }

  if (menuItemId === FACE_ID) {
    if (srcUrl) await startFaceCrop(srcUrl, tabId);
    return;
  }

  if (!srcUrl) return;
  const { engineOrder, openInBackground } = await getSettings();
  const ids = menuItemId === ALL_ID ? engineOrder : [menuItemId];
  openUrlSearches(srcUrl, ids, openInBackground);
}

/**
 * Phase 0.3b — grab an image's bytes, then run the S3 upload-search path.
 *
 * Tiers, cheapest first:
 *   1. `data:` URL — the bytes are already in hand.
 *   2. Background fetch (host_permissions bypass page CORS) — reaches most CDN
 *      images the redirect method can't hand to an engine.
 *   3. Content-script grab — for `blob:`/`data:` (page-scoped) or images that
 *      need the page's session cookies. The content script replies via
 *      SEARCH_IMAGE, so nothing more to do here.
 */
async function grabAndSearch(srcUrl: string, tabId: number | undefined) {
  if (srcUrl.startsWith('data:')) {
    await searchImageByUpload(srcUrl);
    return;
  }

  const blob = await grabImageBlobFromBackground(srcUrl);
  if (blob) {
    await searchImageBlob(blob);
    return;
  }

  // Fall back to grabbing the bytes inside the page (blob:/cookie-gated/CORS).
  if (tabId != null) {
    try {
      await browser.tabs.sendMessage(tabId, { type: MSG.GRAB_IMAGE, srcUrl });
      return;
    } catch (err) {
      console.error('[RIS] content-script grab dispatch failed:', err);
    }
  }
  // Last resort: let the engines try the raw URL themselves.
  const { engineOrder, openInBackground } = await getSettings();
  openUrlSearches(srcUrl, engineOrder, openInBackground);
}

/**
 * Phase 0.4 — open the crop-assist overlay for "Search this face".
 *
 * The overlay must show *clean* (non-tainted) pixels so the crop can be read
 * back off a canvas — so we grab the bytes here (host-permission fetch bypasses
 * page CORS) and pass a data URL. For `blob:`/cookie-gated images we can't grab
 * from the worker; we pass `srcUrl` and let the content script fetch it in-page.
 * The content script decides between the two and handles the ethics gate.
 */
async function startFaceCrop(srcUrl: string, tabId: number | undefined) {
  if (tabId == null) return;

  let dataUrl: string | undefined;
  if (srcUrl.startsWith('data:')) {
    dataUrl = srcUrl;
  } else {
    const blob = await grabImageBlobFromBackground(srcUrl);
    if (blob) dataUrl = await blobToDataUrlSW(blob);
  }

  try {
    await browser.tabs.sendMessage(tabId, { type: MSG.START_FACE_CROP, dataUrl, srcUrl });
  } catch (err) {
    console.error('[RIS] face-crop dispatch failed:', err);
    // No content script on this tab — degrade to a whole-image face search.
    if (dataUrl) await searchImageByUpload(dataUrl, FACE_ENGINE_ORDER);
    else await faceSearchUrl(srcUrl);
  }
}
