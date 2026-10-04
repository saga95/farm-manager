# ADR-0005: One Amplify data schema per bounded context

- **Status:** Accepted (2026-10-04)
- **Issues:** #80, #81 (the change that hit the limit)

## Context

Every operation is a custom AppSync query or mutation backed by farm-api (ADR-0001). When everything lived in one `a.schema({...})`, the farm-input operations pushed Amplify's generic types past TypeScript's instantiation-depth limit:

```text
TS2589: Type instantiation is excessively deep and possibly infinite
```

This failed in two places:

- `amplify/data/resource.ts`, at `a.schema(` itself;
- the web client's `generateClient<Schema>()`.

Amplify type-checks the backend during deploy, so a single schema puts a hard ceiling on growth.

## Decision

1. **Schemas.** `amplify/data/resource.ts` defines **one `a.schema` per bounded context** and combines them with `a.combine([...])` (up to 50).
   - `schema`: tenancy, farm, trees, plucking, samples, history, media.
   - `stock`: produce inventory and farm inputs.
   - New contexts get their own schema: sales and buyers next, then polytunnel.
2. **Refs stay local.** An `a.ref('X')` may only refer to a type in the **same** schema. A type that two contexts need belongs to the context that owns it, and the operations that return it move there too.
3. **The web client is untyped at the schema level** (`generateClient()` without a generic). Response shapes are declared in `src/lib/api.ts`, as they already were for almost every call.
4. **Guard rails:**
   - `registry.test.ts` checks that every declared operation (in any schema) is routed by farm-api.
   - Rendering the combined schema to SDL (each `schema.transform()`) must give one definition per type.

## Consequences

- ✅ Type-check cost grows per context instead of per operation, and the deploy-time backend type-check stays green.
- ✅ The boundaries match the domain modules in `src/domain/*`.
- ⚠️ The client gets no compile-time guarantee that a call's variables match the schema. Server-side zod validation and the operation tests cover this. A mismatch surfaces as a `VALIDATION:` error, not as a silent failure.
- ⚠️ Moving a type between contexts means moving the operations that reference it too.
