# Branching Strategy

> The baseline rule for environments and releases is
> **[docs/ENVIRONMENTS_AND_RELEASES.md](docs/ENVIRONMENTS_AND_RELEASES.md)**. This page summarises how to work with branches under that rule.

## Long-lived branches

| Branch | Environment | Deploy |
| --- | --- | --- |
| `main` | **prod** | AWS Amplify, automatically on push. semantic-release tags `vX.Y.Z`. |
| `development` | **dev**, the live test environment | AWS Amplify, automatically on push |

There is **no `staging` branch**, no QA environment and no PR preview environment. Testing happens on **dev**.

## Short-lived branches

| Prefix | From | PR into | Example |
| --- | --- | --- | --- |
| `feature/` | `development` | `development` | `feature/plucking-save-next` |
| `fix/` | `development` | `development` | `fix/round-total-rounding` |
| `chore/`, `docs/`, `refactor/`, `test/`, `ci/` | `development` | `development` | `chore/env-release-baseline` |
| `hotfix/` | `main` | `main`, then merge `main` → `development` | `hotfix/tenant-auth-check` |

Where possible, include the issue number in the branch name: `feature/53-save-and-next`.

## Pull requests

- **Into `development`:** squash merge is allowed. The PR title must be a Conventional Commit (`feat(plucking): save & next capture`) because it becomes the commit message.
- **`development` → `main` (release PR):** use a **merge commit**, never squash, so semantic-release can read every commit.
- Every PR needs green CI: lint, type-check, unit tests, build, E2E (on a local build) and the security audit.
- Link the issue with `Closes #NN`.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), enforced by commitlint:

```
feat(sales): calculate sale total from size lines
fix(inventory): prevent duplicate HARVEST_IN on retry
docs: add DynamoDB access-pattern ADR
feat(auth)!: require tenant membership on every resolver   # major bump
```

`feat` gives a minor release, `fix`/`perf` a patch, and `!` or `BREAKING CHANGE:` a major release. Other types don't trigger a release.

## Environment files

| File | Purpose |
| --- | --- |
| `.env.example` | Documents every variable |
| `.env.development` | Defaults for local `next dev` |
| `.env.production` | Shape of production variables, with no secrets |
| `.env.local` | Your machine only (gitignored) |

Real values for dev and prod are set **per branch in the Amplify console**. Never commit secrets.
