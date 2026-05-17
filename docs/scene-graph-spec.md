# Scene Graph Specification

> **Status**: TBD — derived from [`design/framework/architecture.md`](../design/framework/architecture.md) §3.
> This file will become the canonical, version-tagged spec once the
> TypeScript types land in `src/core/scene/`. Treat the architecture doc
> as the source of truth until then.

## 1. Goals

- Technology-stack independent JSON description of a 3D scene.
- Git-friendly: one Node per file, deterministic ordering.
- Forward-compatible: every project carries a `spec_version`.
- Extensible: custom node types and behaviors via well-typed escape hatches.

## 2. Top-level structure

TBD — see architecture §3.1 (`SceneProject`).

## 3. Nodes

TBD — see architecture §3.2 (`Node`, `Transform`, `NodeData`).

## 4. Assets

TBD — see architecture §3.3 (`AssetReference`, content-hash addressing).

## 5. Behaviors

TBD — see architecture §3.4 (`BehaviorBinding`).

## 6. Serialization

TBD — see architecture §3.5 (folder layout, one-file-per-node).

## 7. Versioning & Migration

TBD — `spec_version: "0.1.0"`. Migrations live in `src/core/migrations/`
once they exist (v0.2+).
