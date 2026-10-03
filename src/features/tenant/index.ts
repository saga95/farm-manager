/**
 * Feature: tenant
 * Tenant, TenantMember, roles and tenant context. Tracked in Epic 1 (#9).
 */
export { TenantProvider, useTenant, ME_QUERY_KEY } from './TenantProvider';
export type { TenantContextValue } from './TenantProvider';
export { AppGate, GateLoading } from './components/AppGate';
export {
  pickTenant,
  decideGate,
  safeRedirect,
  TENANT_STORAGE_KEY,
} from './selection';
