import { browser } from 'wxt/browser';
import { ENGINES, engineList } from '../lib/engines';
import { getSettings } from '../lib/settings';

const PARENT_ID = 'ris-parent';
const ALL_ID = 'ris-all';

// WXT auto-imports `defineBackground`.
export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(rebuildMenus);
  browser.runtime.onStartup.addListener(rebuildMenus);
  browser.storage.onChanged.addListener((_changes, area) => {
    if (area === 'sync') void rebuildMenus();
  });

  browser.contextMenus.onClicked.addListener((info) => {
    if (info.srcUrl) void handleClick(String(info.menuItemId), info.srcUrl);
  });
});

async function rebuildMenus() {
  await browser.contextMenus.removeAll();
  const { engineOrder } = await getSettings();
  const engines = engineList(engineOrder);

  browser.contextMenus.create({
    id: PARENT_ID,
    title: 'Reverse image search',
    contexts: ['image'],
  });

  for (const e of engines) {
    browser.contextMenus.create({
      id: e.id,
      parentId: PARENT_ID,
      title: e.note ? `${e.name} — ${e.note}` : e.name,
      contexts: ['image'],
    });
  }

  browser.contextMenus.create({
    id: 'sep',
    parentId: PARENT_ID,
    type: 'separator',
    contexts: ['image'],
  });
  browser.contextMenus.create({
    id: ALL_ID,
    parentId: PARENT_ID,
    title: 'All engines',
    contexts: ['image'],
  });
}

async function handleClick(menuItemId: string, srcUrl: string) {
  const { engineOrder, openInBackground } = await getSettings();

  // NOTE (Phase 0.3): if `srcUrl` is a data:/blob: URL or the page blocks
  // fetching it (Instagram/Pinterest), the redirect engines can't load it.
  // That path uploads the bytes to S3 first to get a public URL. Phase 0.1
  // handles the common case where images already have a public URL.
  const ids = menuItemId === ALL_ID ? engineOrder : [menuItemId];

  ids.forEach((id, i) => {
    const engine = ENGINES[id];
    if (!engine) return;
    void browser.tabs.create({
      url: engine.byUrl(srcUrl),
      // First tab focused; extras open in background if the user prefers.
      active: i === 0 ? true : !openInBackground,
    });
  });
}
