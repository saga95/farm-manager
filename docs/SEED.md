# Validation dataset (seed)

The SRS §33 validation dataset (#24) is loaded into **live dev** through the app's own API, signed in as a real user. The seed obeys every rule a person using the app does, and it needs no AWS write access. There is no separate test environment (see [ENVIRONMENTS_AND_RELEASES.md](ENVIRONMENTS_AND_RELEASES.md)).

## What it creates

| Tenant                     | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A**, "Validation Farm A" | Farm "Home farm" with a Coconut Area and a Polytunnel zone (space "Tunnel 1") · 50 producing trees C-001…C-050 · 7 past plucking rounds, Jan–Sep 2026 (the last 2 are still in stock) · dehusked samples from the last 3 rounds, where each tree leans to a size · 3 buyers (restaurant prefers Medium, wholesaler takes any size, shop prefers Large) · 6 past sales · 3 farm inputs (one with usage) · an active chilli cycle with 4 activities and 2 harvests |
| **B**, "Validation Farm B" | Farm "Hill block" · 10 trees C-001…C-010 (the same codes as A, on purpose) · 2 rounds · 1 buyer · 1 sale                                                                                                                                                                                                                                                                                                                                                         |

- **Fixed dates and quantities.** All dates are fixed calendar dates in 2026, and quantities come from a fixed pseudo-random sequence. Every run produces the same data, so predictions and reports can be checked against known numbers.
- **Safe to rerun.** Ids are derived from the signed-in user, so two people seeding never collide. A second run skips what already exists and adds nothing. `amplify/functions/farm-api/__tests__/seed.test.ts` checks this on every PR.

## Running it against dev

1. **Get dev's client config** (`amplify_outputs.json` for the `development` branch). Use either:

   - the Amplify console: app → `development` → Deployed backend resources → Download amplify_outputs.json; or
   - `npx ampx generate outputs --app-id d2tkbaot482mat --branch development --out-dir ./.seed`, using a profile with CloudFormation read access.

   Keep the file out of git. `.seed/` is ignored.

2. **Seed tenant A** with the first test account:
   ```sh
   SEED_EMAIL=… SEED_PASSWORD=… pnpm seed --tenant A --outputs .seed/amplify_outputs.json
   ```
3. **Seed tenant B** with the second account, so isolation is checked between two different users:
   ```sh
   SEED_EMAIL=… SEED_PASSWORD=… pnpm seed --tenant B --outputs .seed/amplify_outputs.json
   ```

The account becomes Owner of the new validation tenant. Switch to it in the app from the tenant menu. The account's other farms are left untouched.

Use accounts **other than** the live E2E accounts ([E2E_DEV_LIVE.md](E2E_DEV_LIVE.md)). A second farm on an E2E account could change which farm the app opens by default, and that would break the journeys.

**Never run the seed against prod.** Prod holds real farms only.

## Adding to the dataset

When a feature adds an entity, add it to `scripts/seed/dataset.ts`:

- use a fixed date;
- use an id from `id('<kind>:<key>')`;
- create it through `src/lib/api.ts`.

Then extend the test.
