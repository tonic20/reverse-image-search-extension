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
servers, uploads happen only when you ask and auto-delete within about an hour
— are the main reason to install this over an alternative. They are worth
nothing if you have to take them on trust. This is the code, so you don't.

Start with [`entrypoints/background.ts`](entrypoints/background.ts) for the
context-menu and search routing, [`lib/config.ts`](lib/config.ts) for every
server address the extension knows about, and
[`lib/engines.ts`](lib/engines.ts) for the engine definitions.

## Build

Requires Node 23.9.0 (the version CI pins and the version quoted in the
add-on-store build notes).

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

Two suites in `lib/store-listing-completeness.test.ts` check store-listing
copy that lives in the private monorepo. They skip automatically here.

## Package

```bash
npm run zip            # chrome
npm run zip:firefox
npm run zip:edge
npm run zip:opera
```

Output lands in `.output/`. The build is deterministic: a clean rebuild
reproduces the shipped bundle byte for byte.

## About this mirror

This is a read-only mirror, published with `git subtree` from a private
monorepo that also holds the Rails backend serving reverseimage.app. The
monorepo is the source of truth, so commits land there and are pushed here —
which is why this repository has no branches other than `main` and no direct
commits.

Issues and pull requests are welcome regardless; a PR here will be applied
upstream by hand and credited.

## Licence

[MIT](LICENSE) © 2026 Anton Kopylov.

The backend (presigned S3 uploads, and the search proxies behind the paid
tier) is not part of this repository and is not MIT-licensed.
