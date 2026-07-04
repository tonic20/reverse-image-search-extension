import { browser } from 'wxt/browser';
import { engineList } from '../lib/engines';
import { getSettings } from '../lib/settings';
import { MSG } from '../lib/messages';
import { openUrlSearches, searchImageByUpload } from '../lib/search';

const PARENT_ID = 'ris-parent';
const ALL_ID = 'ris-all';
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

  if (!srcUrl) return;
  const { engineOrder, openInBackground } = await getSettings();
  const ids = menuItemId === ALL_ID ? engineOrder : [menuItemId];
  openUrlSearches(srcUrl, ids, openInBackground);
}
