# ADR-0001: Tenant authorization with tenant-defined RBAC

- **Status:** Accepted (2026-10-03)
- **Issues:** #18, #121 · **SRS:** PR-003, §4.3, AC-TN-001..004, DQ-010, US-026/027

## Context

- Every business record belongs to a tenant. A user from Tenant A must be refused Tenant B data **even if they know the record ID** (AC-TN-001).
- Access is **users → profiles → roles → entitlements**, **scoped per tenant**. Tenants **define their own roles and profiles**. OWNER, FARM_HELPER, MEMBER and VIEWER are only seeded defaults (PO decision, #27, #121).
- The same backend must serve the web/PWA now and a native mobile app later (PR-010).

Amplify Data's built-in model rules (`allow.owner()`, `allow.group()`, `allow.authenticated()`) are **static**. They can't express "this user holds `sale.record` in _this_ tenant through a profile the tenant edited yesterday". Cognito groups are global, not per tenant, and are limited in number.

## Decision

1. **Cognito authenticates; the application authorizes.**
   - Cognito proves _who_ the user is (`sub`).
   - Every tenant-scoped operation is decided on the server from data, never from client claims.
2. **The API surface is custom AppSync operations backed by TypeScript Lambda handlers**, defined in the Amplify schema with `a.query()` / `a.mutation()` and `.handler(a.handler.function(fn))`.
   - Clients get **no direct model CRUD** on business data. The template's e-commerce `a.model`s and public API-key access are removed.
   - Every operation's arguments include a `tenantId`, which is treated as a **claim to be verified**, not as trusted input.
3. **Every handler starts with one guard** (`authorize`):
   ```text
   sub (from AppSync identity)
     → TenantMember(tenantId, sub)       must exist and be ACTIVE, else FORBIDDEN
     → Profile(profileId)                must be ACTIVE
     → Roles(roleIds)                    ACTIVE roles only
     → entitlements = ∪ role.entitlements
     → require(operation.entitlement ∈ entitlements), else FORBIDDEN
   ```
   - The resolved context (`tenantId`, `userId`, `entitlements`) is the **only** source of tenant scope for the rest of the handler. All DynamoDB keys are built from it (ADR-0002), so no request can address another tenant's partition.
   - A record fetched by ID is checked again: `item.tenantId === ctx.tenantId`, else NOT_FOUND. The error is the same as for a missing record, so it doesn't reveal that the record exists.
4. **Entitlements are a system catalogue in code** (`src/domain/rbac/entitlements.ts`, versioned). **Roles and profiles are tenant data** in DynamoDB.
   - Entitlement names follow the pattern `area.action`, e.g. `harvest.record`, `member.manage`. The full list is in #121.
   - Each operation declares exactly one required entitlement next to its handler. A unit test asserts that every operation declares one.
5. **Guardrails, enforced on the server:**
   - **No lock-out:** a tenant always keeps at least one ACTIVE member whose profile holds `tenant.manage` **and** `member.manage`. Edits that would break this are rejected.
   - **No escalation:** a member can only grant, in a role or profile they edit or assign, entitlements they hold themselves.
   - The built-in OWNER profile can't be deleted. System defaults can be cloned and edited, but not hard-deleted.
   - Every change to roles, profiles or member assignments writes an AuditLog entry (§31).
6. **Resolution and caching:**
   - Resolve per request. That's three small DynamoDB reads with predictable keys, batched with `BatchGetItem`.
   - An in-memory per-container cache with a **60 s TTL** is allowed. It is keyed by `tenantId#sub` and carries a `rbacVersion`. Any role, profile or member change bumps `Tenant.rbacVersion`, and a version mismatch invalidates the cache, so permissions apply on the member's next request.
7. **The RBAC engine is pure TypeScript** in `src/domain/rbac`, with no React, Amplify or AWS SDK imports (enforced by ESLint). The Lambda handlers, the web UI and the future mobile app share it.
   - The UI uses the same resolved entitlements (returned by `me { tenants { entitlements } }`) **only to show or hide controls**. It is never the security boundary.
8. **Tenant creation** (`createTenant`) is the only tenant-scoped operation that doesn't require membership. It creates the Tenant, seeds the default roles and profiles, and adds the caller as an OWNER member, all in one `TransactWriteItems`.

## Consequences

- ✅ Tenant isolation is **structural** (keys come from the verified context) **and explicit** (a check after every read).
- ✅ Tenant-defined profiles work without schema changes, and new entitlements only need a code release.
- ✅ The same API and rules serve the mobile app.
- ⚠️ More code than Amplify's declarative rules: every operation needs a handler and a test. This is reduced by a shared `defineOperation({ entitlement, input: zod, handler })` wrapper that does auth, validation and errors in one place.
- ⚠️ Lambda cold starts add roughly 200–600 ms to the first call. Use arm64, keep bundles small, and consider provisioned concurrency later if field use needs it.
- ⚠️ Real-time subscriptions are not available out of the box with custom operations. That's acceptable, because V1 doesn't need them.
- **Testing:** unit tests for resolution, lock-out and escalation guards; integration tests where Tenant A's user calls every operation with Tenant B IDs and must get FORBIDDEN or NOT_FOUND (E2E-012).

## Alternatives considered

| Option                                                                | Why not                                                                                                              |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Amplify model rules + Cognito groups per tenant (`tenant_<id>_owner`) | Groups are global and limited; tenant-defined profiles are impossible; role edits need Cognito admin calls           |
| Owner/`allow.ownersDefinedIn('memberIds')` on models                  | Gives membership only, not entitlements; leaks list operations across tenants that share a user; no escalation guard |
| AppSync JS pipeline resolvers                                         | Tenant-scoped RBAC logic in AppSync JS can't share the TypeScript domain package or its tests; harder to debug       |
