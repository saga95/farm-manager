/**
 * @jest-environment node
 */
import { findSecrets } from '../../../scripts/scan-client-bundle.mjs';

describe('client bundle secret scan (#107)', () => {
  it.each([
    ['AWS access key id', `const k="${'AKIA'}ABCDEFGHIJKLMNOP"`],
    ['private key', `-----BEGIN RSA ${'PRIVATE'} KEY-----`],
    ['GitHub token', `${'ghp'}_${'a'.repeat(36)}`],
    ['Stripe secret key', `${'sk_live'}_${'a'.repeat(24)}`],
    ['Google API key', `${'AIza'}${'b'.repeat(35)}`],
    ['LLM API key', `${'sk-ant'}-${'c'.repeat(30)}`],
    ['JWT', `eyJ${'a'.repeat(12)}.eyJ${'b'.repeat(12)}.${'c'.repeat(12)}`],
  ])('finds a %s', (kind, text) => {
    expect(findSecrets(text)).toContain(kind);
  });

  it('does not flag the public Amplify identifiers', () => {
    const outputs = JSON.stringify({
      auth: {
        user_pool_id: 'ap-southeast-1_AbCdEfGhI',
        user_pool_client_id: '4f8k2j1h9g7d6s5a3q0w2e4r6t',
        identity_pool_id: 'ap-southeast-1:0b6c9a1e-2d3f-4a5b-8c7d-9e0f1a2b3c4d',
      },
      data: {
        url: 'https://a3n3x64ou5h5fiznxlhieqywnu.appsync-api.ap-southeast-1.amazonaws.com/graphql',
      },
      storage: {
        bucket_name:
          'amplify-d2tkbaot482mat-de-appstoragebucket6cbf3fd8-rsqshoylapif',
      },
    });
    expect(findSecrets(outputs)).toEqual([]);
  });
});
