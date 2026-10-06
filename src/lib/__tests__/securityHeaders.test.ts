/**
 * @jest-environment node
 */
import {
  connectSources,
  contentSecurityPolicy,
} from '../../../security-headers.mjs';

describe('Content-Security-Policy (#107)', () => {
  const outputs = {
    auth: { aws_region: 'ap-southeast-1' },
    data: {
      url: 'https://abc123.appsync-api.ap-southeast-1.amazonaws.com/graphql',
      aws_region: 'ap-southeast-1',
    },
    storage: {
      aws_region: 'ap-southeast-1',
      bucket_name: 'amplify-farm-dev-appstorage-xyz',
    },
  };

  it('allows exactly what the app talks to: Cognito, AppSync and the private bucket', () => {
    const sources = connectSources(outputs);
    expect(sources).toEqual(
      expect.arrayContaining([
        "'self'",
        'https://cognito-idp.ap-southeast-1.amazonaws.com',
        'https://abc123.appsync-api.ap-southeast-1.amazonaws.com',
        'https://amplify-farm-dev-appstorage-xyz.s3.ap-southeast-1.amazonaws.com',
      ])
    );
    expect(sources).not.toContain('https://*.amazonaws.com');
  });

  it('regression: sign-in must not be blocked (connect-src was only self)', () => {
    const csp = contentSecurityPolicy({});
    const connect = csp.split('; ').find(d => d.startsWith('connect-src'))!;
    expect(connect).toContain(
      'https://cognito-idp.ap-southeast-1.amazonaws.com'
    );
    expect(connect).toContain('appsync-api.ap-southeast-1.amazonaws.com');
    expect(connect).toContain('.s3.ap-southeast-1.amazonaws.com');
    expect(csp).toContain("img-src 'self' data: blob: https:");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
