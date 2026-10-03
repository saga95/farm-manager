/**
 * Tenant-scoped RBAC domain (ADR-0001, #121): users → profiles → roles → entitlements.
 * Pure TypeScript, shared by Amplify handlers, the web UI and the future mobile app.
 */
export * from './entitlements';
export * from './types';
export * from './defaults';
export * from './resolve';
export * from './guards';
export { buildTenantRbac, seedDefaultRbac } from './seed';
