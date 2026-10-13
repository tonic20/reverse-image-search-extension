// Build-output guard: no package may ship another store's review URL.
//
// This exists because the source-level tests in store-review-url.test.ts CANNOT
// catch this class of bug. The first fix here resolved the URL with
// `reviewUrlFor(import.meta.env.BROWSER)` — every unit test passed, and the
// Firefox package still contained a chromewebstore.google.com string, because a
// runtime map lookup forces rollup to keep every entry. Only inspecting the
// built bundle reveals it.
//
// It really builds (a few seconds) rather than reading a stale `.output/`, so a
// pass means the CURRENT source produces a clean bundle.
import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const EXT_ROOT = path.join(import.meta.dirname, '..');

/** Every store domain we might ever link to, and which target may contain it. */
const STORE_DOMAINS: Record<string, string> = {
  'chromewebstore.google.com': 'chrome',
  'addons.mozilla.org': 'firefox',
  'microsoftedge.microsoft.com': 'edge',
  'addons.opera.com': 'opera',
};

const TARGETS = ['firefox', 'edge', 'opera'] as const;

function jsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...jsFilesUnder(full));
    else if (full.endsWith('.js')) out.push(full);
  }
  return out;
}

describe('built bundles carry no foreign store URL', () => {
  beforeAll(() => {
    for (const target of TARGETS) {
      execFileSync('npx', ['wxt', 'build', '-b', target], {
        cwd: EXT_ROOT,
        stdio: 'pipe',
        timeout: 180_000,
      });
    }
  }, 300_000);

  it.each(TARGETS)('%s build contains no other store’s review URL', (target) => {
    const outDir = path.join(EXT_ROOT, '.output', `${target}-mv3`);
    const sources = jsFilesUnder(outDir).map((f) => ({ f, body: readFileSync(f, 'utf8') }));
    expect(sources.length).toBeGreaterThan(0);

    for (const [domain, owner] of Object.entries(STORE_DOMAINS)) {
      if (owner === target) continue; // its own store is fine once published
      for (const { f, body } of sources) {
        expect(
          body.includes(domain),
          `${path.relative(EXT_ROOT, f)} ships ${domain}, which belongs to the ${owner} build`,
        ).toBe(false);
      }
    }
  });

  // The welcome page connects to the extension for the live pin state (lib/welcome.ts).
  // Chromium supports externally_connectable; Firefox does not and would warn on it.
  const manifest = (target: string) =>
    JSON.parse(readFileSync(path.join(EXT_ROOT, '.output', `${target}-mv3`, 'manifest.json'), 'utf8'));

  it.each(['edge', 'opera'])('%s build lets the welcome page connect', (target) => {
    expect(manifest(target).externally_connectable).toEqual({ matches: ['https://reverseimage.app/*'] });
  });
  it('firefox build has no externally_connectable', () => {
    expect(manifest('firefox').externally_connectable).toBeUndefined();
  });
});
