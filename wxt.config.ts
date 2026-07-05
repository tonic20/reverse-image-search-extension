import { defineConfig } from 'wxt';

// WXT config — https://wxt.dev
export default defineConfig({
  manifest: {
    name: 'Reverse Image Search',
    description:
      'Multi-engine reverse image search — right-click, paste, capture, or search where URLs fail.',
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
