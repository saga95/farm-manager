# My Smart Need AgriTech — Farm Manager

A multi-tenant, mobile-first **Smart Farm & Garden Management** platform for small farms and home gardens.

V1 replaces WhatsApp-based record keeping with structured farm memory:

- **Coconut** — register trees, run plucking rounds with per-tree photo and count ("Save & Next"), record dehusked samples and their size history, and get an explainable next-plucking estimate.
- **Polytunnel and grouped crops** — production cycles of 100–300 plants, maintenance activities, and repeated harvests by count or weight.
- **Inventory and sales** — produce stock built from transactions (husked and dehusked), farm-input stock, buyers with size preferences, and size-line sales that record both the calculated and the actually received amount.
- **Tenant-safe from day one** — every record is isolated per tenant and checked on the server.

The first tenant is the product owner's one-acre farm in Sri Lanka.

## Status & planning

| | |
| --- | --- |
| Requirements | SRS v1.1 — final V1 development handover |
| Tracking | [Farm Manager V1 project board](https://github.com/users/saga95/projects/1) |
| Epics | #8 Setup · #9 Tenant & Farm · #10 Coconut Registry · #11 Plucking · #12 Samples · #13 Prediction · #14 Inventory · #15 Buyers & Sales · #16 Polytunnel · #17 Analytics & Hardening |

## Environments & releases (baseline rule)

| Branch | Environment | How it deploys |
| --- | --- | --- |
| `development` | **dev**, the live test environment | AWS Amplify, on every push |
| `main` | **prod** | AWS Amplify, on every push; semantic-release tags `vX.Y.Z` |

There are no other environments: no staging, previews or sandboxes. Read **[docs/ENVIRONMENTS_AND_RELEASES.md](docs/ENVIRONMENTS_AND_RELEASES.md)** before contributing.

## Tech stack

Next.js 14 (Pages Router) · React 18 · TypeScript (strict) · Material UI v6 · React Query · React Hook Form + Zod · i18next ·
AWS Amplify Gen 2 (Cognito, AppSync/GraphQL, DynamoDB, S3) · Jest · Playwright.

The backend is designed so that a future native mobile app can reuse it unchanged.

## Getting started

```bash
nvm use                                        # Node 20
pnpm install
cp .env.example .env.local
AMPLIFY_APP_ID=<id> pnpm amplify:outputs:dev   # connect to the dev backend
pnpm dev                                       # http://localhost:3000
```

| Command | Purpose |
| --- | --- |
| `pnpm lint` / `pnpm type-check` | Code quality |
| `pnpm test` / `pnpm test:coverage` | Unit tests (Jest) |
| `pnpm test:e2e` | E2E tests (Playwright, against a local build) |
| `pnpm quality` | Every check CI runs |

## Project structure

```
amplify/            Amplify Gen 2 backend (auth, data, storage, functions)
design-system/      Design tokens → MUI theme (source of truth for UI)
src/
  features/<area>/  Feature modules (tenant, farm, coconut, plucking, …)
  domain/           Pure business rules shared by web and mobile
  components/       Shared UI components
  pages/            Next.js routes (thin; no business rules)
ux-docs/            Personas, IA, flows, wireframes
docs/               ADRs, environment rule, technical docs
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [BRANCHING_STRATEGY.md](BRANCHING_STRATEGY.md). Commits follow
[Conventional Commits](https://www.conventionalcommits.org/); semantic-release uses them to version prod.

## License

[MIT](LICENSE)
