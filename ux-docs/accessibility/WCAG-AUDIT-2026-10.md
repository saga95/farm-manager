# Accessibility audit: WCAG 2.2 AA (October 2026)

Issue #109 · SRS v1.1 §25.5 · Audited by Aria (UX) on 2026-10-06.

## Scope and method

| What                                 | How                                                                                                             | Coverage                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Every signed-in screen and component | axe-core (WCAG 2.0/2.1/2.2 A and AA rules) over every Storybook story, light and dark, phone viewport (Pixel 7) | 108 stories × 2 themes = 216 checks                                       |
| Public pages                         | axe-core on the production build, light and dark, desktop and phone                                             | sign-in, sign-up, forgot password, confirm, offline, not found: 24 checks |
| Dialogs                              | Scanned in their open state; the full story page is scanned, so portalled dialogs are included                  | All dialog stories                                                        |

Both run in CI and fail the build on any violation:

- the Storybook job runs `pnpm test:a11y`;
- the E2E job runs `e2e/a11y.spec.ts`.

## Findings and fixes

| #   | Screen                                  | Rule (impact)                         | Problem                                                                                                                      | Fix                                                                                                                             |
| --- | --------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | SCR-009 New plucking round, tree picker | nested-interactive (serious)          | Each row was a button containing a checkbox, so screen readers announced two controls and the inner one couldn't be reached. | The row itself is now the checkbox (`role="checkbox"`, `aria-checked`, labelled by the tree code). The tick icon is decorative. |
| 2   | SCR-014/027 Reports, wide tables        | scrollable-region-focusable (serious) | The per-tree and per-buyer tables scroll sideways on a phone, but a keyboard user couldn't reach the hidden columns.         | The scroll area is a labelled region that can take focus, with a visible focus outline, so arrow keys scroll it (WCAG 2.1.1).   |
| 3   | Offline page                            | document-title (serious)              | No `<title>`, so the tab and screen readers had no page name.                                                                | Rebuilt on the new `StatusPage` component, which always sets the title.                                                         |
| 4   | Not found page (and server error)       | color-contrast (serious)              | The template page used a hardcoded grey (`#666`) that failed contrast in dark mode. It also had hardcoded English text.      | Rebuilt on `StatusPage`: theme colours from tokens, a `<main>` landmark, an h1, and translated text.                            |

No other violations were found:

- colour contrast passes in both themes on every story;
- every control and icon button has a name;
- form fields have labels;
- ARIA is valid;
- the landmark and heading checks pass.

## Checks covered by design rather than axe

- **Status is never shown by colour alone.**
  - Tree status, stock state, round state and sale state are chips with text labels.
  - Charts have a "Show as table" switch and text value labels.
  - Offline and pending states in the connection banner carry text.
- **Touch targets:** buttons and icon buttons are at least 44 × 44 px, and small buttons are 40 px high. Both are above the WCAG 2.2 AA minimum of 24 px. The MUI theme enforces this (`design-system/mui-theme.ts`).
- **Keyboard:** all actions are native buttons and links. Dialogs trap and restore focus (MUI). The tree picker rows and report tables can now be reached and operated by keyboard (fixes 1 and 2).

## Not automated, still to do by hand

axe catches roughly a third to a half of WCAG issues. Before promoting `development` → `main`, walk through these on the live dev site:

1. **Screen reader pass:** TalkBack on Android Chrome, the field workers' phones. Cover the full plucking round (plan → Save & Next → complete) and recording a sale.
2. **Keyboard-only pass on desktop:** sign-in → farm → reports → settings / access. Check that the focus order follows the visual order.
3. **Zoom and reflow:** 200% browser zoom and the largest Android font size. Nothing should be clipped and no screen should scroll sideways (WCAG 1.4.10).
4. **Sinhala and Tamil strings, once added:** recheck for text overflow and the `lang` attribute.

Record the results of these passes in this file.
