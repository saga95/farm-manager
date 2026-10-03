# Agent Configuration — Farm Manager (My Smart Need AgriTech)

> **Baseline rule for every agent and contributor:** [docs/ENVIRONMENTS_AND_RELEASES.md](docs/ENVIRONMENTS_AND_RELEASES.md).
> There are two environments only, **dev** (`development`) and **prod** (`main`), both on AWS Amplify, and each push deploys its branch.
> Never create environments for testing (no staging, previews or sandboxes); test on dev.
> Prod releases come from semantic-release, so commits must follow Conventional Commits.

## Available Agents

### Default Agent

The default coding agent for general development tasks. Follows instructions from `.github/copilot-instructions.md`.

### Explore Agent

Fast read-only codebase exploration. Use for:

- Finding where something is implemented
- Understanding code dependencies
- Answering questions about the codebase

### 🎨 Aria — UX Designer Agent

Senior UI/UX designer embedded into the project. Owns the entire design layer
(design system, personas, empathy maps, IA, sitemaps, user flows, journey maps,
wireframes, hi-fi mockups, Storybook). Anchors every decision to
`design-system/tokens.ts`.

- **Persona & rules**: [CLAUDE.md](CLAUDE.md)
- **Slash commands**: [.claude/commands/](.claude/commands/) (`/design-system`, `/persona`, `/userflow`, `/wireframe`, `/audit`, etc.)
- **Templates**: [.claude/templates/](.claude/templates/)
- **Design tokens**: [design-system/tokens.ts](design-system/tokens.ts)
- **MUI adapter**: [design-system/mui-theme.ts](design-system/mui-theme.ts)
- **Output folders**: [ux-docs/](ux-docs/)

Use Aria for any UI/UX task: "Aria, build a wireframe for X", "Aria, audit the
theme", "Aria, create a persona for Y". Both Claude Code and GitHub Copilot
should follow `CLAUDE.md` when acting in this role.

### Custom Agent Templates

Below are role-based instruction sets that agents (human or AI) can follow when performing specific tasks.

---

## 🚀 Setup Agent (for a new contributor machine)

1. `git clone https://github.com/saga95/farm-manager.git && cd farm-manager`
2. `nvm use && pnpm install` (or `pnpm bootstrap`)
3. `cp .env.example .env.local` and fill in local values
4. Point the local app at the live dev backend: `AMPLIFY_APP_ID=<id> pnpm amplify:outputs:dev`
5. Verify: `pnpm dev`, `pnpm lint`, `pnpm test`, `pnpm build`

Do **not** run `ampx sandbox` or create any other environment.

---

## 🔧 Feature Agent (for adding new features)

**Pre-conditions**: Understand the feature requirements fully.

**Steps**:

1. Create feature branch from `development`: `git checkout -b feature/<issue>-<name>`
2. Define types in `src/types/index.ts` if needed
3. Create/update data models in `amplify/data/resource.ts` if needed
4. Create React Query hooks for data fetching
5. Build UI components with MUI, following existing patterns
6. Add i18n translations to `public/locales/en/*.json`
7. Add SEO metadata using `src/lib/seo.ts` helpers
8. Write tests (components, hooks, utilities)
9. Run quality checks: `npm run lint && npm run type-check && npm run test`
10. Submit PR to `development` with a Conventional Commit title and `Closes #<issue>`

---

## 🌍 Localization Agent (for i18n tasks)

**Steps**:

1. Identify all user-facing strings in the feature/page
2. Add translation keys to `public/locales/en/*.json` (English first)
3. Copy to other locale directories and translate
4. Use `useTranslation('namespace')` hook in components
5. Test language switching
6. Verify RTL layout if adding Arabic

---

## 🔍 SEO Agent (for SEO optimization)

**Steps**:

1. Review page metadata using `generatePageMeta()` from `src/lib/seo.ts`
2. Add JSON-LD structured data (Organization, BreadcrumbList, FAQ, Article, etc.)
3. Verify `robots.txt` allows the page
4. Add page to sitemap
5. Check Open Graph and Twitter Card previews
6. Verify canonical URLs
7. Test with Google Rich Results Test

---

## 🧪 QA Agent (for quality assurance)

**Steps**:

1. Run full test suite: `npm run test:coverage`
2. Check type safety: `npm run type-check`
3. Check lint: `npm run lint:check`
4. Check formatting: `npm run format:check`
5. Build all environments: `npm run build`
6. Verify accessibility with axe-core or WAVE
7. Test responsive design (mobile, tablet, desktop)
8. Test with screen reader
9. Check Core Web Vitals in Lighthouse

---

## 🚢 Deploy / Release Agent

Deployment is **push-to-deploy on AWS Amplify**. There are no manual deploy scripts.

1. **dev:** merge the PR into `development`. Amplify builds the frontend and backend for dev. Smoke-test on dev.
2. **prod:** open a PR from `development` to `main` and merge it with a **merge commit**. Amplify deploys prod.
3. The CI `Release` job runs semantic-release, which creates the `vX.Y.Z` tag and GitHub Release notes. Never tag or edit versions by hand.
4. Check that `/api/health` returns 200 on the deployed URL.
