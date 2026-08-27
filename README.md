# Reverse Image Search Anywhere — browser extension

[![CI](https://github.com/tonic20/reverse-image-search-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/tonic20/reverse-image-search-extension/actions/workflows/ci.yml)

Multi-engine reverse image search that also works where the plain "search by
URL" trick fails — Instagram, Pinterest, `<canvas>`, `blob:` and `data:` images
— plus clipboard paste, region capture, and a face-search-first flow.

Engines: **Google Lens · Yandex · Bing Visual · TinEye.**

- Product site: <https://reverseimage.app>
- Chrome Web Store: <https://chromewebstore.google.com/detail/reverse-image-search-anyw/jmfdmdfnhkgbnpnpignhjcokpllbnhpp>
- Firefox Add-ons: <https://addons.mozilla.org/en-US/firefox/addon/reverse-image-search-anywhere/>
- Privacy policy: <https://reverseimage.app/privacy>

## Why this repository exists

The privacy claims on the product site — plain searches never touch our
servers, and uploads (only when you ask) get a link that expires after 15
minutes, and once it does nobody can reach the file; the file itself is
deleted automatically about a day after it arrives — are the main reason to
install this over an alternative. They are worth nothing if you have to take
them on trust. This is the code, so you don't.

Start with [`entrypoints/background.ts`](entrypoints/background.ts) for the
context-menu and search routing, [`lib/config.ts`](lib/config.ts) for every
server address the extension knows about, and
[`lib/engines.ts`](lib/engines.ts) for the engine definitions.

## Build

Requires Node 24 (the line CI builds against). Add-on-store build notes quote
the exact version each submitted package was built with, measured at release
time — it does not have to match your local patch version.

```bash
npm ci
npm run dev            # launches Chrome with the extension loaded + hot reload
npm run dev:firefox
```

Then right-click any image on a page → **Reverse image search**.

## Test

```bash
npm run compile        # tsc --noEmit
npm test               # vitest
```

Suites in `lib/store-listing-completeness.test.ts` and
`lib/menu-label-parity.test.ts` check copy that lives in the private
monorepo — store-listing drafts and the Rails view templates — and skip
automatically here. Expect about half the suite to skip in this repo; that
is correct, not a broken checkout.

## Package

```bash
npm run zip            # chrome
npm run zip:firefox
npm run zip:edge
npm run zip:opera
```

Output lands in `.output/`. With the pinned Node version and the committed
`package-lock.json`, the build is deterministic: a clean rebuild reproduces
the shipped bundle byte for byte.

## About this mirror

This is a read-only mirror, published with `git subtree` from a private
monorepo that also holds the Rails backend serving reverseimage.app. The
monorepo is the source of truth, so commits land there and are pushed here —
which is why this repository has no branches other than `main` and no direct
commits.

Issues and pull requests are welcome regardless; a PR here will be applied
upstream by hand and credited.

## Analytics

Store performance for this extension — keyword rankings, installs, ratings, and
listing changes across the Chrome Web Store and Firefox Add-ons — is tracked
with [ExtensionDash](https://extensiondash.com), extension analytics made for
agents: it serves the data over MCP, so a coding agent can answer questions
like "which keywords gained rank this week?"

## Licence

[MIT](LICENSE) © 2026 Anton Kopylov.

The backend (presigned S3 uploads and the search proxies) is not part of this
repository and is not MIT-licensed.
