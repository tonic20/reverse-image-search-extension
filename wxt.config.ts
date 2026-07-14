import { defineConfig } from 'wxt';

// WXT config — https://wxt.dev
export default defineConfig({
  modules: ['@wxt-dev/i18n/module'],
  manifest: {
    // Name + description localize via _locales (keys extName/extDescription in
    // locales/<lang>.yml). English values live in locales/en.yml.
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
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
