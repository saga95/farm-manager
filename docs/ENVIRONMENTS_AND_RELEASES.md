# Environments & Releases — Project Baseline Rule

> **This is a baseline rule for the whole project and for every contributor, human or AI.**
> If any other document or template file disagrees with this one, this one wins.

## The rule

1. **There are exactly two environments: `dev` and `prod`.** Both are hosted on **AWS Amplify Gen 2**, frontend and backend.
2. **Do not create extra environments for testing.** That means no staging, no QA environment, no PR preview environments, and no long-lived personal sandboxes. We test directly on the live **dev** environment.
3. **Every push deploys its branch automatically.**
   - Push to `development` → updates **dev**
   - Push to `main` → updates **prod**
4. **Releases to prod are managed by [semantic-release](https://semantic-release.gitbook.io/).** Version numbers, git tags and GitHub Releases are generated from [Conventional Commits](https://www.conventionalcommits.org/). Nobody edits version numbers by hand.
5. **The backend is shared by every client.** The same Amplify backend (Cognito, AppSync/GraphQL, DynamoDB, S3) will serve the Next.js web/PWA now and a native mobile app later. Business rules belong in the backend and domain layer, never in a web-only place (SRS PR-010, §26.6).

## Branches → environments

| Branch                                    | Environment                     | Deploys                                                                      | Who pushes                                      |
| ----------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------- |
| `development`                             | **dev** (live test environment) | Amplify, automatically on every push                                         | Merged PRs from `feature/*`, `fix/*`, `chore/*` |
| `main`                                    | **prod**                        | Amplify, automatically on every push; semantic-release then tags the release | Merged PR from `development` (release PR)       |
| `feature/*`, `fix/*`, `chore/*`, `docs/*` | none                            | Not deployed. CI runs quality gates only.                                    | Contributors                                    |
| `hotfix/*`                                | none                            | Branch from `main` → PR to `main`, then merge `main` back into `development` | Maintainers                                     |

There is **no `staging` branch** and no preview deployment for pull requests.

## Flow

```
feature/x ──PR──▶ development ──(push)──▶ Amplify dev   ← test here
                       │
                       └──release PR──▶ main ──(push)──▶ Amplify prod
                                          └──▶ semantic-release: vX.Y.Z tag + GitHub Release
```

1. Branch from `development` and open a PR back to `development`.
2. CI must pass: lint, type-check, unit tests, build, E2E (against a local build, never a deployed environment).
3. Merge. Amplify builds and deploys **dev**. Test there.
4. When dev is ready to ship, open a PR from `development` to `main` and merge it with a **merge commit**. Do not squash, so semantic-release sees every Conventional Commit.
5. Amplify deploys **prod**. The `Release` job in CI runs semantic-release, which creates the version tag and the GitHub Release notes.

## Versioning

| Commit type                                              | Release           |
| -------------------------------------------------------- | ----------------- |
| `fix:`, `perf:`                                          | patch (0.1.**1**) |
| `feat:`                                                  | minor (0.**2**.0) |
| `feat!:` or a `BREAKING CHANGE:` footer                  | major             |
| `docs:`, `chore:`, `refactor:`, `test:`, `ci:`, `style:` | no release        |

- Releases start from the baseline tag `v0.0.0`, so the product stays on **0.x** while V1 is being built.
- Cut **`v1.0.0`** deliberately when the SRS "Definition of V1 Done" (§34, §41.17) is met. Do it with a commit that has a `BREAKING CHANGE:` footer such as "V1 go-live".
- Release notes live in **GitHub Releases**. semantic-release does **not** commit back to `main`, so `main` and `development` never diverge because of release commits. `package.json`'s `version` is intentionally a placeholder.
- Commit messages are enforced by commitlint (Husky `commit-msg` hook).

## Amplify setup (one-time, done by a maintainer)

1. Amplify console → **Create app → GitHub → `saga95/farm-manager`**.
2. Connect **two branches only**: `main` (prod) and `development` (dev). Leave **auto-build on** and **PR previews off**.
3. Keep **branch auto-detection off**, so no other branch ever gets an environment.
4. Build settings come from [`amplify.yml`](../amplify.yml). The backend phase runs `ampx pipeline-deploy --branch $AWS_BRANCH`, so each branch gets its own backend stack (dev Cognito pool, dev tables, and so on).
5. Set environment variables per branch in the Amplify console. Never commit secrets.
6. Optional: custom domains such as `dev.<domain>` → `development` and `<domain>` → `main`.

## Environment detection in code

`src/lib/env.ts` → `getEnvironment()` returns only `'development' | 'production'`, based on Amplify's `AWS_BRANCH` (exposed as `NEXT_PUBLIC_AWS_BRANCH`). Use `isProduction()` / `isDevelopment()`. Never read `process.env` directly.

## How dev and prod are used

- **dev** (`development`) is the live test environment **and the demo environment** shown to prospective users. Demo data lives in its own demo tenant, never mixed with real farm data.
- **prod** (`main`) is the product owner's production. The first prod release is cut after a successful test run on dev.

## Deployment topologies (note for the future)

The default is **one shared, multi-tenant deployment**: one Amplify app with `development` and `main`, where each customer is a **tenant**.

A customer may later need a **dedicated deployment**:

| Option                                               | What it is                                                                             |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Separate Amplify app, **our** AWS account            | A new Amplify app connected to this repo, with its own backend (Cognito, DynamoDB, S3) |
| Separate Amplify app, **the customer's** AWS account | The same, created in their account. Resources can move there later.                    |

Rules for dedicated deployments:

- Each one is a **prod environment for that customer**. It is still tested on our dev first, and we add **no** extra test environments for it.
- It runs the **same code**. The multi-tenant model doesn't change; a dedicated deployment simply holds one tenant (or a few).
- It tracks released code only: `main`, or a customer branch fast-forwarded to a semantic-release tag `vX.Y.Z`.

To keep the code portable, every contributor must:

- Never hardcode AWS account IDs, regions, Amplify app IDs, domains or resource names. Use Amplify-generated names, `amplify_outputs.json` and per-branch environment variables.
- Keep every record tenant-scoped (`tenantId`), so a tenant's data can be exported and moved on its own.
- Keep S3 keys tenant-prefixed (`tenants/{tenantId}/…`, SRS §26.4), so media can be copied per tenant.
- Plan data moves as **DynamoDB export/import plus S3 copy per tenant**. **Cognito users can't be moved with their passwords**, so a move needs either a password reset or a user-migration Lambda trigger.
- Enable backups (DynamoDB point-in-time recovery) before onboarding any external tenant or dedicated customer (SRS §25.4).

## What contributors must not do

- Add a `staging`, `qa`, `test` or preview environment, branch or Amplify app
- Run a deployed environment from your own branch (`ampx sandbox` is not part of our workflow)
- Push straight to `main`, or edit versions, tags or release notes by hand
- Squash-merge the release PR from `development` to `main`
- Put business rules only in web pages, where the mobile app couldn't use them
