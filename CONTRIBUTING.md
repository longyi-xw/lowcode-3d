# Contributing

Thanks for your interest in lowcode-3d. This document is the operational
companion to the [architecture design](./design/framework/architecture.md):
how to set up your environment, how branches and commits are organized,
and what to expect from CI.

## 1. Prerequisites

- Node 20+ (see `.nvmrc`)
- pnpm 9+ (set in `packageManager`; `corepack enable` will pick it up)
- Rust stable (rustup recommended; Homebrew Rust also works)
- Xcode Command Line Tools on macOS

```bash
pnpm install
pnpm tauri dev   # launches the desktop window
```

## 2. Repository layout

Top-level dirs follow the five-layer architecture:

```
src/
├── core/        # Layer 2 — Scene Graph, Command, IDs (no deps)
├── runtime/     # Layer 3 — engine adapters (Three.js is the only MVP target)
├── editor/      # Layer 4 — Command system + interaction controllers
├── services/    # Layer 1 (frontend half) — settings, scene store, IPC, etc.
├── ui/          # Layer 5 — React components (viewport, panels, menus)
├── i18n/        # locale bundles (zh-CN, en-US) and runtime config
├── components/  # vendored shadcn/ui primitives (not architecture-layer code)
└── lib/         # shared utilities (cn, etc.)

src-tauri/       # Rust backend (file I/O, AI proxy, SQLite)
packages/        # future standalone npm packages (e.g., scene-spec)
design/          # authoritative product design — never edited by tooling
docs/            # implementation-facing docs (TBD until each module lands)
```

## 3. Branch strategy

- `main` is protected; tagged releases (`v0.1.0-mvp`, …) only merge in via PR.
- Work happens on short-lived branches off `main`:
  - `feat/<scope>-<short>` — new functionality
  - `fix/<scope>-<short>` — bug fixes
  - `docs/<scope>-<short>` — documentation-only changes
  - `chore/<scope>-<short>` — tooling, deps, infra
- No `develop` branch. The MVP cadence is too fast for it to pay rent.

## 4. Commit conventions

[Conventional Commits](https://www.conventionalcommits.org/). Enforced by
commitlint at the `commit-msg` hook.

```
<type>(<scope>): <subject>

[optional body — wrap at ~72 chars where natural]

[optional footers — Co-Authored-By, BREAKING CHANGE, etc.]
```

Allowed types: `feat` `fix` `docs` `style` `refactor` `perf` `test`
`build` `ci` `chore` `revert`.

Suggested scopes: `core` `runtime` `editor` `ui` `services` `tauri`
`i18n` `infra` `deps`.

Examples that pass:

- `feat(i18n): add zh-TW locale bundle`
- `chore(tauri): bump tauri to 2.2`
- `fix(ui): correct settings dialog z-index on dark theme`

Examples that get rejected:

- `update stuff` — missing type
- `Feat: hello` — type must be lowercase
- `feat: too:many:colons` — only one colon after the type/scope

### Commit granularity

One commit ≈ one self-explanatory change (~50–200 lines). Anything past
~400 lines is a strong signal to split. The pre-commit hook reformats
and lints staged files; if it edits a file you didn't expect, stage the
result before re-attempting the commit.

## 5. Pull requests

Open against `main`. The PR description should answer three things:

1. **What** — bullet list of changes, grouped by area.
2. **Why** — link to the architecture section or design asset this
   addresses (e.g., `architecture.md §3.2`, `prototype img_5`).
3. **How to test** — concrete commands or click-through steps.

CI runs `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` on
every PR. All four must be green.

## 6. Internationalization

- New user-facing strings must land in both `src/i18n/locales/en-US/`
  and `src/i18n/locales/zh-CN/` in the same commit.
- Key style: `area.subarea.element.state` (e.g. `settings.appearance.theme.label`).
- ESLint warns on literal text inside JSX (`i18next/no-literal-string`).
  Use `t("namespace:key")` and add the key to every locale.

## 7. Filing issues

- For prototype-related questions, reference the relevant image filename
  (e.g., `design/prototype/img_5.png`).
- For architecture questions, reference the section number in
  `design/framework/architecture.md`.

## 8. Code of conduct

TBD — see the upcoming `CODE_OF_CONDUCT.md`. Until then: be kind, give
context, and assume good faith.
