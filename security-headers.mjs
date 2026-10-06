/**
 * Content-Security-Policy for the app (#107).
 *
 * The browser talks to AWS directly: Cognito (sign-in), AppSync (all data)
 * and the private S3 bucket (presigned photo uploads). `connect-src 'self'`
 * blocked all of them (sign-in on dev failed with "Incorrect email or
 * password"), so the allowed hosts are built from the deployment's own
 * amplify_outputs.json - exact AppSync and bucket hosts - with a narrow
 * regional fallback when the file is a local stub.
 */

const DEFAULT_REGION = 'ap-southeast-1';

/** @param {any} outputs amplify_outputs.json (or a stub) */
export function connectSources(outputs) {
  const region =
    outputs?.auth?.aws_region ??
    outputs?.data?.aws_region ??
    outputs?.storage?.aws_region ??
    DEFAULT_REGION;
  const sources = new Set([
    "'self'",
    `https://cognito-idp.${region}.amazonaws.com`,
    `https://cognito-identity.${region}.amazonaws.com`,
  ]);
  const dataUrl = outputs?.data?.url;
  if (typeof dataUrl === 'string' && dataUrl.startsWith('https://')) {
    const host = new URL(dataUrl).host; // xxx.appsync-api.<region>.amazonaws.com
    sources.add(`https://${host}`);
    sources.add(`wss://${host.replace('appsync-api', 'appsync-realtime-api')}`);
  } else {
    sources.add(`https://*.appsync-api.${region}.amazonaws.com`);
    sources.add(`wss://*.appsync-realtime-api.${region}.amazonaws.com`);
  }
  const bucket = outputs?.storage?.bucket_name;
  if (typeof bucket === 'string' && bucket) {
    sources.add(`https://${bucket}.s3.${region}.amazonaws.com`);
    sources.add(`https://${bucket}.s3.amazonaws.com`);
  } else {
    sources.add(`https://*.s3.${region}.amazonaws.com`);
  }
  return [...sources];
}

/** @param {any} outputs */
export function contentSecurityPolicy(outputs) {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    // Presigned S3 photo URLs (https) and local previews of queued photos (blob:)
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSources(outputs).join(' ')}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}
