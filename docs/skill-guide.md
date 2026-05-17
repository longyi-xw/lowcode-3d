# AI Skill Authoring Guide

> **Status**: TBD — derived from [`design/framework/architecture.md`](../design/framework/architecture.md) §4.3.
> Skills are scoped AI capabilities ("add a light from the upper-right",
> "tag this asset", "explain this snippet of generated code"). They run
> through the Tauri Rust process so the renderer never sees user API keys.

## 1. The `Skill` interface

TBD — see architecture §4.3.

## 2. Allowed tools and capability boundaries

TBD — every skill declares the tool surface it can call, similar to
how Tauri capabilities work.

## 3. System prompt & output schemas

TBD.

## 4. Providers, routing, and the BYO-key model

TBD — providers (Anthropic / OpenAI / Ollama) are configured in
Settings → AI providers (see prototype img_5). Skill routing maps
each skill id to a provider+model pair.

## 5. Worked examples

TBD — `scene-edit`, `asset-tagging`, `code-explain`, `local-fast`
are planned baseline skills (per prototype img_5).
