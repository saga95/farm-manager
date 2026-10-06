#!/usr/bin/env node
/**
 * Client bundle secret scan (#107). Everything under .next/static and public/
 * is downloaded by every visitor, so no credential may ever end up there.
 * Run after `next build`; exits 1 with the file and the kind of secret found
 * (never the value itself).
 *
 * Not flagged: Cognito pool / client ids, the AppSync URL and the bucket name
 * from amplify_outputs.json. Those are public identifiers by design; access
 * is enforced by Cognito and farm-api.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SECRET_PATTERNS = [
  ['AWS access key id', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  [
    'AWS secret key assignment',
    /aws_?secret_?access_?key["'\s:=]+[A-Za-z0-9/+]{40}/i,
  ],
  [
    'private key',
    /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/,
  ],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['Stripe secret key', /\b[sr]k_live_[A-Za-z0-9]{20,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['LLM API key', /\bsk-(?:ant-|proj-)[A-Za-z0-9_-]{20,}/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
];

/** The kinds of secret found in a text (empty when clean). */
export function findSecrets(text) {
  return SECRET_PATTERNS.filter(([, re]) => re.test(text)).map(([k]) => k);
}

const TEXT = /\.(?:js|mjs|cjs|json|html|css|txt|map|webmanifest|xml|svg)$/;

function* files(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (TEXT.test(name)) yield p;
  }
}

function main() {
  const root = process.cwd();
  const dirs = ['.next/static', 'public'].map(d => join(root, d));
  try {
    statSync(dirs[0]);
  } catch {
    console.error(
      'scan-client-bundle: .next/static not found; run `next build` first'
    );
    process.exit(2);
  }
  let scanned = 0;
  const hits = [];
  for (const dir of dirs)
    for (const f of files(dir)) {
      scanned += 1;
      for (const kind of findSecrets(readFileSync(f, 'utf8')))
        hits.push(`${relative(root, f)}: ${kind}`);
    }
  if (hits.length) {
    console.error(`Secrets in the client bundle:\n  ${hits.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`scan-client-bundle: ${scanned} files clean`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
