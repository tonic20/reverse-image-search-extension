import { defineConfig } from 'wxt';

// WXT config — https://wxt.dev
export default defineConfig({
  manifest: {
    name: 'Reverse Image Search',
    description:
      'Multi-engine reverse image search — right-click, paste, capture, or search where URLs fail.',
    permissions: [
      'contextMenus',
      'tabs',
      'scripting',
      'activeTab',
      'storage',
      // NOT needed (the Phase 0.2 plan expected them, the impl avoided them):
      // 'offscreen'     — canvas crop runs in the content script, not an offscreen doc.
      // 'clipboardRead' — paste is read from the popup's `paste` event (no permission).
    ],
    host_permissions: ['<all_urls>'],
  },
});
