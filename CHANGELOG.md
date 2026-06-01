# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-06-01

First public release — a desktop editor for authoring Three.js scenes, with a
clean on-disk project format and one-click code export.

### Added

- **Desktop app shell** — Tauri 2 + React 18 + Tailwind / shadcn UI, with
  react-i18next localization (English + 简体中文) and light / dark / system themes.
- **3D viewport** (Three.js) — orbit camera, ground grid, selection outline, and a
  transform gizmo with move / rotate / scale modes (G / R / S).
- **Scene graph** — hierarchy tree with group, mesh, light, camera, helper, and
  prefab-instance nodes; a properties panel for position, Euler-angle rotation, and
  scale; per-node lock policy; and full undo / redo command history.
- **Projects** — a file-per-node folder format with New / Open / Save / Save As /
  Close via a native File menu, dirty-state tracking, and folder-as-project-name.
  Type-safe Rust ↔ TypeScript bindings (tauri-specta).
- **glTF import** — `.glb` import backed by a content-addressed asset pipeline and
  prefab-instance nodes (shared templates, per-instance placement).
- **Code export** — emit a runnable Vite project or a single-file standalone HTML
  page, both wired with OrbitControls and a fallback light.
- **Behaviors** — a no-code behavior framework with an Auto-Rotate behavior, a
  behaviors panel to add / edit / remove bindings, an editor Play / Pause mode, and
  exported runtime tickers.
- **Editor shortcuts** — Delete / Backspace to delete, Cmd/Ctrl+D to duplicate, F to
  focus the camera on the selection, Space to toggle Play, Esc to clear the
  selection, and a `?` / Cmd+/ help dialog.
- **Project templates** — a New-project picker offering Starter scene, Single cube,
  and Empty project.
- **Error handling** — a global error boundary with a crash-recovery screen,
  success / failure toasts for project I/O, and a window-level net for uncaught
  errors and promise rejections.
- **Documentation** — scene-graph spec, Three.js adapter guide, README, and roadmap.

[Unreleased]: https://github.com/longyi-xw/lowcode-3d/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/longyi-xw/lowcode-3d/releases/tag/v0.1.0
