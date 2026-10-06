/* eslint-disable no-console -- command-line tool: output is the interface */
/**
 * Seed the validation dataset (#24) into a deployed environment through its
 * API, signed in as a real user. See docs/SEED.md.
 *
 *   SEED_EMAIL=… SEED_PASSWORD=… pnpm seed -- --tenant A --outputs ./dev_outputs.json
 */

import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { Amplify, type ResourcesConfig } from 'aws-amplify';
import { fetchAuthSession, signIn, signOut } from 'aws-amplify/auth';
import { type SeedTenant, seed } from './dataset';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

async function main() {
  // Amplify Auth needs Web Crypto (global from Node 19; Node 18 has it here)
  if (!globalThis.crypto)
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto });

  const tenant = (arg('tenant', 'A') ?? 'A').toUpperCase() as SeedTenant;
  if (tenant !== 'A' && tenant !== 'B')
    throw new Error('--tenant must be A or B');
  const outputsPath = arg('outputs', 'amplify_outputs.json')!;
  const outputs = JSON.parse(readFileSync(outputsPath, 'utf8')) as {
    auth?: unknown;
    data?: { url?: string };
  };
  if (!outputs.auth || !outputs.data?.url)
    throw new Error(
      `${outputsPath} has no auth/data config. Use the environment's outputs (docs/SEED.md).`
    );
  const email = process.env['SEED_EMAIL'];
  const password = process.env['SEED_PASSWORD'];
  if (!email || !password) throw new Error('Set SEED_EMAIL and SEED_PASSWORD');

  Amplify.configure(outputs as ResourcesConfig);
  await signOut().catch(() => undefined);
  const { isSignedIn, nextStep } = await signIn({ username: email, password });
  if (!isSignedIn)
    throw new Error(`Sign-in needs another step: ${nextStep.signInStep}`);
  const userId = (await fetchAuthSession()).userSub;
  if (!userId) throw new Error('Signed in but no user id');

  console.log(`Seeding tenant ${tenant} at ${outputs.data.url} as ${email}`);
  const result = await seed({
    tenant,
    userId,
    log: line => console.log(`  ${line}`),
  });
  console.log(
    `Done: ${result.applied} steps applied, ${result.skipped} already there. Tenant ${result.tenantId}`
  );
}

main().catch((e: unknown) => {
  console.error(`Seed failed: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
