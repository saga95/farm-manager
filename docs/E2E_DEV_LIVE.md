# Signed-in E2E against live dev (#128)

The CI E2E suite (`e2e/`) runs against a local build with no backend, so it can only check signed-out pages. The signed-in journeys (`e2e-live/`) run against the **live dev** environment. That follows the baseline rule in [ENVIRONMENTS_AND_RELEASES.md](ENVIRONMENTS_AND_RELEASES.md): no separate test environment.

## What it covers

| Spec | Scenarios |
| --- | --- |
| `auth.setup.ts` | Sign-in, and first-run setup of the test farm (E2E-001). |
| `journey.spec.ts` (phone viewport) | Register 50 trees on the first run (E2E-002). A 9-tree round with Save & Next (E2E-003). Completing it adds exactly its total to stock (E2E-004). One sample per tree (E2E-005). Tree profile and prediction card (E2E-006/007). A Medium-preferring buyer and a sale (E2E-008). Stock goes down, then cleanup (E2E-009). |
| `polytunnel.spec.ts` | A cucumber cycle and a 12.5 kg harvest (E2E-010), sold through Sales (E2E-011). |
| `isolation.spec.ts` | Account A cannot open account B's tree (E2E-012). |

Every run cleans up after itself. It removes its sale and round, archives its buyer, and cancels its cycle. The trees and the polytunnel zone are created once and then reused.

## One-time setup (maintainer)

1. On **dev** (https://development.d2tkbaot482mat.amplifyapp.com), use **Create an account** to make two accounts with addresses you control. For example:
   - `you+e2e-a@gmail.com`
   - `you+e2e-b@gmail.com`
2. Confirm each one with the emailed code. Each account gets its own "E2E farm" on the first run, separate from your real farm and from the demo.
3. In GitHub, go to **Settings → Secrets and variables → Actions** and add:
   - `E2E_DEV_EMAIL` and `E2E_DEV_PASSWORD` for account A;
   - `E2E_DEV_EMAIL_B` and `E2E_DEV_PASSWORD_B` for account B.
4. Run **Actions → E2E (dev live) → Run workflow**. It also runs every night at 03:00 Sri Lanka time.

Until the secrets exist, every test is **skipped**, not failed.

## Running locally

```bash
E2E_DEV_EMAIL=… E2E_DEV_PASSWORD=… E2E_DEV_EMAIL_B=… E2E_DEV_PASSWORD_B=… pnpm test:e2e:live
# optional: E2E_BASE_URL=http://localhost:3000 to point at a local app
```

Reports go to `playwright-report-live/`. Sessions are stored in `e2e-live/.auth/`, which is git-ignored.

## Not a merge gate

Dev deploys **after** a merge, so this suite can't block one. A nightly failure means dev itself has a problem. Fix it on `development` before it is promoted to `main`.
