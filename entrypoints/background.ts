import { ENGINES, engineList } from '../lib/engines';
import { getSettings } from '../lib/settings';

const PARENT_ID = 'ris-parent';
const ALL_ID = 'ris-all';

// WXT auto-imports `defineBackground`.
export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(rebuildMenus);
  chrome.runtime.onStartup.addListener(rebuildMenus);
  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === 'sync') rebuildMenus();
  });

  chrome.contextMenus.onClicked.addListener(handleClick);
});

async function rebuildMenus() {
  await chrome.contextMenus.removeAll();
  const { engineOrder } = await getSettings();
  const engines = engineList(engineOrder);

  chrome.contextMenus.create({
    id: PARENT_ID,
    title: 'Reverse image search',
    contexts: ['image'],
  });

  for (const e of engines) {
    chrome.contextMenus.create({
      id: e.id,
      parentId: PARENT_ID,
      title: e.note ? `${e.name} — ${e.note}` : e.name,
      contexts: ['image'],
    });
  }

  chrome.contextMenus.create({ id: 'sep', parentId: PARENT_ID, type: 'separator', contexts: ['image'] });
  chrome.contextMenus.create({
    id: ALL_ID,
    parentId: PARENT_ID,
    title: 'All engines',
    contexts: ['image'],
  });
}

async function handleClick(info: chrome.contextMenus.OnClickData) {
  const src = info.srcUrl;
  if (!src) return;

  const { engineOrder, openInBackground } = await getSettings();

  // NOTE (Phase 0.3): if `src` is a data:/blob: URL or the page blocks fetching
  // it (Instagram/Pinterest), the redirect engines can't load it. That path
  // uploads the bytes to S3 first to get a public URL. Phase 0.1 handles the
  // common case where images already have a public URL.
  const ids =
    info.menuItemId === ALL_ID ? engineOrder : [String(info.menuItemId)];

  ids.forEach((id, i) => {
    const engine = ENGINES[id];
    if (!engine) return;
    chrome.tabs.create({
      url: engine.byUrl(src),
      // First tab focused; extras open in background if the user prefers.
      active: i === 0 ? true : !openInBackground,
    });
  });
}
