# Runtime Adapter Authoring Guide

> **Status**: TBD — derived from [`design/framework/architecture.md`](../design/framework/architecture.md) §4.1.
> A runtime adapter is the bridge between the technology-independent
> Scene Graph and a specific rendering / game engine target. The MVP
> ships a Three.js adapter; this guide explains how to write your own.

## 1. The `IRuntimeAdapter` interface

TBD — see architecture §4.1.

## 2. Lifecycle: sync, pick, export

TBD.

## 3. Mapping Node types to engine objects

TBD.

## 4. Mapping Behaviors to engine-specific code

TBD.

## 5. Exporter templates

TBD — templates live under `src/runtime/<engine>/exporter/templates/`.

## 6. Testing your adapter

TBD — adapter conformance suite is planned for v1.0 alongside the
Babylon.js adapter.

## 7. Reference: Three.js adapter

TBD — see `src/runtime/three/` once it exists (Phase 1 of MVP).
