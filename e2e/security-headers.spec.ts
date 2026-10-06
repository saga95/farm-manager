import { expect, test } from '@playwright/test';

// Regression (#107): the template CSP had connect-src 'self', which blocked
// Cognito sign-in, AppSync and S3 uploads in real browsers.
test('the CSP lets the app reach Cognito, AppSync and S3', async ({
  request,
}) => {
  const res = await request.get('/auth/login');
  const csp = res.headers()['content-security-policy'] ?? '';
  const connect =
    csp
      .split(';')
      .map(s => s.trim())
      .find(d => d.startsWith('connect-src')) ?? '';
  expect(connect).toContain('https://cognito-idp.');
  expect(connect).toContain('appsync-api.');
  expect(connect).toContain('.s3.');
  expect(res.headers()['x-frame-options']).toBe('DENY');
});
