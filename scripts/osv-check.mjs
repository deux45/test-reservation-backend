#!/usr/bin/env node
/**
 * Supply-chain audit: checks every locked dependency against the OSV.dev database.
 *
 * Complements `npm audit` (GitHub Advisory DB) with a second, independent source.
 * Reads package-lock.json so it covers the FULL transitive tree, not just direct
 * dependencies -- which is where compromised packages actually hide.
 *
 * Usage:  node scripts/osv-check.mjs [--json]
 * Exit:   0 = clean, 1 = vulnerabilities found, 2 = could not run
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OSV_BATCH_URL = 'https://api.osv.dev/v1/querybatch';
const BATCH_SIZE = 500;
const asJson = process.argv.includes('--json');

/** Collects { name, version } for every package in the lockfile. */
function readLockedPackages(lockPath) {
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));

  if (lock.lockfileVersion < 2) {
    throw new Error(`lockfileVersion ${lock.lockfileVersion} is not supported; use npm >= 7`);
  }

  const seen = new Map();
  for (const [path, meta] of Object.entries(lock.packages ?? {})) {
    if (!path || meta.link) continue; // root entry and workspace symlinks
    const name = meta.name ?? path.slice(path.lastIndexOf('node_modules/') + 13);
    if (!name || !meta.version) continue;
    seen.set(`${name}@${meta.version}`, { name, version: meta.version });
  }
  return [...seen.values()];
}

async function queryOsv(packages) {
  const findings = [];

  for (let offset = 0; offset < packages.length; offset += BATCH_SIZE) {
    const chunk = packages.slice(offset, offset + BATCH_SIZE);
    const response = await fetch(OSV_BATCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: chunk.map((p) => ({
          version: p.version,
          package: { name: p.name, ecosystem: 'npm' },
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`OSV responded ${response.status} ${response.statusText}`);
    }

    const { results = [] } = await response.json();
    results.forEach((result, index) => {
      const vulns = result.vulns ?? [];
      if (vulns.length > 0) {
        findings.push({ ...chunk[index], ids: vulns.map((v) => v.id) });
      }
    });
  }

  return findings;
}

async function main() {
  const lockPath = resolve(process.cwd(), 'package-lock.json');
  const packages = readLockedPackages(lockPath);
  const findings = await queryOsv(packages);

  if (asJson) {
    console.log(JSON.stringify({ checked: packages.length, findings }, null, 2));
  } else {
    for (const finding of findings) {
      console.error(`  VULNERABLE  ${finding.name}@${finding.version}  ->  ${finding.ids.join(', ')}`);
    }
    const verdict = findings.length === 0 ? 'clean' : `${findings.length} vulnerable`;
    console.log(`\nOSV.dev: ${packages.length} packages checked, ${verdict}.`);
  }

  // exitCode, not process.exit(): forcing the process down while fetch's
  // sockets are still closing trips a libuv assertion on Windows. Setting the
  // code lets the event loop drain and exit on its own.
  process.exitCode = findings.length === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(`osv-check failed: ${error.message}`);
  process.exitCode = 2;
});
