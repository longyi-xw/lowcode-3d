<div align="center">

# lowcode-3d

**AI-assisted low-code platform for the Web 3D stack.**
Arrange a scene visually, export production-ready Three.js code.

[![CI](https://github.com/longyi-xw/lowcode-3d/actions/workflows/ci.yml/badge.svg)](https://github.com/longyi-xw/lowcode-3d/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Status: scaffold](https://img.shields.io/badge/status-pre--MVP_scaffold-orange.svg)](#status)

<img src="design/prototype/img.png" width="820" alt="lowcode-3d editor — desktop prototype" />

</div>

---

## Why

3D on the web is everywhere, but the gap between **a designer's intent** and
**Three.js production code** is still hours of glue work — boilerplate setup,
material wiring, light placement, asset loading. lowcode-3d closes that gap
by giving you a desktop editor that produces real Three.js code, plus an
optional AI layer for natural-language scene edits driven by your own API key.

## Status

> **You are here**: `v0.0.1-scaffold` — empty-but-runnable shell.

| Milestone                                                                                 | What lands                                                              | Status              |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------- |
| [`v0.0.1-scaffold`](https://github.com/longyi-xw/lowcode-3d/releases/tag/v0.0.1-scaffold) | Tauri + Vite + React + Tailwind + shadcn + i18n + Zustand + ESLint + CI | ✅ this commit      |
| `v0.1.0-mvp`                                                                              | Scene Graph types · Three.js viewport · transform gizmos · export       | Phase 0 in progress |
| `v0.2`                                                                                    | Asset browser · property panel polish · settings persistence to disk    | Planned             |
| `v0.3`                                                                                    | AI Skills · natural-language scene edits                                | Planned             |
| `v1.0`                                                                                    | Multi-runtime (Babylon.js validation)                                   | Planned             |

The roadmap and the five-layer architecture this scaffold is laid against
live in [`design/framework/architecture.md`](design/framework/architecture.md).

## Stack

- **Desktop shell** — [Tauri 2.x](https://tauri.app/) (Rust backend, web frontend)
- **Frontend** — React 18 + TypeScript 5 (strict + `noUncheckedIndexedAccess`) + Vite 5
- **3D** — Three.js (MVP) · adapter interface ready for Babylon.js / R3F / Unity
- **State** — Zustand + Immer, with a Command bus for undo/redo
- **UI** — Tailwind CSS 3 + shadcn/ui (new-york) · Geist + Geist Mono variable fonts
- **i18n** — react-i18next · zh-CN + en-US bundled, key-typed via TS module augmentation
- **Storage** — SQLite (project index) · JSON folder (project format, git-friendly)
- **Quality** — ESLint 9 (flat) · Prettier · Vitest · husky + lint-staged + commitlint · GitHub Actions

## Architecture

<img src="design/framework/ai_web_3d_lowcode_architecture_overview.svg" width="100%" alt="Five-layer architecture overview" />

Each `src/<layer>/` directory only depends on layers below it. See
[`CONTRIBUTING.md`](CONTRIBUTING.md#2-repository-layout) for the directory map
and the rules around adding new code.

## Prototype

Annotated walkthrough in [`design/prototype/`](design/prototype/) — the editor
(`img.png`), Settings (`img_1`–`img_7`), Startup (`img_8`), Loading (`img_9`),
and Error (`img_10`). The dev build of the scaffold ships a `demo views`
bar at the bottom of the window that cycles through Startup / Loading /
Editor / Error shells so the prototype states stay verifiable as code lands.

## Development

Prerequisites:

- Node 20+ (pinned in [`.nvmrc`](.nvmrc))
- pnpm 9+ (declared in `packageManager`; `corepack enable` will pick it up)
- Rust stable (rustup recommended; Homebrew also works)
- Xcode Command Line Tools on macOS

```bash
pnpm install
pnpm tauri dev      # desktop window with the prototype scaffolding
pnpm dev            # frontend-only at http://localhost:1420
pnpm test           # vitest (jsdom)
pnpm lint           # eslint .
pnpm typecheck      # tsc --noEmit
pnpm build          # frontend production bundle
```

## Releases

Pushing a `v*` tag triggers
[`.github/workflows/release.yml`](.github/workflows/release.yml), which runs
`tauri build` on macOS (universal), Windows, and Linux runners and drafts a
GitHub Release with the resulting `.dmg` / `.msi` / `.exe` / `.deb` /
`.AppImage` artifacts attached.

> First real release needs production icons. Run
> `pnpm tauri icon path/to/logo-1024.png` once you have a 1024×1024 source
> image — it generates all platform-specific formats into `src-tauri/icons/`.
> Then flip `bundle.active` to `true` in `src-tauri/tauri.conf.json`.

## Contributing

Branch naming, Conventional Commits, and the PR template live in
[`CONTRIBUTING.md`](CONTRIBUTING.md). Short version: feature branches off
`main`, lint + typecheck + test must be green, and any new user-facing
string must land in both `src/i18n/locales/en-US/` and
`src/i18n/locales/zh-CN/` in the same commit.

## License

[MIT](LICENSE) © 2026 lowcode-3d contributors.
