# Contributing to Farm Manager (My Smart Need AgriTech)

> **Baseline rule — read first:** [docs/ENVIRONMENTS_AND_RELEASES.md](docs/ENVIRONMENTS_AND_RELEASES.md).
> There are two environments, **dev** (`development`) and **prod** (`main`), both on AWS Amplify. Each push deploys its branch.
> Never create extra environments for testing; we test on dev. Prod releases are versioned by semantic-release.

Product requirements: SRS v1.1 (linked from the epics). Work is tracked in the
[Farm Manager V1 project](https://github.com/users/saga95/projects/1) as epics #8–#17 and their sub-issues.

## Development Setup

```bash
git clone https://github.com/saga95/farm-manager.git
cd farm-manager
nvm use            # Node 20 (see .nvmrc)
pnpm install
cp .env.example .env.local

# Point the local app at the live dev backend (no sandboxes):
AMPLIFY_APP_ID=<amplify-app-id> pnpm amplify:outputs:dev

pnpm dev
```

## Git Workflow

| Branch | Purpose | Deploys to |
| --- | --- | --- |
| `main` | Released code | **prod** (Amplify) + semantic-release tag |
| `development` | Integration; live testing | **dev** (Amplify) |
| `feature/*`, `fix/*`, `chore/*`, … | Work in progress | not deployed |

Full details are in [BRANCHING_STRATEGY.md](BRANCHING_STRATEGY.md).

```bash
git checkout development && git pull
git checkout -b feature/53-save-and-next

pnpm lint && pnpm type-check && pnpm test

git commit -m "feat(plucking): save & next capture"
git push -u origin feature/53-save-and-next
# Open a PR into development and include "Closes #53"
```

### Commit Convention

[Conventional Commits](https://www.conventionalcommits.org/) are **required**. commitlint enforces them, and semantic-release uses them to version prod.

| Prefix | Usage | Release |
| --- | --- | --- |
| `feat:` | New feature | minor |
| `fix:` / `perf:` | Bug fix / performance | patch |
| `feat!:` or `BREAKING CHANGE:` | Breaking change | major |
| `docs:` `style:` `refactor:` `test:` `chore:` `ci:` `revert:` | Everything else | none |

Use a scope that matches the feature area: `tenant`, `farm`, `coconut`, `plucking`, `sample`, `prediction`, `inventory`, `sales`, `polytunnel`, `analytics`, `media`, `platform`, `ux`.

### Releasing to prod

1. Make sure dev has been tested.
2. Open a PR from `development` to `main` and merge it with a **merge commit**.
3. Amplify deploys prod. The CI `Release` job tags `vX.Y.Z` and publishes GitHub Release notes.

## Coding Standards

1. **TypeScript strict mode** — No `any` types. Use `unknown` when type is truly unknown.
2. **ESLint + Prettier** — Pre-commit hooks enforce these. Run `pnpm lint` before committing.
3. **Accessibility** — All interactive elements must meet WCAG 2.2 AA.
4. **i18n** — All user-facing text must use `useTranslation()`. Add keys to `public/locales/en/*.json`.
5. **Environment variables** — Use `getEnvVar()` / `getRequiredEnvVar()` from `src/lib/env.ts`.
6. **Logging** — Use `logger` from `src/lib/logger.ts` instead of `console.log`.
7. **SEO** — New pages must use `generatePageMeta()` from `src/lib/seo.ts`.
8. **Tests** — Minimum 70% coverage for new code. Place tests in `__tests__/` adjacent to the code.

## Testing

```bash
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # With coverage report
```

Tests should cover:

- Component rendering and user interactions
- Hook behavior and edge cases
- Utility function inputs/outputs
- Error scenarios

## Quality Checks

All PRs must pass these checks (enforced by CI):

```bash
pnpm lint              # ESLint (includes a11y rules)
pnpm type-check        # TypeScript strict checking
pnpm test              # Jest (70% coverage threshold)
pnpm build             # Production build succeeds
```

## Adding a New Page

1. Create the page in `src/pages/`
2. Add SEO metadata using `generatePageMeta()` from `src/lib/seo.ts`
3. Add translations to `public/locales/en/*.json`
4. Add navigation entry if needed
5. Write tests in `__tests__/`

## Adding a New Component

1. Place in `src/components/`
2. Use Material UI components with the project theme
3. Include TypeScript interface for props
4. Ensure accessibility (keyboard navigation, screen reader support)
5. Write unit tests in `__tests__/`

## Questions?

Open an issue with the `question` label.
