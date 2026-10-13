import { defineConfig } from 'wxt';

// WXT config — https://wxt.dev
export default defineConfig({
  modules: ['@wxt-dev/i18n/module'],
  // WXT defaults Firefox to MV2. Force MV3 everywhere so all four stores ship the
  // same background/API semantics and we don't maintain an MV2 code path.
  manifestVersion: 3,
  manifest: ({ browser }) => ({
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
    // The welcome page (lib/welcome.ts) connects for the live pin state. Chromium only: Firefox
    // does not support the key. Adds no install warning. Keep the origin in sync with WELCOME_BASE.
    ...(browser !== 'firefox'
      ? { externally_connectable: { matches: [`${new URL(process.env.VITE_WELCOME_BASE || 'https://reverseimage.app').origin}/*`] } }
      : {}),
    // Firefox-only: AMO requires a stable add-on id. Emitted only for the firefox
    // target — WXT does NOT strip this key on its own, and Chromium logs
    // "Unrecognized manifest key" if it leaks through.
    //
    // 127.0 floor, not 121: before FF 127 an MV3 extension's host_permissions were
    // NOT granted at install (user had to opt in via the extensions button). This
    // extension needs <all_urls> for background fetch + captureVisibleTab, so on
    // 121-126 it would install silently broken. ESR 128 > 127, so coverage is fine.
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'reverse-image-search@kopylov.net',
              // 140, not 127: 127 is the floor at which MV3 host_permissions are
              // granted at install, but data_collection_permissions below only
              // exists from FF 140 — under that it is silently ignored and users
              // see no consent UI. ESR 140 clears this, so the cost is minimal.
              strict_min_version: '140.0',
              // Required by AMO for all new extensions since 2025-11-03.
              // NOT 'none': the upload path (sites that hide the image URL) and
              // region capture send image bytes to our S3 backend, and every
              // search hands the image or its URL to a third-party engine. That
              // image is page content, hence 'websiteContent'.
              //
              // 'technicalAndInteraction' covers the search counting added in
              // 0.8.0 — that a search happened, which entry point started it,
              // this build's version. It is listed as optional because Mozilla
              // does not permit it to be required: it is the one data type the
              // user must always be able to refuse. Firefox shows it as a
              // toggle in the install flow, defaulting to on, and again in the
              // Add-ons Manager.
              //
              // That toggle is the ONLY switch on Firefox 140+: the popup hides
              // its own checkbox there and lib/telemetry-actions.ts reads the
              // permission instead, so the two can never disagree.
              data_collection_permissions: {
                required: ['websiteContent'],
                optional: ['technicalAndInteraction'],
              },
            },
            // Android got data_collection_permissions two releases later (142).
            gecko_android: {
              strict_min_version: '142.0',
            },
          },
        }
      : {}),
  }),
});
