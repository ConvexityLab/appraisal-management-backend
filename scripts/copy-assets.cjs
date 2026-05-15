/**
 * Copy non-TS asset directories into dist/ after `tsc`.
 *
 * `tsc` ignores .txt/.json/etc. by default, so prompt templates and other
 * runtime assets that live under src/ must be copied alongside the compiled
 * output. Cross-platform (no `cp -r`).
 *
 * Edit ASSET_DIRS to add more asset trees as needed.
 */

const { cpSync, existsSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');
const SRC = resolve(ROOT, 'src');
const DIST = resolve(ROOT, 'dist');

/** Directories under src/ to mirror into dist/. */
const ASSET_DIRS = ['prompts'];

if (!existsSync(DIST)) {
  mkdirSync(DIST, { recursive: true });
}

let copied = 0;
for (const rel of ASSET_DIRS) {
  const from = resolve(SRC, rel);
  const to = resolve(DIST, rel);
  if (!existsSync(from)) {
    console.warn(`[copy-assets] skip ${rel} — not found at ${from}`);
    continue;
  }
  cpSync(from, to, { recursive: true });
  console.log(`[copy-assets] ${rel} → dist/${rel}`);
  copied += 1;
}

console.log(`[copy-assets] done (${copied} dir(s) copied)`);
