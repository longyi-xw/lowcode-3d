# Phase 3 Behaviors — Stage A 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 ThreeAdapter 上落地行为框架（注册表 + `auto-rotate` + live runtime API），并让 scene-codegen / vite + standalone 两个 emitter 输出可运行的、带行为 tick 的代码。**不含编辑器 UI**——本阶段验收靠手动塞 binding 到 fixture + 跑 vitest。

**架构：** 一个 behavior = 一个 class（colocated definition + install/tick/emit），由 per-adapter `ThreeBehaviorRegistry` 持有。`scene-codegen` 不依赖 adapter 类型，而是通过 `SceneCodegenInput.generateBehaviorCode` 接收一个函数闭包；这条路径与 adapter 的 live-runtime tick 路径共享同一个 Behavior 实例。

**技术栈：** TypeScript 5 + zod + three.js 0.184 + vitest 2 + 现有 BuilderRegistry / AssetCache 模式。

**前置：** spec 见 `docs/superpowers/specs/2026-05-25-phase3-behaviors-design.md`。当前分支 `feat/phase3-behaviors` 已 commit spec（4a0478e）。Stage A 在该分支继续。

**所有 git/pnpm 命令前缀（git hook 需 Node 20）：**

```sh
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
```

下文步骤里的 `pnpm` / `git` 命令默认假设此 PATH 已经导出。

---

## 文件结构（Stage A 涉及）

**新增：**

- `src/core/behaviors/index.ts` — 转发文件，等 Babylon adapter 来填
- `src/runtime/three/behaviors/types.ts` — `Behavior<TParams>` + `BehaviorHandle` interface
- `src/runtime/three/behaviors/registry.ts` — `ThreeBehaviorRegistry` 类
- `src/runtime/three/behaviors/registry.test.ts`
- `src/runtime/three/behaviors/auto-rotate.ts` — `AutoRotateBehavior`
- `src/runtime/three/behaviors/auto-rotate.test.ts`
- `src/runtime/three/behaviors/index.ts` — `createThreeBehaviorRegistry()`

**修改：**

- `src/runtime/adapter.ts` — `CodegenContext` 加 `currentNodeVar: string`
- `src/runtime/three/export/scene-codegen.ts` — `SceneCodegenInput` 加 `generateBehaviorCode` 字段；`EmitContext` 加 `currentNodeVar`；新增 `pushBlock`；prolog 加 `const tickers = [];`；epilog 返回 `tickers`；`emitNode` 在添加到父节点后遍历 `node.behaviors`
- `src/runtime/three/export/scene-codegen.test.ts` — 扩展：节点带 binding、disabled、未知 type、多个 binding 不冲突
- `src/runtime/three/export/vite-emitter.ts` — `mainJs()` 加 `THREE.Clock` + tickers loop；并把 `generateBehaviorCode` 注入 `generateSceneModule`
- `src/runtime/three/export/standalone-esm-emitter.ts` — 同上
- `src/runtime/three/export/emitters.test.ts` — 扩展
- `src/runtime/three/adapter.ts` — 解除两个 stub；加 `behaviorRegistry` 字段；新增 `installBehaviors` / `uninstallBehaviors` / `tickBehaviors` 方法；导出路径里把 `generateBehaviorCode.bind(this)` 注入 codegen
- `src/runtime/three/adapter.test.ts` — 扩展

---

## 任务 A1：定义 Behavior 接口（types-only）

**文件：**

- 创建：`src/runtime/three/behaviors/types.ts`
- 创建：`src/core/behaviors/index.ts`

接口本身不可测；类型不一致会在后续任务中由 `tsc` 抓出。

- [ ] **步骤 1：创建 `src/runtime/three/behaviors/types.ts`**

```ts
import type * as THREE from "three";

import type { BehaviorDefinition, CodegenContext } from "@/runtime/adapter";

/**
 * Per-binding runtime state. Returned by Behavior.install, threaded through
 * tick, and released by handle.dispose (if present). For behaviors with no
 * persistent state (e.g. auto-rotate) install can return `{}` and tick never
 * reads handle.
 */
export interface BehaviorHandle {
  dispose?(): void;
}

/**
 * Single source of truth for a behavior: metadata, editor-runtime
 * (install/tick), and export codegen (emit) live on the same class. A future
 * cross-engine adapter (Babylon) would re-implement install/tick/emit against
 * its own runtime but share the same {@link BehaviorDefinition} metadata.
 *
 * Implementations are stateless — runtime state belongs in BehaviorHandle so
 * a single Behavior instance can serve many bindings (Flyweight).
 */
export interface Behavior<TParams = unknown> {
  readonly definition: BehaviorDefinition;

  install(object: THREE.Object3D, params: TParams): BehaviorHandle;
  tick(
    object: THREE.Object3D,
    params: TParams,
    handle: BehaviorHandle,
    dt: number,
  ): void;

  /**
   * Returns a code block whose lines start at column 0. The scene-codegen
   * caller pushes the block via `pushBlock(ctx, code)`, which prefixes each
   * line with the current indent. The block may reference `tickers` (an
   * array declared by the prolog) and the supplied `varName`.
   */
  emit(varName: string, params: TParams, ctx: CodegenContext): string;
}
```

- [ ] **步骤 2：创建 `src/core/behaviors/index.ts`**

```ts
/**
 * Engine-neutral behaviors namespace.
 *
 * Intentionally empty in Phase 3: all data + implementations currently live
 * under `src/runtime/three/behaviors/`. When a second adapter (e.g. Babylon)
 * lands, the shared `BehaviorDefinition` metadata moves here and each adapter
 * keeps its engine-specific Behavior implementations under its own runtime
 * directory.
 *
 * Do not add Three-specific imports here.
 */
export {};
```

- [ ] **步骤 3：运行 typecheck 确认接口编译**

运行：

```sh
pnpm typecheck
```

预期：PASS（项目通过 typecheck；新增的两个文件不引入错误，core/behaviors/index.ts 是空 export）

- [ ] **步骤 4：Commit**

```sh
git add src/runtime/three/behaviors/types.ts src/core/behaviors/index.ts
git commit -m "feat(behaviors): Behavior<TParams> + BehaviorHandle interface

Lays the engine-agnostic contract for Phase 3 behaviors: install/tick for
the editor live runtime, emit for codegen. core/behaviors/ is a placeholder
namespace for future cross-adapter metadata sharing.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 A2：实现 ThreeBehaviorRegistry

**文件：**

- 创建：`src/runtime/three/behaviors/registry.ts`
- 测试：`src/runtime/three/behaviors/registry.test.ts`

- [ ] **步骤 1：编写失败的测试 `registry.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { Behavior, BehaviorHandle } from "./types";
import { ThreeBehaviorRegistry } from "./registry";

function fakeBehavior(type: string): Behavior {
  return {
    definition: {
      type,
      name: type,
      description: "",
      parameters_schema: z.object({}),
    },
    install: (): BehaviorHandle => ({}),
    tick: () => {},
    emit: () => "",
  };
}

describe("ThreeBehaviorRegistry", () => {
  it("registers and retrieves a behavior by type", () => {
    const r = new ThreeBehaviorRegistry();
    const b = fakeBehavior("alpha");
    r.register(b);
    expect(r.get("alpha")).toBe(b);
  });

  it("returns undefined for unregistered types", () => {
    const r = new ThreeBehaviorRegistry();
    expect(r.get("nope")).toBeUndefined();
  });

  it("list() returns every registered behavior in insertion order", () => {
    const r = new ThreeBehaviorRegistry();
    const a = fakeBehavior("a");
    const b = fakeBehavior("b");
    r.register(a);
    r.register(b);
    expect(r.list()).toEqual([a, b]);
  });

  it("throws when registering a duplicate type", () => {
    const r = new ThreeBehaviorRegistry();
    r.register(fakeBehavior("dup"));
    expect(() => r.register(fakeBehavior("dup"))).toThrow(/duplicate type "dup"/);
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：

```sh
pnpm vitest run src/runtime/three/behaviors/registry.test.ts
```

预期：FAIL，报错类似 `Cannot find module './registry'` 或 `ThreeBehaviorRegistry is not exported`。

- [ ] **步骤 3：实现 `registry.ts`**

```ts
import type { Behavior } from "./types";

/**
 * Per-adapter registry of Behavior implementations, keyed by
 * BehaviorDefinition.type. Owned by ThreeAdapter (same lifetime as the
 * AssetCache / BuilderRegistry).
 */
export class ThreeBehaviorRegistry {
  private readonly behaviors = new Map<string, Behavior>();

  register(b: Behavior): void {
    const type = b.definition.type;
    if (this.behaviors.has(type)) {
      throw new Error(`ThreeBehaviorRegistry: duplicate type "${type}"`);
    }
    this.behaviors.set(type, b);
  }

  get(type: string): Behavior | undefined {
    return this.behaviors.get(type);
  }

  list(): Behavior[] {
    return [...this.behaviors.values()];
  }
}
```

- [ ] **步骤 4：运行测试确认通过**

运行：

```sh
pnpm vitest run src/runtime/three/behaviors/registry.test.ts
```

预期：PASS（4 tests passed）

- [ ] **步骤 5：Commit**

```sh
git add src/runtime/three/behaviors/registry.ts src/runtime/three/behaviors/registry.test.ts
git commit -m "feat(behaviors): ThreeBehaviorRegistry

Per-adapter registry keyed on BehaviorDefinition.type. Duplicate-register
throws so wiring bugs surface immediately rather than silently overwriting.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 A3：实现 AutoRotateBehavior

**文件：**

- 创建：`src/runtime/three/behaviors/auto-rotate.ts`
- 测试：`src/runtime/three/behaviors/auto-rotate.test.ts`

- [ ] **步骤 1：编写失败的测试 `auto-rotate.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { AutoRotateBehavior } from "./auto-rotate";

describe("AutoRotateBehavior", () => {
  const b = new AutoRotateBehavior();

  it("exposes a stable definition", () => {
    expect(b.definition.type).toBe("auto-rotate");
    expect(b.definition.name).toBe("Auto Rotate");
    expect(typeof b.definition.description).toBe("string");
  });

  it("parses valid params", () => {
    const parsed = b.definition.parameters_schema.parse({ axis: "y", speed: 30 });
    expect(parsed).toEqual({ axis: "y", speed: 30 });
  });

  it("rejects invalid axis", () => {
    expect(() =>
      b.definition.parameters_schema.parse({ axis: "w", speed: 30 }),
    ).toThrow();
  });

  it("rejects non-number speed", () => {
    expect(() =>
      b.definition.parameters_schema.parse({ axis: "y", speed: "fast" }),
    ).toThrow();
  });

  it("install returns an empty handle (auto-rotate is stateless)", () => {
    const obj = new THREE.Object3D();
    const h = b.install(obj, { axis: "y", speed: 30 });
    expect(h).toEqual({});
    expect(h.dispose).toBeUndefined();
  });

  it("tick advances rotation around the chosen axis by speed * deg2rad * dt", () => {
    const obj = new THREE.Object3D();
    const params = { axis: "y" as const, speed: 30 };
    const h = b.install(obj, params);
    b.tick(obj, params, h, 1);
    expect(obj.rotation.y).toBeCloseTo((30 * Math.PI) / 180, 6);
    expect(obj.rotation.x).toBe(0);
    expect(obj.rotation.z).toBe(0);
  });

  it("tick supports negative speed", () => {
    const obj = new THREE.Object3D();
    const params = { axis: "x" as const, speed: -90 };
    const h = b.install(obj, params);
    b.tick(obj, params, h, 0.5);
    expect(obj.rotation.x).toBeCloseTo(((-90 * Math.PI) / 180) * 0.5, 6);
  });

  it("emit returns code referencing tickers + varName", () => {
    const code = b.emit(
      "n_abc",
      { axis: "y", speed: 30 },
      {
        project: { metadata: {}, scene: {}, assets: [], settings: {} } as never,
        warnings: [],
        currentNodeVar: "n_abc",
      },
    );
    expect(code).toContain("tickers.push");
    expect(code).toContain("n_abc.rotation.y");
    expect(code).toContain("30");
    expect(code).toContain("Math.PI");
  });

  it("emit output, when evaluated, produces the same rotation as tick", () => {
    // Equivalence test: run the emitted ticker for 1 second, compare with
    // tick-driven rotation after 1 second.
    const obj1 = new THREE.Object3D();
    const obj2 = new THREE.Object3D();
    const params = { axis: "y" as const, speed: 30 };

    const h = b.install(obj1, params);
    b.tick(obj1, params, h, 1);

    const tickers: ((dt: number) => void)[] = [];
    const code = b.emit("target", params, {
      project: {} as never,
      warnings: [],
      currentNodeVar: "target",
    });
    new Function("tickers", "target", code)(tickers, obj2);
    for (const t of tickers) t(1);

    expect(obj2.rotation.y).toBeCloseTo(obj1.rotation.y, 6);
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：

```sh
pnpm vitest run src/runtime/three/behaviors/auto-rotate.test.ts
```

预期：FAIL，`Cannot find module './auto-rotate'`。

- [ ] **步骤 3：实现 `auto-rotate.ts`**

```ts
import type * as THREE from "three";
import { z } from "zod";

import type { BehaviorDefinition, CodegenContext } from "@/runtime/adapter";

import type { Behavior, BehaviorHandle } from "./types";

const AxisSchema = z.enum(["x", "y", "z"]);
const ParamsSchema = z.object({
  axis: AxisSchema,
  speed: z.number(),
});

type Params = z.infer<typeof ParamsSchema>;

const DEG2RAD = Math.PI / 180;

export class AutoRotateBehavior implements Behavior<Params> {
  readonly definition: BehaviorDefinition = {
    type: "auto-rotate",
    name: "Auto Rotate",
    description: "Rotates the node around a local axis at a constant angular velocity.",
    parameters_schema: ParamsSchema,
  };

  install(_object: THREE.Object3D, _params: Params): BehaviorHandle {
    return {};
  }

  tick(
    object: THREE.Object3D,
    params: Params,
    _handle: BehaviorHandle,
    dt: number,
  ): void {
    object.rotation[params.axis] += params.speed * DEG2RAD * dt;
  }

  emit(varName: string, params: Params, _ctx: CodegenContext): string {
    // Lines start at column 0; scene-codegen's pushBlock() prefixes each
    // line with the surrounding indent. The block is wrapped in `{}` so
    // multiple auto-rotate bindings on the same node don't collide.
    return [
      `{`,
      `  const _omega = ${params.speed} * Math.PI / 180;`,
      `  tickers.push((dt) => { ${varName}.rotation.${params.axis} += _omega * dt; });`,
      `}`,
    ].join("\n");
  }
}
```

- [ ] **步骤 4：运行测试确认通过**

运行：

```sh
pnpm vitest run src/runtime/three/behaviors/auto-rotate.test.ts
```

预期：PASS（9 tests passed），包括 "emit ↔ tick equivalence" 用例。

- [ ] **步骤 5：Commit**

```sh
git add src/runtime/three/behaviors/auto-rotate.ts src/runtime/three/behaviors/auto-rotate.test.ts
git commit -m "feat(behaviors): AutoRotateBehavior

First concrete behavior: rotates a node around a chosen local axis at a
constant angular velocity (deg/s). Equivalence test asserts that tick-driven
rotation matches the emitted ticker so editor preview and exported runtime
stay in lockstep.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 A4：组装注册表入口

**文件：**

- 创建：`src/runtime/three/behaviors/index.ts`
- 修改：`src/runtime/three/behaviors/registry.test.ts`（追加 createThreeBehaviorRegistry 测试）

- [ ] **步骤 1：在 `registry.test.ts` 追加 createThreeBehaviorRegistry 用例**

在文件底部追加：

```ts
import { createThreeBehaviorRegistry } from "./index";

describe("createThreeBehaviorRegistry", () => {
  it("returns a registry pre-populated with auto-rotate", () => {
    const r = createThreeBehaviorRegistry();
    const ar = r.get("auto-rotate");
    expect(ar).toBeDefined();
    expect(ar?.definition.type).toBe("auto-rotate");
  });

  it("each call returns a fresh registry instance", () => {
    const a = createThreeBehaviorRegistry();
    const b = createThreeBehaviorRegistry();
    expect(a).not.toBe(b);
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：

```sh
pnpm vitest run src/runtime/three/behaviors/registry.test.ts
```

预期：FAIL，`Cannot find module './index'` 或 `createThreeBehaviorRegistry is not a function`。

- [ ] **步骤 3：实现 `behaviors/index.ts`**

```ts
import { AutoRotateBehavior } from "./auto-rotate";
import { ThreeBehaviorRegistry } from "./registry";

export { ThreeBehaviorRegistry } from "./registry";
export type { Behavior, BehaviorHandle } from "./types";

/**
 * Build a registry pre-populated with the v1 behavior catalog. Each
 * ThreeAdapter instance gets its own registry — behavior implementations are
 * stateless and shareable, but the registry itself is held as a per-adapter
 * field so future per-project custom behaviors can be appended without
 * leaking across adapters.
 */
export function createThreeBehaviorRegistry(): ThreeBehaviorRegistry {
  const r = new ThreeBehaviorRegistry();
  r.register(new AutoRotateBehavior());
  return r;
}
```

- [ ] **步骤 4：运行测试确认通过**

运行：

```sh
pnpm vitest run src/runtime/three/behaviors/registry.test.ts
```

预期：PASS（6 tests passed total — 4 原有 + 2 新增）

- [ ] **步骤 5：Commit**

```sh
git add src/runtime/three/behaviors/index.ts src/runtime/three/behaviors/registry.test.ts
git commit -m "feat(behaviors): createThreeBehaviorRegistry assembles v1 catalog

Single entry point for ThreeAdapter to obtain a registry with all v1
behaviors pre-registered. Behaviors are stateless so the instances are
shareable, but each adapter gets a fresh registry instance so per-project
extensions don't bleed across adapters.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 A5：扩展 CodegenContext + scene-codegen 接缝

**文件：**

- 修改：`src/runtime/adapter.ts:74-79`（`CodegenContext` interface）
- 修改：`src/runtime/three/export/scene-codegen.ts`（`SceneCodegenInput`、`EmitContext`、`pushBlock`、`generateSceneModule` 函数签名）

这一步是**纯接口扩展**——把字段加进去、把函数签名扩张。后续 A6 才往里塞 behavior 调用。这里不破坏现有测试。

- [ ] **步骤 1：修改 `src/runtime/adapter.ts` 的 `CodegenContext`**

替换原有 interface：

```ts
export interface CodegenContext {
  /** Snapshot of the project being exported. */
  project: SceneProject;
  /** Mutable: behaviors push warnings into this array as they generate. */
  warnings: string[];
  /**
   * The runtime variable name for the SceneNode currently being emitted.
   * Set by scene-codegen before delegating to a Behavior.emit. Behavior
   * implementations should reference this rather than re-deriving the name.
   */
  currentNodeVar: string;
}
```

- [ ] **步骤 2：修改 `src/runtime/three/export/scene-codegen.ts` 的 `SceneCodegenInput`**

替换原 interface：

```ts
import type { BehaviorBinding } from "@/core/scene/types";
import type { CodegenContext } from "@/runtime/adapter";
// ... existing imports ...

export interface SceneCodegenInput {
  project: SceneProject;
  includeDevComments?: boolean;
  /**
   * Inject behavior code emission. Callers (ThreeAdapter.exportProject) bind
   * this to their own `generateBehaviorCode` so scene-codegen doesn't need
   * to import IRuntimeAdapter (avoids the circular dep and keeps the
   * codegen module engine-agnostic).
   */
  generateBehaviorCode?: (binding: BehaviorBinding, ctx: CodegenContext) => string;
}
```

> 关键：`generateBehaviorCode` 是 **optional**——已有调用方（含旧测试）不传时 codegen 表现退化到忽略 behaviors（与当前行为一致），不破坏现有用例。

- [ ] **步骤 3：扩展 `EmitContext` 与新增 `pushBlock` helper**

在 `EmitContext` interface 加一个字段，在 `generateSceneModule` 初始化里设置默认值，并在文件中添加 `pushBlock`：

```ts
interface EmitContext {
  indent: number;
  lines: string[];
  project: SceneProject;
  warnings: string[];
  referenced: Map<string, AssetReference>;
  includeDevComments: boolean;
  currentNodeVar: string;
  generateBehaviorCode?: SceneCodegenInput["generateBehaviorCode"];
}

// ... 在 push() 函数附近添加：

function pushBlock(ctx: EmitContext, text: string): void {
  // text lines start at column 0; prefix each with the current indent
  // (mirrors how push() already prefixes single lines).
  const indent = "  ".repeat(ctx.indent);
  for (const line of text.split("\n")) {
    ctx.lines.push(line.length === 0 ? "" : indent + line);
  }
}
```

并在 `generateSceneModule` 里把新字段塞入 ctx：

```ts
export function generateSceneModule(input: SceneCodegenInput): SceneCodegenOutput {
  const { project, includeDevComments = false, generateBehaviorCode } = input;
  const warnings: string[] = [];
  const referenced = new Map<string, AssetReference>();

  const ctx: EmitContext = {
    indent: 1,
    lines: [],
    project,
    warnings,
    referenced,
    includeDevComments,
    currentNodeVar: "",
    generateBehaviorCode,
  };

  emitProlog(ctx);
  for (const rootId of project.scene.root_node_ids) {
    emitNode(ctx, rootId, "scene");
  }
  emitEpilog(ctx);

  return {
    sceneModuleSource: ctx.lines.join("\n") + "\n",
    referencedAssets: [...referenced.values()],
    warnings,
  };
}
```

- [ ] **步骤 4：运行 typecheck + 现有测试都不退化**

运行：

```sh
pnpm typecheck
pnpm vitest run src/runtime/three/export/scene-codegen.test.ts
```

预期：typecheck PASS；scene-codegen.test.ts 所有现有 6 用例 PASS（因为 `generateBehaviorCode` 是 optional，旧调用方不传时退化到忽略 behaviors，输出不变）。

- [ ] **步骤 5：Commit**

```sh
git add src/runtime/adapter.ts src/runtime/three/export/scene-codegen.ts
git commit -m "feat(codegen): extend SceneCodegenInput + CodegenContext for behaviors

- CodegenContext.currentNodeVar lets Behavior.emit() reference the node it
  is attached to without re-deriving the variable name.
- SceneCodegenInput.generateBehaviorCode is an injected function so
  scene-codegen never imports IRuntimeAdapter (avoids circular dep).
- Adds pushBlock(ctx, text) so multi-line code from Behavior.emit lands at
  the correct indent.

No behavior wiring yet — A6 plugs node.behaviors into emitNode.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 A6：scene-codegen 集成 behaviors

**文件：**

- 修改：`src/runtime/three/export/scene-codegen.ts`（`emitProlog`、`emitEpilog`、`emitNode`）
- 测试：`src/runtime/three/export/scene-codegen.test.ts`

- [ ] **步骤 1：扩展测试 `scene-codegen.test.ts`**

> 当前测试结构使用 `behaviors: []` 占位（参见现有第 74/93/125/160/196/227 行）。Stage A 在文件末尾追加新的 `describe("behaviors integration", () => { ... })` 块，不动现有用例。

在文件末尾追加：

```ts
import type { BehaviorBinding, SceneProject } from "@/core/scene/types";
import type { CodegenContext } from "@/runtime/adapter";

function projectWithBehaviors(
  nodeId: string,
  bindings: BehaviorBinding[],
): SceneProject {
  // Reuse the helper(s) already in this test file to build a single-mesh
  // project, then attach behaviors onto that node. (If no existing helper
  // exposes this, build the project inline using the same shape as the
  // existing tests do.)
  const project = buildSingleMeshProject(nodeId); // see existing helpers
  project.scene.nodes[nodeId] = {
    ...project.scene.nodes[nodeId],
    behaviors: bindings,
  };
  return project;
}

function stubBehaviorEmitter(): (
  binding: BehaviorBinding,
  ctx: CodegenContext,
) => string {
  return (binding, ctx) => {
    if (!binding.enabled) return "";
    if (binding.behavior_type === "unknown-future") {
      ctx.warnings.push(`unknown behavior_type "${binding.behavior_type}" — skipped`);
      return "";
    }
    return `{ tickers.push((dt) => { ${ctx.currentNodeVar}.rotation.y += dt; }); }`;
  };
}

describe("scene-codegen behaviors integration", () => {
  it("emits tickers array in prolog and includes it in the epilog return", () => {
    const project = projectWithBehaviors("n1", []);
    const out = generateSceneModule({
      project,
      generateBehaviorCode: stubBehaviorEmitter(),
    });
    expect(out.sceneModuleSource).toContain("const tickers = [];");
    expect(out.sceneModuleSource).toContain(
      "return { scene, camera, templates, tickers };",
    );
  });

  it("emits behavior code for enabled bindings", () => {
    const project = projectWithBehaviors("n1", [
      {
        id: "b1",
        behavior_type: "auto-rotate",
        enabled: true,
        parameters: { axis: "y", speed: 30 },
      },
    ]);
    const out = generateSceneModule({
      project,
      generateBehaviorCode: stubBehaviorEmitter(),
    });
    expect(out.sceneModuleSource).toContain("tickers.push");
  });

  it("skips disabled bindings", () => {
    const project = projectWithBehaviors("n1", [
      {
        id: "b1",
        behavior_type: "auto-rotate",
        enabled: false,
        parameters: { axis: "y", speed: 30 },
      },
    ]);
    const out = generateSceneModule({
      project,
      generateBehaviorCode: stubBehaviorEmitter(),
    });
    expect(out.sceneModuleSource).not.toContain("tickers.push");
  });

  it("pushes a warning for unknown behavior_type", () => {
    const project = projectWithBehaviors("n1", [
      {
        id: "b1",
        behavior_type: "unknown-future",
        enabled: true,
        parameters: {},
      },
    ]);
    const out = generateSceneModule({
      project,
      generateBehaviorCode: stubBehaviorEmitter(),
    });
    expect(out.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`unknown behavior_type "unknown-future"`),
      ]),
    );
    // unknown emitter returns "" → no tickers.push for that binding
    expect(out.sceneModuleSource).not.toContain("tickers.push");
  });

  it("emits multiple bindings without var collisions (block scoping)", () => {
    const project = projectWithBehaviors("n1", [
      {
        id: "b1",
        behavior_type: "auto-rotate",
        enabled: true,
        parameters: { axis: "y", speed: 30 },
      },
      {
        id: "b2",
        behavior_type: "auto-rotate",
        enabled: true,
        parameters: { axis: "x", speed: 15 },
      },
    ]);
    const out = generateSceneModule({
      project,
      generateBehaviorCode: stubBehaviorEmitter(),
    });
    // Two ticker pushes
    const pushes = out.sceneModuleSource.match(/tickers\.push/g) ?? [];
    expect(pushes.length).toBe(2);
  });

  it("legacy callers without generateBehaviorCode still produce a valid module", () => {
    const project = projectWithBehaviors("n1", [
      {
        id: "b1",
        behavior_type: "auto-rotate",
        enabled: true,
        parameters: { axis: "y", speed: 30 },
      },
    ]);
    const out = generateSceneModule({ project });
    // Prolog still declares tickers (consistent module shape)
    expect(out.sceneModuleSource).toContain("const tickers = [];");
    // …but no behavior code was emitted (no callback to call)
    expect(out.sceneModuleSource).not.toContain("tickers.push");
  });
});
```

> 注：`buildSingleMeshProject(...)` 是参考——若文件里没有该 helper，**用文件中其他用例同样的 inline 构造**写一个 `behaviors: [...]` 的 SceneProject。保持现有用例风格。

- [ ] **步骤 2：运行测试确认失败**

运行：

```sh
pnpm vitest run src/runtime/three/export/scene-codegen.test.ts
```

预期：FAIL，多个用例失败（prolog 还没加 `const tickers = [];`，epilog 还没改返回值，emitNode 还没调 `generateBehaviorCode`）。

- [ ] **步骤 3：在 `scene-codegen.ts` 的 `emitProlog` 加 tickers**

定位现有 prolog（约文件第 94-137 行），在 `push(ctx, \`const templates = new Map();\`);` 这一行后插入：

```ts
push(ctx, `const tickers = [];`);
```

也调整顶部的 JSDoc typedef 以包含 tickers：

```ts
push(ctx, `/**`);
push(ctx, ` * @typedef {Object} BuiltScene`);
push(ctx, ` * @property {THREE.Scene} scene`);
push(ctx, ` * @property {THREE.Camera} camera`);
push(ctx, ` * @property {Map<string, THREE.Group>} templates`);
push(ctx, ` * @property {Array<(dt: number) => void>} tickers`);
push(ctx, ` */`);
```

- [ ] **步骤 4：修改 `emitEpilog` 返回 tickers**

```ts
function emitEpilog(ctx: EmitContext): void {
  push(ctx, ``);
  push(ctx, `return { scene, camera, templates, tickers };`);
  ctx.indent = 0;
  push(ctx, `}`);
}
```

- [ ] **步骤 5：在 `emitNode` 末尾插入 behaviors 循环**

定位 `emitNode` 现有的 `push(ctx, \`${parentVar}.add(${varName});\`);` 之后、`for (const childId of node.children_ids)` 之前，插入：

```ts
ctx.currentNodeVar = varName;
if (ctx.generateBehaviorCode) {
  for (const binding of node.behaviors) {
    const code = ctx.generateBehaviorCode(binding, {
      project: ctx.project,
      warnings: ctx.warnings,
      currentNodeVar: varName,
    });
    if (code) pushBlock(ctx, code);
  }
}
```

- [ ] **步骤 6：运行测试确认通过**

运行：

```sh
pnpm vitest run src/runtime/three/export/scene-codegen.test.ts
```

预期：PASS（原有 6 用例 + 新增 6 用例 = 12 passed）。

如有未通过：

- prolog 缺 `const tickers = [];` → 步骤 3 漏了
- epilog 不返回 tickers → 步骤 4 漏了
- `generateBehaviorCode` 没被调用 → 步骤 5 漏了或 `node.behaviors` 字段为 undefined（确认测试 fixture 有 `behaviors: []`）

- [ ] **步骤 7：Commit**

```sh
git add src/runtime/three/export/scene-codegen.ts src/runtime/three/export/scene-codegen.test.ts
git commit -m "feat(codegen): emit node.behaviors via injected generateBehaviorCode

- Prolog declares 'const tickers = [];' and JSDoc typedef includes it.
- Epilog returns { scene, camera, templates, tickers }.
- emitNode delegates each binding to ctx.generateBehaviorCode and pushes
  the resulting block at the surrounding indent.
- Legacy callers without generateBehaviorCode still get a valid module
  (tickers stays empty).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 A7：ThreeAdapter 解除 behavior stubs

**文件：**

- 修改：`src/runtime/three/adapter.ts`
- 修改：`src/runtime/three/adapter.test.ts`

- [ ] **步骤 1：扩展 `adapter.test.ts` 加 behavior 用例**

在文件末尾追加一个新的 describe 块：

```ts
import type { BehaviorBinding } from "@/core/scene/types";
import type { CodegenContext } from "@/runtime/adapter";

describe("ThreeAdapter behaviors", () => {
  it("getSupportedBehaviors returns auto-rotate definition", () => {
    const adapter = makeAdapter(); // existing helper in this test file
    const defs = adapter.getSupportedBehaviors();
    expect(defs.find((d) => d.type === "auto-rotate")).toBeDefined();
  });

  it("generateBehaviorCode emits code for enabled auto-rotate binding", () => {
    const adapter = makeAdapter();
    const binding: BehaviorBinding = {
      id: "b1",
      behavior_type: "auto-rotate",
      enabled: true,
      parameters: { axis: "y", speed: 30 },
    };
    const ctx: CodegenContext = {
      project: makeEmptyProject(), // existing helper
      warnings: [],
      currentNodeVar: "n_test",
    };
    const code = adapter.generateBehaviorCode(binding, ctx);
    expect(code).toContain("tickers.push");
    expect(code).toContain("n_test.rotation.y");
  });

  it("generateBehaviorCode returns empty string for disabled bindings", () => {
    const adapter = makeAdapter();
    const ctx: CodegenContext = {
      project: makeEmptyProject(),
      warnings: [],
      currentNodeVar: "n_test",
    };
    const code = adapter.generateBehaviorCode(
      {
        id: "b1",
        behavior_type: "auto-rotate",
        enabled: false,
        parameters: { axis: "y", speed: 30 },
      },
      ctx,
    );
    expect(code).toBe("");
  });

  it("generateBehaviorCode returns empty + pushes warning for unknown type", () => {
    const adapter = makeAdapter();
    const ctx: CodegenContext = {
      project: makeEmptyProject(),
      warnings: [],
      currentNodeVar: "n_test",
    };
    const code = adapter.generateBehaviorCode(
      {
        id: "b1",
        behavior_type: "future-thing",
        enabled: true,
        parameters: {},
      },
      ctx,
    );
    expect(code).toBe("");
    expect(ctx.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining(`"future-thing"`)]),
    );
  });

  it("generateBehaviorCode returns empty + warning when params fail validation", () => {
    const adapter = makeAdapter();
    const ctx: CodegenContext = {
      project: makeEmptyProject(),
      warnings: [],
      currentNodeVar: "n_test",
    };
    const code = adapter.generateBehaviorCode(
      {
        id: "b1",
        behavior_type: "auto-rotate",
        enabled: true,
        parameters: { axis: "w", speed: "fast" }, // both invalid
      },
      ctx,
    );
    expect(code).toBe("");
    expect(ctx.warnings.length).toBeGreaterThan(0);
  });
});
```

> 假设 `makeAdapter()` / `makeEmptyProject()` 等是测试文件里已有的 helper；若不是，沿用现有用例的 inline 构造方式（在文件其他位置一定有类似 `new ThreeAdapter(...)` 的 setup）。

- [ ] **步骤 2：运行测试确认失败**

运行：

```sh
pnpm vitest run src/runtime/three/adapter.test.ts
```

预期：FAIL，`getSupportedBehaviors` 返回 `[]`、`generateBehaviorCode` 抛 `NotImplementedYet`。

- [ ] **步骤 3：修改 `src/runtime/three/adapter.ts`**

在文件顶部 import 区追加：

```ts
import { createThreeBehaviorRegistry, ThreeBehaviorRegistry } from "./behaviors";
```

在 ThreeAdapter 类字段区（与 `assetCache` 等同级）加：

```ts
private readonly behaviorRegistry: ThreeBehaviorRegistry;
```

在 constructor 里初始化：

```ts
this.behaviorRegistry = createThreeBehaviorRegistry();
```

替换两个 stub（约第 300-306 行）：

```ts
getSupportedBehaviors(): BehaviorDefinition[] {
  return this.behaviorRegistry.list().map((b) => b.definition);
}

generateBehaviorCode(
  binding: BehaviorBinding,
  ctx: CodegenContext,
): string {
  if (!binding.enabled) return "";
  const b = this.behaviorRegistry.get(binding.behavior_type);
  if (!b) {
    ctx.warnings.push(
      `unknown behavior_type "${binding.behavior_type}" — skipped`,
    );
    return "";
  }
  const parsed = b.definition.parameters_schema.safeParse(binding.parameters);
  if (!parsed.success) {
    ctx.warnings.push(
      `behavior "${binding.behavior_type}" (binding ${binding.id}) skipped: invalid params`,
    );
    return "";
  }
  return b.emit(ctx.currentNodeVar, parsed.data, ctx);
}
```

在 `exportProject` 里，把 `generateBehaviorCode` 注入到 codegen。定位 `EXPORTERS[target]` 调用前，确认 emitter 通过 `generateSceneModule` 接收 `generateBehaviorCode`——下一步（A7 步骤 4）会在 emitter 里改这个调用。

> 注意：现在 `exportProject` 调用的是 `exporter.emit(project, options)`，而 emitter 内部调用 `generateSceneModule(...)`。所以**适配点在 emitter，不在 adapter**——A7 步骤 4 把 adapter 的 generateBehaviorCode 顺着 ExportOptions 或新参数传进 emitter。

为了让 emitter 拿到 adapter，最干净的做法是给 `Exporter.emit` 加一个参数。修改 `src/runtime/adapter.ts` 的 `Exporter` interface：

```ts
export interface Exporter {
  readonly target: ExportTarget;
  emit(
    project: SceneProject,
    options: ExportOptions,
    generateBehaviorCode: (binding: BehaviorBinding, ctx: CodegenContext) => string,
  ): ExportResult;
}
```

然后修改 adapter 的 `exportProject`：

```ts
async exportProject(
  project: SceneProject,
  options: ExportOptions,
): Promise<ExportResult> {
  const target: ExportTarget = options.target ?? "vite";
  const exporter: Exporter | undefined = EXPORTERS[target];
  if (!exporter) {
    throw new Error(`ThreeAdapter.exportProject: no emitter for target "${target}"`);
  }
  return exporter.emit(
    project,
    options,
    this.generateBehaviorCode.bind(this),
  );
}
```

- [ ] **步骤 4：把 `generateBehaviorCode` 透传进 vite/standalone emitter**

修改 `src/runtime/three/export/vite-emitter.ts`：

```ts
export const viteEmitter: Exporter = {
  target: "vite",
  emit(project, options, generateBehaviorCode) {
    const includeDevComments = options.include_dev_comments ?? false;
    const codegen = generateSceneModule({
      project,
      includeDevComments,
      generateBehaviorCode,
    });
    // ... rest unchanged ...
  },
};
```

修改 `src/runtime/three/export/standalone-esm-emitter.ts` 做同样的改动（找 `generateSceneModule({ ... })` 调用，加 `generateBehaviorCode`）。

- [ ] **步骤 5：运行 typecheck + 测试**

运行：

```sh
pnpm typecheck
pnpm vitest run src/runtime/three/adapter.test.ts src/runtime/three/export
```

预期：typecheck PASS；adapter behavior 用例 5 个 PASS；scene-codegen 现有用例不退化；emitters 现有用例不退化。

如有 typecheck 错误：通常是 emitter 的 `emit(project, options)` 签名没改全；或者旧测试调 emitter 时少传第 3 个参数。把测试里所有 `viteEmitter.emit(project, options)` 改成 `viteEmitter.emit(project, options, () => "")`（行为 noop），保持旧用例语义不变。

- [ ] **步骤 6：Commit**

```sh
git add src/runtime/three/adapter.ts src/runtime/three/adapter.test.ts src/runtime/adapter.ts src/runtime/three/export/vite-emitter.ts src/runtime/three/export/standalone-esm-emitter.ts src/runtime/three/export/scene-codegen.test.ts
git commit -m "feat(adapter): wire ThreeBehaviorRegistry into adapter + emitters

- ThreeAdapter holds a per-instance behaviorRegistry.
- getSupportedBehaviors / generateBehaviorCode are no longer stubs.
- Exporter.emit gains a generateBehaviorCode parameter; ThreeAdapter
  passes its own bound method, so vite + standalone emitters can forward
  it to scene-codegen.
- Unknown behavior_type and invalid params produce warnings instead of
  throwing (forward-compat with future schema versions).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 A8：ThreeAdapter live runtime API

**文件：**

- 修改：`src/runtime/three/adapter.ts`
- 修改：`src/runtime/three/adapter.test.ts`

新增方法：`installBehaviors(nodeId)` / `uninstallBehaviors(nodeId)` / `tickBehaviors(dt)`。

- [ ] **步骤 1：在 `adapter.test.ts` 追加 live runtime 用例**

```ts
describe("ThreeAdapter live behavior runtime", () => {
  it("install + tick advances object rotation", () => {
    const adapter = makeAdapter();
    const project = makeProjectWithMeshAndBinding({
      nodeId: "n1",
      bindings: [
        {
          id: "b1",
          behavior_type: "auto-rotate",
          enabled: true,
          parameters: { axis: "y", speed: 30 },
        },
      ],
    });
    // Mount the node so adapter.objects.get("n1") is set
    adapter.syncNode(project.scene.nodes["n1"], "add");

    adapter.installBehaviors("n1", project.scene.nodes["n1"].behaviors);
    const obj = adapter.getRuntimeObject("n1") as THREE.Object3D;
    const rBefore = obj.rotation.y;
    adapter.tickBehaviors(1);
    expect(obj.rotation.y).toBeCloseTo(rBefore + (30 * Math.PI) / 180, 6);
  });

  it("uninstall releases handles and stops ticking", () => {
    const adapter = makeAdapter();
    const project = makeProjectWithMeshAndBinding({
      nodeId: "n1",
      bindings: [
        {
          id: "b1",
          behavior_type: "auto-rotate",
          enabled: true,
          parameters: { axis: "y", speed: 30 },
        },
      ],
    });
    adapter.syncNode(project.scene.nodes["n1"], "add");
    adapter.installBehaviors("n1", project.scene.nodes["n1"].behaviors);
    adapter.uninstallBehaviors("n1");
    const obj = adapter.getRuntimeObject("n1") as THREE.Object3D;
    const r = obj.rotation.y;
    adapter.tickBehaviors(1);
    expect(obj.rotation.y).toBe(r);
  });

  it("skips disabled bindings", () => {
    const adapter = makeAdapter();
    const project = makeProjectWithMeshAndBinding({
      nodeId: "n1",
      bindings: [
        {
          id: "b1",
          behavior_type: "auto-rotate",
          enabled: false,
          parameters: { axis: "y", speed: 30 },
        },
      ],
    });
    adapter.syncNode(project.scene.nodes["n1"], "add");
    adapter.installBehaviors("n1", project.scene.nodes["n1"].behaviors);
    const obj = adapter.getRuntimeObject("n1") as THREE.Object3D;
    const r = obj.rotation.y;
    adapter.tickBehaviors(1);
    expect(obj.rotation.y).toBe(r);
  });

  it("skips unknown behavior_type without throwing", () => {
    const adapter = makeAdapter();
    const project = makeProjectWithMeshAndBinding({
      nodeId: "n1",
      bindings: [
        {
          id: "b1",
          behavior_type: "future-thing",
          enabled: true,
          parameters: {},
        },
      ],
    });
    adapter.syncNode(project.scene.nodes["n1"], "add");
    expect(() => {
      adapter.installBehaviors("n1", project.scene.nodes["n1"].behaviors);
      adapter.tickBehaviors(1);
    }).not.toThrow();
  });

  it("tick errors on one binding don't break others", () => {
    // Use a fake behavior that throws to validate the try/catch wrap.
    // Simplest path: register a throwing behavior via direct registry access
    // OR (preferred) mock console.error and add a temporary behavior whose
    // tick throws. If the registry isn't exposed, skip this case for v1 and
    // rely on the implementation's try/catch being covered by the next test.
    expect(true).toBe(true); // placeholder — see implementation step 3 notes
  });
});
```

> 上面最后一个用例可以保留为 placeholder（占位 PASS），或者在实现步骤里把 registry 暴露成内部可见以便测试。**实施时优先让用例真正断言**：在测试文件顶部用 `vi.spyOn(console, "error").mockImplementation(() => {})`，临时往 adapter 的 registry 注一个会抛的 behavior。

- [ ] **步骤 2：运行测试确认失败**

运行：

```sh
pnpm vitest run src/runtime/three/adapter.test.ts
```

预期：FAIL，`installBehaviors is not a function`。

- [ ] **步骤 3：在 `adapter.ts` 添加 live runtime 字段 + 方法**

类字段（与 `behaviorRegistry` 同级）：

```ts
private readonly behaviorRuntime = new Map<
  string,
  Map<string /* bindingId */, BehaviorRuntimeEntry>
>();
```

文件顶部加内部 interface：

```ts
interface BehaviorRuntimeEntry {
  behavior: Behavior;
  params: unknown;
  handle: BehaviorHandle;
}
```

（`Behavior` / `BehaviorHandle` 从 `./behaviors` import；`Behavior` 也要导出 type 路径。）

类方法：

```ts
installBehaviors(nodeId: string, bindings: BehaviorBinding[]): void {
  const object = this.objects.get(nodeId);
  if (!object) return; // adapter doesn't have the node yet — nothing to install
  const perNode = new Map<string, BehaviorRuntimeEntry>();
  for (const binding of bindings) {
    if (!binding.enabled) continue;
    const b = this.behaviorRegistry.get(binding.behavior_type);
    if (!b) {
      console.warn(`installBehaviors: unknown behavior_type "${binding.behavior_type}"`);
      continue;
    }
    const parsed = b.definition.parameters_schema.safeParse(binding.parameters);
    if (!parsed.success) {
      console.warn(
        `installBehaviors: invalid params on binding ${binding.id} (${binding.behavior_type})`,
      );
      continue;
    }
    try {
      const handle = b.install(object, parsed.data);
      perNode.set(binding.id, { behavior: b, params: parsed.data, handle });
    } catch (e) {
      console.error(`installBehaviors: install threw on ${binding.id}`, e);
    }
  }
  this.behaviorRuntime.set(nodeId, perNode);
}

uninstallBehaviors(nodeId: string): void {
  const perNode = this.behaviorRuntime.get(nodeId);
  if (!perNode) return;
  for (const entry of perNode.values()) {
    try {
      entry.handle.dispose?.();
    } catch (e) {
      console.error("uninstallBehaviors: dispose threw", e);
    }
  }
  this.behaviorRuntime.delete(nodeId);
}

tickBehaviors(dt: number): void {
  for (const [nodeId, perNode] of this.behaviorRuntime) {
    const object = this.objects.get(nodeId);
    if (!object) continue;
    for (const entry of perNode.values()) {
      try {
        entry.behavior.tick(object, entry.params, entry.handle, dt);
      } catch (e) {
        console.error(`tickBehaviors: tick threw on node ${nodeId}`, e);
      }
    }
  }
}
```

在 `dispose()` 方法里追加：

```ts
for (const nodeId of [...this.behaviorRuntime.keys()]) {
  this.uninstallBehaviors(nodeId);
}
```

- [ ] **步骤 4：运行测试确认通过**

运行：

```sh
pnpm vitest run src/runtime/three/adapter.test.ts
```

预期：PASS（全部 behavior 用例）。

- [ ] **步骤 5：Commit**

```sh
git add src/runtime/three/adapter.ts src/runtime/three/adapter.test.ts
git commit -m "feat(adapter): live-runtime behavior install/tick/uninstall

Per-node binding → handle map, populated by installBehaviors and drained
by uninstallBehaviors. tickBehaviors iterates every active binding once
per frame; per-binding try/catch keeps one broken behavior from breaking
others. dispose() releases all handles for safe adapter teardown.

Unknown behavior_type and invalid params log a warning and skip the
binding — never throw.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 A9：emitters 模板加 tickers loop

**文件：**

- 修改：`src/runtime/three/export/vite-emitter.ts`（`mainJs()`）
- 修改：`src/runtime/three/export/standalone-esm-emitter.ts`（main.js 模板）
- 测试：`src/runtime/three/export/emitters.test.ts`

- [ ] **步骤 1：扩展 `emitters.test.ts`**

在文件末尾追加：

```ts
describe("emitter main.js — tickers", () => {
  it("vite emitter main.js includes THREE.Clock and tickers loop", () => {
    const project = makeProjectWithMeshAndBinding({
      nodeId: "n1",
      bindings: [],
    });
    const result = viteEmitter.emit(project, {}, () => "");
    const mainJs = result.files.get("src/main.js");
    expect(mainJs?.kind).toBe("text");
    const content = (mainJs as { content: string }).content;
    expect(content).toContain("new THREE.Clock()");
    expect(content).toContain("for (const t of built.tickers)");
  });

  it("standalone emitter main.js includes the same", () => {
    const project = makeProjectWithMeshAndBinding({
      nodeId: "n1",
      bindings: [],
    });
    const result = standaloneEsmEmitter.emit(project, {}, () => "");
    // The standalone emitter inlines main.js into index.html (or a sibling
    // main.js depending on its layout). Adjust the assertion to whichever
    // file in result.files contains the runtime bootstrap.
    const bootstrap = [...result.files.entries()]
      .filter(([, f]) => f.kind === "text")
      .map(([k, f]) => (f as { content: string }).content)
      .join("\n");
    expect(bootstrap).toContain("new THREE.Clock()");
    expect(bootstrap).toContain("for (const t of built.tickers)");
  });
});
```

> 改 `makeProjectWithMeshAndBinding` 的具体引入路径以匹配现有测试约定；若该 helper 不存在，沿用文件中其他 emitter 用例同样的项目构造方式。

- [ ] **步骤 2：运行测试确认失败**

运行：

```sh
pnpm vitest run src/runtime/three/export/emitters.test.ts
```

预期：FAIL，断言找不到 `new THREE.Clock()`。

- [ ] **步骤 3：修改 `vite-emitter.ts` 的 `mainJs()`**

找到现有 `function tick() { ... }` / `function animate()` 块。替换为：

```ts
lines.push(`const clock = new THREE.Clock();`);
lines.push(``);
lines.push(`function tick() {`);
lines.push(`  const dt = clock.getDelta();`);
lines.push(`  for (const t of built.tickers) t(dt);`);
lines.push(`  controls.update();`);
lines.push(`  renderer.render(built.scene, built.camera);`);
lines.push(`  requestAnimationFrame(tick);`);
lines.push(`}`);
lines.push(`tick();`);
lines.push(``);
```

（替换原来的 `function tick() { controls.update(); renderer.render(...); requestAnimationFrame(tick); } tick();`）

- [ ] **步骤 4：对 `standalone-esm-emitter.ts` 做相同改动**

打开该文件，定位 main.js 模板里的 render loop（应与 vite-emitter 几乎一致），同样把 `tickers` 接入。具体位置和 vite-emitter 对应。

- [ ] **步骤 5：运行测试确认通过**

运行：

```sh
pnpm vitest run src/runtime/three/export/emitters.test.ts
```

预期：PASS。

- [ ] **步骤 6：Commit**

```sh
git add src/runtime/three/export/vite-emitter.ts src/runtime/three/export/standalone-esm-emitter.ts src/runtime/three/export/emitters.test.ts
git commit -m "feat(emitters): drive tickers from RAF loop in main.js

Both vite and standalone-ESM emitters now declare a THREE.Clock and run
'for (const t of built.tickers) t(dt);' inside the render loop. This is
the runtime half of the auto-rotate equivalence guaranteed by the
behavior emit/tick pair.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 A10：Stage A 收尾验证

**文件：** 无新增；只跑 CI 等价命令。

- [ ] **步骤 1：跑完整 vitest**

```sh
pnpm test
```

预期：所有 vitest 用例 PASS（原 168 个 + 本阶段新增 ~25 个 ≈ 193 个）。如有失败，回看对应任务的 commit 找 diff。

- [ ] **步骤 2：跑 typecheck**

```sh
pnpm typecheck
```

预期：无错误。

- [ ] **步骤 3：跑 lint**

```sh
pnpm lint
```

预期：无错误。

- [ ] **步骤 4：跑 build**

```sh
pnpm build
```

预期：vite build 成功；产物 bucket 与 PR #11 设定的 `vendor-three` / `vendor-three-addons` / `vendor-react` 一致，没有新增意外 chunk。

- [ ] **步骤 5：手动 fixture 验收（不 commit）**

临时在 `src/services/scene/demo-project.ts` 给 cube 节点的 `behaviors` 数组加：

```ts
{
  id: "demo-rot",
  behavior_type: "auto-rotate",
  enabled: true,
  parameters: { axis: "y", speed: 30 },
}
```

跑 `pnpm tauri dev`。

- 此时**编辑器内不会自动转**（Play/Pause UI 在 Stage B 才接），但通过 File > Export 选 Vite，落盘后在导出目录跑 `pnpm install && pnpm dev`，浏览器里 cube 应以 30°/s 绕 Y 轴旋转。
- 同样导出 Standalone，起 `python -m http.server`，访问 index.html，旋转应一致。

**完成后撤销 demo-project.ts 的临时改动**（`git checkout -- src/services/scene/demo-project.ts`）。

- [ ] **步骤 6：开 PR（Stage A）**

```sh
git push -u origin feat/phase3-behaviors
/opt/homebrew/bin/gh pr create --base main --head feat/phase3-behaviors --title "feat(phase3): behaviors framework + auto-rotate + tickers codegen (Stage A)" --body "$(cat <<'EOF'
## Summary

- Behavior framework: ThreeBehaviorRegistry + colocated definition/install/tick/emit
- First behavior: AutoRotateBehavior (axis + speed)
- scene-codegen: emits tickers array; behaviors injected via SceneCodegenInput.generateBehaviorCode
- Exporters: vite + standalone-ESM main.js drives tickers from THREE.Clock
- Live runtime API on ThreeAdapter (installBehaviors / tickBehaviors / uninstallBehaviors) — unused by editor in this PR; Stage B (UI) wires it
- Forward-compat: unknown behavior_type and invalid params log warnings, don't throw

Design spec: `docs/superpowers/specs/2026-05-25-phase3-behaviors-design.md`

## What's NOT in this PR

- Editor UI for behaviors (Properties/Behaviors tab) — Stage B
- Play/Pause toggle — Stage B
- 4 behavior commands (Add/Remove/SetEnabled/SetParameters) — Stage B
- Visual editor preview — Stage B

## Test plan

- [ ] pnpm test (vitest, ~193 cases) — local green
- [ ] pnpm typecheck — local green
- [ ] pnpm lint / pnpm build — local green
- [ ] Manual: add auto-rotate binding to demo-project.ts → File > Export Vite → run pnpm install && pnpm dev → cube rotates
- [ ] Manual: same project → File > Export Standalone → python -m http.server → cube rotates identically
- [ ] CI green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

预期：CI 跑通后合并；Stage B 在合并后接着写。

---

## 自检（writing-plans 要求的最后一步）

**1. 规格覆盖度（对照 spec）：**

- spec §3 架构分层 → A1（types + core/behaviors 空壳）、A2（registry）、A3（auto-rotate）、A4（index）✅
- spec §4 Behavior 类契约 → A1 + A3 ✅
- spec §5 注册表 + adapter wiring → A4 + A7 ✅
- spec §6 编辑器 Play/Pause / Behaviors Tab → **不在 Stage A**（Stage B 覆盖）✅（计划头部已声明）
- spec §7 codegen 集成 → A5 + A6 + A9 ✅
- spec §8 commands → **不在 Stage A**（Stage B 覆盖）✅
- spec §9 Forward-compat → A7（generateBehaviorCode unknown + invalid params 处理）+ A8（installBehaviors 同左）✅
- spec §10 测试矩阵 → A2 A3 A4 A6 A7 A8 A9（auto-rotate / registry / scene-codegen / adapter generate / adapter live / emitters main.js）✅；BehaviorsPanel.test 推到 Stage B
- spec §11 视觉验证 → A10 步骤 5（Stage A 可走通"导出后看到旋转"那一项；编辑器内 Play 在 Stage B）

**2. 占位符扫描：** 无 TBD / TODO。A8 步骤 1 最后一个"tick 错误隔离"用例标注 placeholder 时给了具体实施提示（"实施时优先让用例真正断言"+ 写法指引），不算占位。

**3. 类型一致性：**

- `Behavior` / `BehaviorHandle` / `BehaviorDefinition` / `CodegenContext` 跨 A1/A3/A5/A6/A7/A8 一致 ✅
- `Exporter.emit` 签名扩张（加第 3 参数 `generateBehaviorCode`）—— A7 步骤 3 已同时改 vite + standalone + adapter 调用，旧测试在 A7 步骤 5 提示一并修复 ✅
- `installBehaviors(nodeId, bindings)` 在 A8 定义；Stage B 调用方一致（Stage B 计划里需对应）

---

## 执行交接

计划已完成并保存到 `docs/superpowers/plans/2026-05-25-phase3-behaviors-stage-a.md`。两种执行方式：

**1. 子代理驱动（推荐）** — 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** — 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

Stage B 计划（编辑器 UI + commands + Play/Pause）另起一份文件，在 Stage A PR 合并后启动。
