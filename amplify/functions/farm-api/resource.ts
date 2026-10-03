import { defineFunction } from '@aws-amplify/backend';

/**
 * farm-api: single Lambda behind every custom AppSync operation (ADR-0001).
 * Routes on `event.info.fieldName`; every operation authorizes against the
 * tenant-scoped RBAC engine in src/domain/rbac before touching data.
 *
 * Grouped with the `data` stack: it is an AppSync data source and owns the
 * FarmData table (see amplify/backend.ts), which avoids cross-stack cycles.
 */
export const farmApi = defineFunction({
  name: 'farm-api',
  entry: './handler.ts',
  runtime: 22,
  architecture: 'arm64',
  memoryMB: 512,
  timeoutSeconds: 15,
  resourceGroupName: 'data',
});
