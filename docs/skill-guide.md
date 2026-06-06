# AI Skill Authoring Guide

> Skills are scoped AI capabilities. They run through the Tauri Rust AI proxy
> (`src-tauri/src/ai.rs`) so the renderer never sees user API keys. v0.3
> sub-stage B ships the **single-shot structured-output** model + the first
> skill, `scene-edit` (add lights from natural language).

## 1. Execution model (v0.3b — single-shot)

`runSkill(skillId, input)` (`src/services/skills/run.ts`):

1. `aiComplete({ system: skill.systemPrompt, user: input, jsonSchema: skill.outputSchema })`
   — calls the **active** provider (Anthropic / DeepSeek, from Settings) via the
   Rust proxy and forces structured output (tool-use / function-calling).
2. `JSON.parse` the returned `json` string, then `skill.parse(raw)` (zod) to
   validate → `Operation[]`.
3. `skill.buildCommands(ops)` → undoable `Command[]` → `executeCommand` each.

Failures throw `SkillError("no_output" | "parse")` or the proxy's `AiError`; the
caller (`AiCommandBar`) maps them to toasts.

## 2. The `Skill` interface

```ts
// src/services/skills/types.ts
interface Skill {
  id: string;
  name: string;
  systemPrompt: string;
  outputSchema: Record<string, unknown>; // JSON Schema sent to the LLM
  parse(json: unknown): Operation[]; // zod-validate the LLM output
  buildCommands(ops: Operation[]): Command[];
}
```

## 3. Adding a skill / operation

1. Add the op type to `Operation` (`types.ts`).
2. In your skill: extend the JSON Schema (`outputSchema`) **and** the zod schema
   (`parse`) together, and map the op in `buildCommands` to a Command (e.g.
   `AddNodeCommand`).
3. Register it in `SKILLS` (`registry.ts`).

`scene-edit` is the worked example (`src/services/skills/scene-edit.ts`): one
`add_light` op → `buildLightNode` → `AddNodeCommand`. The `systemPrompt` encodes
scene conventions (Y-up, "upper right" ≈ `[5,6,4]`, "warm white" ≈ `#ffe8c0`) +
a few-shot example; the zod schema validates `color` as strict hex so a vague
LLM answer surfaces as a friendly "couldn't understand" toast instead of a bad
node.

## 4. Providers & structured output

The active provider + model come from Settings → AI providers (v0.3 sub-stage
A). Structured output is forced via Anthropic tool-use / OpenAI(DeepSeek)
function-calling — `aiComplete` returns the tool input as a JSON string (JSON
crosses the Tauri IPC boundary as a string; see `ai.rs`).

## 5. Deferred (see `docs/roadmap.md` → Backlog)

- **agentic multi-turn** `call_tool` / `allowed_tools` (architecture §4.3) — the
  current model is single-shot. (User: multi-turn is a definite follow-up.)
- `SkillContext.memory` (`MemoryStore` — not implemented yet).
- more skills (`asset-tagging`, `code-explain`, `local-fast`) + skill → provider
  routing (prototype `img_5`).
- batching multiple ops into a single undo entry.
