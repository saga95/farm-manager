/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OPERATIONS } from '../operations';

// Guard: every custom operation in the Amplify schema must be routed by farm-api
// (otherwise it would fail closed at runtime with "Unknown operation").
describe('operation registry', () => {
  it('routes every schema operation backed by farm-api', () => {
    const schema = readFileSync(
      join(__dirname, '../../../data/resource.ts'),
      'utf8'
    );
    const declared = [
      ...schema.matchAll(/^\s{2}(\w+): a\s*\n?\s*\.(?:query|mutation)\(\)/gm),
    ].map(m => m[1]);
    expect(declared.length).toBeGreaterThan(0);
    expect(declared.filter(name => !OPERATIONS[name!])).toEqual([]);
  });
});
