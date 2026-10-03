# Domain layer

Pure TypeScript business rules from the SRS. They must be reusable by:

- the Next.js web/PWA client,
- Amplify backend functions (resolvers), and
- a future native mobile client (SRS PR-010, §26.2, §26.6).

## Rules

- **No framework imports.** `react`, `next`, `@mui/*`, `@emotion/*`, `aws-amplify`, `@aws-amplify/*` and
  `@tanstack/*` are blocked by ESLint inside `src/domain/**`.
- **Pure functions** with explicit inputs and outputs. No I/O, no `Date.now()` hidden inside: pass `today` in.
- **Versioned where results are user-visible.** For example, the prediction service exposes a `methodVersion` (§26.5, §41.8).
- **100% unit-tested.** Put tests in `__tests__/` next to the code.

## Expected modules

| Module        | SRS                | Examples                                 |
| ------------- | ------------------ | ---------------------------------------- |
| `tenant/`     | §4, PR-003         | role → permission checks                 |
| `coconut/`    | §7                 | tree code generation / validation        |
| `plucking/`   | §8, CALC-001..003  | round totals, tree yield summary         |
| `samples/`    | §9, CALC-008/009   | size history & distribution              |
| `prediction/` | §10, §41.8         | median interval, window, confidence      |
| `inventory/`  | §11, §41.9         | balance by state, dehusking conservation |
| `sales/`      | §13, CALC-011..014 | line amounts, calculated vs actual       |
