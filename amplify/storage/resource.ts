import { defineStorage } from '@aws-amplify/backend';

/**
 * Private media bucket (ADR-0003).
 *
 * No public, guest or identity paths: clients never get bucket credentials.
 * Every object lives under `tenants/{tenantId}/…` and is reached only through
 * presigned URLs issued by farm-api after its tenant + entitlement checks.
 * farm-api's IAM access is granted in amplify/backend.ts (inside the data
 * stack, which avoids a storage ↔ data dependency cycle).
 */
export const storage = defineStorage({
  name: 'appStorage',
});
