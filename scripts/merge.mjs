#!/usr/bin/env node
// Merge upstream router-for-me/models `models.json` with `overlay.json`.
//
//   node scripts/merge.mjs <upstream.json> <overlay.json> <out.json>
//
// Rule: upstream wins. An overlay entry is appended to its provider section only
// when upstream has no entry with that id; when upstream carries the id, the
// upstream entry is kept untouched. Sections the overlay does not name pass
// through verbatim. The overlay is therefore a floor ("these ids must exist"),
// never a patch.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function merge(upstream, overlay) {
  if (!isPlainObject(upstream)) throw new Error('upstream catalog must be a JSON object of provider sections');
  if (!isPlainObject(overlay)) throw new Error('overlay must be a JSON object of provider sections');
  const catalog = structuredClone(upstream);
  const added = [];
  const kept = [];
  for (const [provider, entries] of Object.entries(overlay)) {
    if (!Array.isArray(entries)) throw new Error(`overlay.${provider} must be an array of model entries`);
    if (catalog[provider] === undefined) catalog[provider] = [];
    if (!Array.isArray(catalog[provider])) throw new Error(`upstream.${provider} is not an array`);
    const ids = new Set(catalog[provider].map((e) => e?.id));
    for (const entry of entries) {
      if (!isPlainObject(entry) || typeof entry.id !== 'string' || entry.id === '') {
        throw new Error(`overlay.${provider}: every entry needs a non-empty string id`);
      }
      if (ids.has(entry.id)) {
        kept.push(`${provider}/${entry.id}`);
        continue;
      }
      catalog[provider].push(structuredClone(entry));
      ids.add(entry.id);
      added.push(`${provider}/${entry.id}`);
    }
  }
  return { catalog, added, kept };
}

export function render(catalog) {
  return JSON.stringify(catalog, null, 2) + '\n';
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function main(argv) {
  const [upstreamPath, overlayPath, outPath] = argv;
  if (!upstreamPath || !overlayPath || !outPath) {
    console.error('usage: merge.mjs <upstream.json> <overlay.json> <out.json>');
    return 2;
  }
  const upstream = JSON.parse(readFileSync(upstreamPath, 'utf8'));
  const overlay = JSON.parse(readFileSync(overlayPath, 'utf8'));
  const { catalog, added, kept } = merge(upstream, overlay);
  for (const [provider, entries] of Object.entries(overlay)) {
    const ids = new Set(catalog[provider].map((e) => e.id));
    for (const entry of entries) {
      if (!ids.has(entry.id)) throw new Error(`post-check: ${provider}/${entry.id} missing from output`);
    }
  }
  writeFileSync(outPath, render(catalog));
  console.log(`merged ${outPath}: added from overlay [${added.join(', ')}]; already upstream [${kept.join(', ')}]`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
