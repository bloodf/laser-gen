# Contributing to laser-gen

Thanks for your interest in contributing! laser-gen is a community project and every kind of
contribution matters — code, translations, vessel presets, documentation, design, and bug
reports.

By participating, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Development setup

Prerequisites: **Node.js 22+** and **pnpm 10+**.

```bash
git clone https://github.com/bloodf/laser-gen.git
cd laser-gen
pnpm install
pnpm dev
```

Before opening a PR, make sure all checks pass locally:

```bash
pnpm lint        # ESLint
pnpm typecheck   # vue-tsc
pnpm test        # Vitest
pnpm build       # production build must succeed
```

## Branch and commit conventions

- Branch from `main`: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, `i18n/<locale>-<topic>`.
- Commits follow **[Conventional Commits](https://www.conventionalcommits.org/)**:
  - `feat: add tapered cone vessel preset`
  - `fix: correct cone unwrap circumference at small end`
  - `i18n: add French locale`
  - `docs: document export pipeline`
- Keep PRs focused: one feature or fix per PR.

## How to add a locale

1. Copy `i18n/locales/en.json` to `i18n/locales/<code>.json` and translate the values
   (never change the keys — English is the source of truth).
2. Register the locale in the `i18n.locales` array in `nuxt.config.ts`.
3. Run `pnpm typecheck` and `pnpm build` to confirm everything wires up.

Full details: [docs/adding-a-language.md](docs/adding-a-language.md).

## How to add a vessel preset

Vessel presets are parametric descriptions (diameters, height, taper) consumed by the
geometry core. In future milestones these will live under `app/core/geometry` (see
[docs/architecture.md](docs/architecture.md)). Until then, the best way to contribute a
vessel is to open a **vessel request** issue with exact millimeter dimensions — or draft
the preset definition following [docs/adding-a-vessel.md](docs/adding-a-vessel.md).

## Pull request process

1. Open an issue first for anything non-trivial, so we can align on direction.
2. Fork, branch, commit (Conventional Commits), push.
3. Fill out the PR template checklist: tests, typecheck, i18n keys, docs.
4. A maintainer will review; please be responsive to feedback.
5. Squash-merge once approved. Don't worry about a perfect history — we squash.

## Reporting bugs and requesting features

Use the GitHub issue templates:

- **Bug report** — reproduction steps, expected vs. actual behavior
- **Feature request** — the problem you're trying to solve
- **Vessel request** — product name, dimensions in mm, taper
- **Translation report** — wrong or missing translations

## Security issues

Do **not** open a public issue. See [SECURITY.md](SECURITY.md).
