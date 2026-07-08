import { defineConfig } from 'wxt';

// WXT config — https://wxt.dev
export default defineConfig({
  manifest: {
    // Name + description mirror the Chrome Web Store listing copy (docs/STORE-LISTING.md §1).
    name: 'Reverse Image Search Anywhere',
    description:
      'Reverse image search across Google Lens, Yandex, Bing & TinEye in one right-click. Works on Instagram & Pinterest. Search a face.',
    // Minimal set. captureVisibleTab is satisfied by <all_urls> + activeTab; opening
    // result tabs, tabs.query for tab.id, and sendMessage need no permission. Removed
    // (unused): 'tabs', 'scripting'. Never needed (impl avoided them): 'offscreen'
    // (canvas crop runs in the content script), 'clipboardRead' (paste is read from
    // the popup's `paste` event). WXT re-adds any dev-only perms during `wxt dev`.
    permissions: [
      'contextMenus',
      'activeTab',
      'storage',
    ],
    host_permissions: ['<all_urls>'],
  },
});
