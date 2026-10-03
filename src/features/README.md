# Feature modules

One folder per product area. Each folder exposes a public API through `index.ts`.

```
src/features/<area>/
  index.ts        public API (the only import path for other code)
  types.ts        feature types (view models, inputs)
  repository.ts   data access (Amplify Data client); nothing else talks to the backend
  hooks.ts        React Query hooks wrapping the repository
  components/     feature UI (MUI + design tokens + i18n)
  __tests__/
```

| Folder | Scope | Epic |
| --- | --- | --- |
| `tenant` | Tenant, members, roles, tenant context | #9 |
| `farm` | Farm, Zone, GrowingSpace | #9 |
| `coconut` | Tree registry & profile | #10 |
| `media` | Upload, thumbnails, signed access | #10 |
| `plucking` | Plucking rounds, Save & Next | #11 |
| `samples` | Dehusked samples, size history | #12 |
| `prediction` | Next-plucking estimate, planning | #13 |
| `inventory` | Produce & farm-input inventory | #14 |
| `buyers` | Buyers & size preferences | #15 |
| `sales` | Sales & sale lines | #15 |
| `polytunnel` | Production cycles, activities, generic harvests | #16 |
| `analytics` | Dashboard & analytics | #17 |

Rules:

- Pages in `src/pages/` stay **thin**: they compose feature components and contain no business rules.
- Business rules go in [`src/domain`](../domain/README.md), so the future mobile app can reuse them.
- Every query and mutation is tenant-scoped. Tenant authorization is enforced on the server, never only in the client (SRS PR-003).
- `todos/` is the template's reference example and will be removed once the first real feature lands.
