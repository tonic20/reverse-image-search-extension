import { browser } from 'wxt/browser';
import { engineList } from '../lib/engines';
import { getSettings } from '../lib/settings';
import { MSG } from '../lib/messages';
import {
  openUrlSearches,
  searchImageByUpload,
  searchImageBlob,
  grabImageBlobFromBackground,
} from '../lib/search';

const PARENT_ID = 'ris-parent';
const ALL_ID = 'ris-all';
const UPLOAD_ID = 'ris-upload';
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
    const msg = message as { type?: string; dataUrl?: string };

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
    return undefined;
  });
});

async function rebuildMenus() {
  await browser.contextMenus.removeAll();
  const { engineOrder } = await getSettings();

  // On an image: per-engine + "All engines".
  browser.contextMenus.create({ id: PARENT_ID, title: 'Reverse image search', contexts: ['image'] });
  for (const e of engineList(engineOrder)) {
    browser.contextMenus.create({
      id: e.id,
      parentId: PARENT_ID,
      title: e.note ? `${e.name} — ${e.note}` : e.name,
      contexts: ['image'],
    });
  }
  browser.contextMenus.create({ id: 'sep', parentId: PARENT_ID, type: 'separator', contexts: ['image'] });
  browser.contextMenus.create({ id: ALL_ID, parentId: PARENT_ID, title: 'All engines', contexts: ['image'] });
  // Byte-grab path for images the redirect method can't reach (Instagram,
  // Pinterest, hotlink-protected CDNs, blob:/data:). See SPEC §7 / Phase 0.3b.
  browser.contextMenus.create({
    id: UPLOAD_ID,
    parentId: PARENT_ID,
    title: 'All engines (upload — works on Instagram/Pinterest)',
    contexts: ['image'],
  });

  // Anywhere on the page: capture a region to search (for images with no usable
  // URL, or to search just part of the page).
  browser.contextMenus.create({
    id: CAPTURE_ID,
    title: 'Reverse image search: capture region',
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
