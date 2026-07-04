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
      // 'offscreen',      // enabled in Phase 0.2 (clipboard + canvas crop)
      // 'clipboardRead',  // enabled in Phase 0.2
    ],
    host_permissions: ['<all_urls>'],
  },
});
