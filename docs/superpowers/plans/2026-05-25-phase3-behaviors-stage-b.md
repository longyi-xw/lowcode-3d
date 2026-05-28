# Phase 3 Behaviors — Stage B 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 Stage A 框架之上，落地编辑器 UI（Properties↔Behaviors Tab + 参数表单 + 显式 Play/Pause）与 4 条 behavior commands；让用户从图形界面创建、编辑、删除、撤销 auto-rotate binding，并在 Play 模式下看到效果。

**架构：** 5 层垂直栈：① `SceneEditorStore` 加 4 个 mutator；② 4 个 `Command` 类（沿用 `SetNodeTransformCommand` 模板）；③ `BehaviorsPanel` + `BehaviorRow` + `AutoRotateForm` 三层组件；④ `useUIStore` 加 `rightPanelTab` 与 `playState`；⑤ `ThreeViewport` 在 `playState=play` 时启动 `tickBehaviors` 循环并屏蔽 selection / gizmo / command-history。

**技术栈：** Zustand + zod + React 18 + Vitest + @testing-library/react + 现有 i18n（`src/i18n/`）。

**前置：** Stage A 已合并到 main。spec 见 `docs/superpowers/specs/2026-05-25-phase3-behaviors-design.md`。本阶段在 `feat/phase3-behaviors-ui` 新分支（从 main 拉，Stage A 已并入 main）。

**所有 git/pnpm 命令前缀（git hook 需 Node 20）：**

```sh
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
```

下文步骤里的 `pnpm` / `git` 命令默认假设此 PATH 已经导出。

**起手：**

```sh
git checkout main && git pull
git checkout -b feat/phase3-behaviors-ui
```

---

## 文件结构（Stage B 涉及）

**新增：**

- `src/core/command/commands/add-behavior.ts` + `.test.ts`
- `src/core/command/commands/remove-behavior.ts` + `.test.ts`
- `src/core/command/commands/set-behavior-enabled.ts` + `.test.ts`
- `src/core/command/commands/set-behavior-parameters.ts` + `.test.ts`
- `src/ui/editor/BehaviorsPanel.tsx` + `.test.tsx`
- `src/ui/editor/BehaviorRow.tsx`
- `src/ui/editor/behavior-params/AutoRotateForm.tsx`
- `src/ui/editor/behavior-params/registry.ts` —— `BEHAVIOR_FORM_REGISTRY`
- `src/ui/viewport/PlayButton.tsx`

**修改：**

- `src/core/command/types.ts` —— `SceneEditorStore` 接口加 4 个新方法签名
- `src/services/scene/store.ts` —— 实现 4 个 mutator
- `src/services/scene/store.test.ts` —— 测试 4 个 mutator
- `src/services/ui/store.ts` —— 加 `rightPanelTab` / `playState`
- `src/services/ui/store.test.ts` —— 扩展
- `src/services/command-history/store.ts` —— `execute` / `undo` / `redo` 在 `playState=play` 时 no-op
- `src/services/command-history/use-keyboard-shortcuts.ts` —— Cmd+Z 在 play 时吞掉
- `src/ui/views/EditorView.tsx` —— 右侧 aside 顶部加 Tab 栏；按 `rightPanelTab` 切换 Properties / BehaviorsPanel；Properties 在 `playState=play` 时全部 disabled
- `src/ui/viewport/ThreeViewport.tsx` —— Play 模式副作用：detach gizmo、清 outline、pickAt 旁路、RAF tick + 恢复 transform
- `src/i18n/locales/zh-CN.json` + `en-US.json` —— behaviors / play 相关 keys

---

## 任务 B1：SceneEditorStore 接口 + useSceneStore mutators

**文件：**

- 修改：`src/core/command/types.ts`
- 修改：`src/services/scene/store.ts`
- 测试：`src/services/scene/store.test.ts`

- [ ] **步骤 1：扩展 `SceneEditorStore` 接口**

打开 `src/core/command/types.ts`，给 `SceneEditorStore` 加四个方法（合现有 `setNodeTransform` 同级）：

```ts
import type { BehaviorBinding, SceneNode, Transform } from "@/core/scene/types";

export interface SceneEditorStore {
  getNode(id: string): SceneNode | undefined;
  setNodeTransform(id: string, transform: Transform): void;
  // ── new (Phase 3 Stage B) ──
  addBehavior(nodeId: string, binding: BehaviorBinding): void;
  removeBehavior(nodeId: string, bindingId: string): void;
  setBehaviorEnabled(nodeId: string, bindingId: string, enabled: boolean): void;
  setBehaviorParameters(
    nodeId: string,
    bindingId: string,
    parameters: Record<string, unknown>,
  ): void;
}
```

- [ ] **步骤 2：编写失败的测试 `store.test.ts`**

在文件末尾追加：

```ts
import type { BehaviorBinding } from "@/core/scene/types";

describe("useSceneStore behavior mutators", () => {
  function seedProjectWithNode(nodeId: string) {
    const project = makeEmptyProject(); // existing helper
    project.scene.root_node_ids = [nodeId];
    project.scene.nodes[nodeId] = makeMeshNode(nodeId); // existing helper
    useSceneStore.getState().setProject(project);
  }

  const sampleBinding: BehaviorBinding = {
    id: "b1",
    behavior_type: "auto-rotate",
    enabled: true,
    parameters: { axis: "y", speed: 30 },
  };

  beforeEach(() => {
    useSceneStore.getState().setProject(null);
  });

  it("addBehavior appends a binding to the node", () => {
    seedProjectWithNode("n1");
    useSceneStore.getState().addBehavior("n1", sampleBinding);
    expect(useSceneStore.getState().getNode("n1")!.behaviors).toEqual([sampleBinding]);
  });

  it("addBehavior throws when binding.id is already on the node", () => {
    seedProjectWithNode("n1");
    useSceneStore.getState().addBehavior("n1", sampleBinding);
    expect(() => useSceneStore.getState().addBehavior("n1", sampleBinding)).toThrow(
      /duplicate/,
    );
  });

  it("removeBehavior drops the binding by id", () => {
    seedProjectWithNode("n1");
    useSceneStore.getState().addBehavior("n1", sampleBinding);
    useSceneStore.getState().removeBehavior("n1", "b1");
    expect(useSceneStore.getState().getNode("n1")!.behaviors).toEqual([]);
  });

  it("removeBehavior on unknown bindingId is a silent no-op", () => {
    seedProjectWithNode("n1");
    expect(() => useSceneStore.getState().removeBehavior("n1", "nope")).not.toThrow();
  });

  it("setBehaviorEnabled flips the flag on the matching binding", () => {
    seedProjectWithNode("n1");
    useSceneStore.getState().addBehavior("n1", sampleBinding);
    useSceneStore.getState().setBehaviorEnabled("n1", "b1", false);
    expect(useSceneStore.getState().getNode("n1")!.behaviors[0].enabled).toBe(false);
  });

  it("setBehaviorParameters replaces the params object", () => {
    seedProjectWithNode("n1");
    useSceneStore.getState().addBehavior("n1", sampleBinding);
    useSceneStore
      .getState()
      .setBehaviorParameters("n1", "b1", { axis: "x", speed: 90 });
    expect(useSceneStore.getState().getNode("n1")!.behaviors[0].parameters).toEqual({
      axis: "x",
      speed: 90,
    });
  });

  it("each mutator produces a new SceneNode identity (structural sharing)", () => {
    seedProjectWithNode("n1");
    const before = useSceneStore.getState().getNode("n1");
    useSceneStore.getState().addBehavior("n1", sampleBinding);
    const after = useSceneStore.getState().getNode("n1");
    expect(after).not.toBe(before);
  });
});
```

> `makeEmptyProject` / `makeMeshNode` 是测试文件里已有的 helper；若不在，沿用文件中其它现有用例同样的 inline 构造。

- [ ] **步骤 3：运行测试确认失败**

```sh
pnpm vitest run src/services/scene/store.test.ts
```

预期：FAIL，`addBehavior is not a function` 等。

- [ ] **步骤 4：在 `store.ts` 添加 4 个 mutator**

在 `SceneState` interface 加 4 个方法签名（紧跟 `addAsset` 后）：

```ts
addBehavior(nodeId: string, binding: BehaviorBinding): void;
removeBehavior(nodeId: string, bindingId: string): void;
setBehaviorEnabled(nodeId: string, bindingId: string, enabled: boolean): void;
setBehaviorParameters(
  nodeId: string,
  bindingId: string,
  parameters: Record<string, unknown>,
): void;
```

在 `create<SceneState>((set, get) => ({ ... }))` body 里实现（紧跟 `addAsset` 后）：

```ts
addBehavior: (nodeId, binding) =>
  set((s) => {
    if (!s.project) return s;
    const node = s.project.scene.nodes[nodeId];
    if (!node) return s;
    if (node.behaviors.some((b) => b.id === binding.id)) {
      throw new Error(`addBehavior: duplicate binding id "${binding.id}"`);
    }
    const nextNode: SceneNode = {
      ...node,
      behaviors: [...node.behaviors, binding],
    };
    return mutateNode(s, nodeId, nextNode);
  }),

removeBehavior: (nodeId, bindingId) =>
  set((s) => {
    if (!s.project) return s;
    const node = s.project.scene.nodes[nodeId];
    if (!node) return s;
    const next = node.behaviors.filter((b) => b.id !== bindingId);
    if (next.length === node.behaviors.length) return s; // no-op
    const nextNode: SceneNode = { ...node, behaviors: next };
    return mutateNode(s, nodeId, nextNode);
  }),

setBehaviorEnabled: (nodeId, bindingId, enabled) =>
  set((s) => {
    if (!s.project) return s;
    const node = s.project.scene.nodes[nodeId];
    if (!node) return s;
    const next = node.behaviors.map((b) =>
      b.id === bindingId ? { ...b, enabled } : b,
    );
    const nextNode: SceneNode = { ...node, behaviors: next };
    return mutateNode(s, nodeId, nextNode);
  }),

setBehaviorParameters: (nodeId, bindingId, parameters) =>
  set((s) => {
    if (!s.project) return s;
    const node = s.project.scene.nodes[nodeId];
    if (!node) return s;
    const next = node.behaviors.map((b) =>
      b.id === bindingId ? { ...b, parameters } : b,
    );
    const nextNode: SceneNode = { ...node, behaviors: next };
    return mutateNode(s, nodeId, nextNode);
  }),
```

如果文件里还没有 `mutateNode` helper，紧靠现有的 `setNodeTransform` 实现，把那块通用 "替换一个 node + 刷 updated_at" 的逻辑抽到一个文件内私有函数：

```ts
function mutateNode(s: SceneState, nodeId: string, nextNode: SceneNode) {
  if (!s.project) return s;
  return {
    project: {
      ...s.project,
      metadata: {
        ...s.project.metadata,
        updated_at: new Date().toISOString(),
      },
      scene: {
        ...s.project.scene,
        nodes: { ...s.project.scene.nodes, [nodeId]: nextNode },
      },
    },
  };
}
```

（同时把 `setNodeTransform` 内联块替换为 `return mutateNode(s, id, nextNode);`，验证现有 transform 测试不退化。这一步是受当前任务影响的 surgical refactor，符合"经手就修"原则。）

- [ ] **步骤 5：运行测试确认通过**

```sh
pnpm vitest run src/services/scene/store.test.ts
```

预期：PASS（新增 7 用例 + 原有用例不退化）。

- [ ] **步骤 6：Commit**

```sh
git add src/core/command/types.ts src/services/scene/store.ts src/services/scene/store.test.ts
git commit -m "feat(scene-store): 4 behavior mutators

addBehavior / removeBehavior / setBehaviorEnabled / setBehaviorParameters,
implemented with structural sharing so React selectors only re-render the
nodes that actually changed. addBehavior throws on duplicate binding id —
caller (Command) must generate a fresh id.

Refactors setNodeTransform onto a shared mutateNode helper to keep the
identity-update logic consistent across all node mutators.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 B2：AddBehaviorCommand

**文件：**

- 创建：`src/core/command/commands/add-behavior.ts`
- 测试：`src/core/command/commands/add-behavior.test.ts`

- [ ] **步骤 1：编写失败的测试 `add-behavior.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { BehaviorBinding } from "@/core/scene/types";

import { AddBehaviorCommand, ADD_BEHAVIOR } from "./add-behavior";
import { makeFakeEditor } from "./_test-utils"; // see step 2

describe("AddBehaviorCommand", () => {
  const binding: BehaviorBinding = {
    id: "b1",
    behavior_type: "auto-rotate",
    enabled: true,
    parameters: { axis: "y", speed: 30 },
  };

  it("apply calls addBehavior", () => {
    const editor = makeFakeEditor();
    const cmd = new AddBehaviorCommand({ node_id: "n1", binding });
    cmd.apply(editor);
    expect(editor.calls).toEqual([{ op: "addBehavior", nodeId: "n1", binding }]);
  });

  it("revert calls removeBehavior", () => {
    const editor = makeFakeEditor();
    const cmd = new AddBehaviorCommand({ node_id: "n1", binding });
    cmd.revert(editor);
    expect(editor.calls).toEqual([
      { op: "removeBehavior", nodeId: "n1", bindingId: "b1" },
    ]);
  });

  it("type === ADD_BEHAVIOR", () => {
    expect(new AddBehaviorCommand({ node_id: "n1", binding }).type).toBe(ADD_BEHAVIOR);
  });

  it("does not merge with any other command", () => {
    const a = new AddBehaviorCommand({ node_id: "n1", binding });
    const b = new AddBehaviorCommand({ node_id: "n1", binding });
    expect(a.canMergeWith(b)).toBe(false);
  });
});
```

`_test-utils.ts`（新增 helper，复用给后面三个 commands）：

```ts
// src/core/command/commands/_test-utils.ts
import type { BehaviorBinding, SceneNode, Transform } from "@/core/scene/types";
import type { SceneEditorStore } from "../types";

type Call =
  | { op: "addBehavior"; nodeId: string; binding: BehaviorBinding }
  | { op: "removeBehavior"; nodeId: string; bindingId: string }
  | {
      op: "setBehaviorEnabled";
      nodeId: string;
      bindingId: string;
      enabled: boolean;
    }
  | {
      op: "setBehaviorParameters";
      nodeId: string;
      bindingId: string;
      parameters: Record<string, unknown>;
    }
  | { op: "setNodeTransform"; id: string; transform: Transform };

export function makeFakeEditor(node?: SceneNode): SceneEditorStore & {
  calls: Call[];
} {
  const calls: Call[] = [];
  return {
    calls,
    getNode: () => node,
    setNodeTransform: (id, transform) =>
      calls.push({ op: "setNodeTransform", id, transform }),
    addBehavior: (nodeId, binding) =>
      calls.push({ op: "addBehavior", nodeId, binding }),
    removeBehavior: (nodeId, bindingId) =>
      calls.push({ op: "removeBehavior", nodeId, bindingId }),
    setBehaviorEnabled: (nodeId, bindingId, enabled) =>
      calls.push({ op: "setBehaviorEnabled", nodeId, bindingId, enabled }),
    setBehaviorParameters: (nodeId, bindingId, parameters) =>
      calls.push({
        op: "setBehaviorParameters",
        nodeId,
        bindingId,
        parameters,
      }),
  };
}
```

- [ ] **步骤 2：运行测试确认失败**

```sh
pnpm vitest run src/core/command/commands/add-behavior.test.ts
```

预期：FAIL，找不到模块。

- [ ] **步骤 3：实现 `add-behavior.ts`**

```ts
import type { BehaviorBinding } from "@/core/scene/types";
import { generateUUID } from "../../id/uuid";
import type { Command, SceneEditorStore } from "../types";

export const ADD_BEHAVIOR = "node.behavior.add" as const;

export interface AddBehaviorPayload extends Record<string, unknown> {
  node_id: string;
  binding: BehaviorBinding;
}

export interface AddBehaviorInput {
  node_id: string;
  binding: BehaviorBinding;
  id?: string;
  timestamp?: number;
}

export class AddBehaviorCommand implements Command {
  readonly id: string;
  readonly type = ADD_BEHAVIOR;
  readonly timestamp: number;
  readonly payload: AddBehaviorPayload;

  constructor(input: AddBehaviorInput) {
    this.id = input.id ?? generateUUID();
    this.timestamp = input.timestamp ?? Date.now();
    this.payload = { node_id: input.node_id, binding: input.binding };
  }

  apply(store: SceneEditorStore): void {
    store.addBehavior(this.payload.node_id, this.payload.binding);
  }

  revert(store: SceneEditorStore): void {
    store.removeBehavior(this.payload.node_id, this.payload.binding.id);
  }

  canMergeWith(_other: Command): boolean {
    return false;
  }

  mergeWith(_other: Command): AddBehaviorCommand {
    throw new Error("AddBehaviorCommand: never merges");
  }
}
```

- [ ] **步骤 4：运行测试确认通过**

```sh
pnpm vitest run src/core/command/commands/add-behavior.test.ts
```

预期：PASS（4 tests）。

- [ ] **步骤 5：Commit**

```sh
git add src/core/command/commands/add-behavior.ts src/core/command/commands/add-behavior.test.ts src/core/command/commands/_test-utils.ts
git commit -m "feat(commands): AddBehaviorCommand + shared fake editor

Apply attaches the binding; revert removes it by id. Never merges (each
add is a discrete authoring action). _test-utils.makeFakeEditor is shared
by the next three behavior command tests.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 B3：RemoveBehaviorCommand

**文件：**

- 创建：`src/core/command/commands/remove-behavior.ts`
- 测试：`src/core/command/commands/remove-behavior.test.ts`

- [ ] **步骤 1：编写失败的测试**

```ts
import { describe, expect, it } from "vitest";
import type { BehaviorBinding } from "@/core/scene/types";

import { RemoveBehaviorCommand, REMOVE_BEHAVIOR } from "./remove-behavior";
import { makeFakeEditor } from "./_test-utils";

const binding: BehaviorBinding = {
  id: "b1",
  behavior_type: "auto-rotate",
  enabled: true,
  parameters: { axis: "y", speed: 30 },
};

describe("RemoveBehaviorCommand", () => {
  it("apply calls removeBehavior", () => {
    const editor = makeFakeEditor();
    new RemoveBehaviorCommand({ node_id: "n1", prev_binding: binding }).apply(editor);
    expect(editor.calls).toEqual([
      { op: "removeBehavior", nodeId: "n1", bindingId: "b1" },
    ]);
  });

  it("revert re-adds the full binding (restores enabled + parameters)", () => {
    const editor = makeFakeEditor();
    new RemoveBehaviorCommand({ node_id: "n1", prev_binding: binding }).revert(editor);
    expect(editor.calls).toEqual([{ op: "addBehavior", nodeId: "n1", binding }]);
  });

  it("type === REMOVE_BEHAVIOR", () => {
    expect(
      new RemoveBehaviorCommand({ node_id: "n1", prev_binding: binding }).type,
    ).toBe(REMOVE_BEHAVIOR);
  });

  it("never merges", () => {
    const a = new RemoveBehaviorCommand({ node_id: "n1", prev_binding: binding });
    const b = new RemoveBehaviorCommand({ node_id: "n1", prev_binding: binding });
    expect(a.canMergeWith(b)).toBe(false);
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

```sh
pnpm vitest run src/core/command/commands/remove-behavior.test.ts
```

预期：FAIL。

- [ ] **步骤 3：实现 `remove-behavior.ts`**

```ts
import type { BehaviorBinding } from "@/core/scene/types";
import { generateUUID } from "../../id/uuid";
import type { Command, SceneEditorStore } from "../types";

export const REMOVE_BEHAVIOR = "node.behavior.remove" as const;

export interface RemoveBehaviorPayload extends Record<string, unknown> {
  node_id: string;
  prev_binding: BehaviorBinding;
}

export interface RemoveBehaviorInput {
  node_id: string;
  prev_binding: BehaviorBinding;
  id?: string;
  timestamp?: number;
}

export class RemoveBehaviorCommand implements Command {
  readonly id: string;
  readonly type = REMOVE_BEHAVIOR;
  readonly timestamp: number;
  readonly payload: RemoveBehaviorPayload;

  constructor(input: RemoveBehaviorInput) {
    this.id = input.id ?? generateUUID();
    this.timestamp = input.timestamp ?? Date.now();
    this.payload = {
      node_id: input.node_id,
      prev_binding: input.prev_binding,
    };
  }

  apply(store: SceneEditorStore): void {
    store.removeBehavior(this.payload.node_id, this.payload.prev_binding.id);
  }

  revert(store: SceneEditorStore): void {
    store.addBehavior(this.payload.node_id, this.payload.prev_binding);
  }

  canMergeWith(_other: Command): boolean {
    return false;
  }

  mergeWith(_other: Command): RemoveBehaviorCommand {
    throw new Error("RemoveBehaviorCommand: never merges");
  }
}
```

- [ ] **步骤 4：运行测试确认通过**

```sh
pnpm vitest run src/core/command/commands/remove-behavior.test.ts
```

预期：PASS（4 tests）。

- [ ] **步骤 5：Commit**

```sh
git add src/core/command/commands/remove-behavior.ts src/core/command/commands/remove-behavior.test.ts
git commit -m "feat(commands): RemoveBehaviorCommand

Apply removes by id; revert re-adds the full prev_binding so enabled +
parameters round-trip exactly.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 B4：SetBehaviorEnabledCommand

**文件：**

- 创建：`src/core/command/commands/set-behavior-enabled.ts`
- 测试：`src/core/command/commands/set-behavior-enabled.test.ts`

- [ ] **步骤 1：编写失败的测试**

```ts
import { describe, expect, it } from "vitest";

import {
  SetBehaviorEnabledCommand,
  SET_BEHAVIOR_ENABLED,
} from "./set-behavior-enabled";
import { makeFakeEditor } from "./_test-utils";

describe("SetBehaviorEnabledCommand", () => {
  it("apply sets enabled to the new value", () => {
    const editor = makeFakeEditor();
    new SetBehaviorEnabledCommand({
      node_id: "n1",
      binding_id: "b1",
      enabled: false,
      prev_enabled: true,
    }).apply(editor);
    expect(editor.calls).toEqual([
      { op: "setBehaviorEnabled", nodeId: "n1", bindingId: "b1", enabled: false },
    ]);
  });

  it("revert restores prev_enabled", () => {
    const editor = makeFakeEditor();
    new SetBehaviorEnabledCommand({
      node_id: "n1",
      binding_id: "b1",
      enabled: false,
      prev_enabled: true,
    }).revert(editor);
    expect(editor.calls).toEqual([
      { op: "setBehaviorEnabled", nodeId: "n1", bindingId: "b1", enabled: true },
    ]);
  });

  it("type === SET_BEHAVIOR_ENABLED", () => {
    expect(
      new SetBehaviorEnabledCommand({
        node_id: "n1",
        binding_id: "b1",
        enabled: false,
        prev_enabled: true,
      }).type,
    ).toBe(SET_BEHAVIOR_ENABLED);
  });

  it("never merges", () => {
    const a = new SetBehaviorEnabledCommand({
      node_id: "n1",
      binding_id: "b1",
      enabled: false,
      prev_enabled: true,
    });
    const b = new SetBehaviorEnabledCommand({
      node_id: "n1",
      binding_id: "b1",
      enabled: true,
      prev_enabled: false,
    });
    expect(a.canMergeWith(b)).toBe(false);
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

```sh
pnpm vitest run src/core/command/commands/set-behavior-enabled.test.ts
```

预期：FAIL。

- [ ] **步骤 3：实现 `set-behavior-enabled.ts`**

```ts
import { generateUUID } from "../../id/uuid";
import type { Command, SceneEditorStore } from "../types";

export const SET_BEHAVIOR_ENABLED = "node.behavior.enabled.set" as const;

export interface SetBehaviorEnabledPayload extends Record<string, unknown> {
  node_id: string;
  binding_id: string;
  enabled: boolean;
  prev_enabled: boolean;
}

export interface SetBehaviorEnabledInput {
  node_id: string;
  binding_id: string;
  enabled: boolean;
  prev_enabled: boolean;
  id?: string;
  timestamp?: number;
}

export class SetBehaviorEnabledCommand implements Command {
  readonly id: string;
  readonly type = SET_BEHAVIOR_ENABLED;
  readonly timestamp: number;
  readonly payload: SetBehaviorEnabledPayload;

  constructor(input: SetBehaviorEnabledInput) {
    this.id = input.id ?? generateUUID();
    this.timestamp = input.timestamp ?? Date.now();
    this.payload = {
      node_id: input.node_id,
      binding_id: input.binding_id,
      enabled: input.enabled,
      prev_enabled: input.prev_enabled,
    };
  }

  apply(store: SceneEditorStore): void {
    store.setBehaviorEnabled(
      this.payload.node_id,
      this.payload.binding_id,
      this.payload.enabled,
    );
  }

  revert(store: SceneEditorStore): void {
    store.setBehaviorEnabled(
      this.payload.node_id,
      this.payload.binding_id,
      this.payload.prev_enabled,
    );
  }

  canMergeWith(_other: Command): boolean {
    return false;
  }

  mergeWith(_other: Command): SetBehaviorEnabledCommand {
    throw new Error("SetBehaviorEnabledCommand: never merges");
  }
}
```

- [ ] **步骤 4：运行测试确认通过**

```sh
pnpm vitest run src/core/command/commands/set-behavior-enabled.test.ts
```

预期：PASS（4 tests）。

- [ ] **步骤 5：Commit**

```sh
git add src/core/command/commands/set-behavior-enabled.ts src/core/command/commands/set-behavior-enabled.test.ts
git commit -m "feat(commands): SetBehaviorEnabledCommand

Discrete toggle action — never merges (toggles always create a new undo
entry to preserve intent).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 B5：SetBehaviorParametersCommand（含 500ms 合并窗口）

**文件：**

- 创建：`src/core/command/commands/set-behavior-parameters.ts`
- 测试：`src/core/command/commands/set-behavior-parameters.test.ts`

- [ ] **步骤 1：编写失败的测试**

```ts
import { describe, expect, it } from "vitest";

import {
  SetBehaviorParametersCommand,
  SET_BEHAVIOR_PARAMETERS,
  PARAMS_MERGE_WINDOW_MS,
} from "./set-behavior-parameters";
import { makeFakeEditor } from "./_test-utils";

describe("SetBehaviorParametersCommand", () => {
  const base = {
    node_id: "n1",
    binding_id: "b1",
    parameters: { axis: "y", speed: 30 },
    prev_parameters: { axis: "y", speed: 0 },
  };

  it("apply sets new parameters; revert restores prev_parameters", () => {
    const editor = makeFakeEditor();
    const cmd = new SetBehaviorParametersCommand(base);
    cmd.apply(editor);
    cmd.revert(editor);
    expect(editor.calls).toEqual([
      {
        op: "setBehaviorParameters",
        nodeId: "n1",
        bindingId: "b1",
        parameters: { axis: "y", speed: 30 },
      },
      {
        op: "setBehaviorParameters",
        nodeId: "n1",
        bindingId: "b1",
        parameters: { axis: "y", speed: 0 },
      },
    ]);
  });

  it("merges with another SET_BEHAVIOR_PARAMETERS on same binding within window", () => {
    const t = Date.now();
    const a = new SetBehaviorParametersCommand({ ...base, timestamp: t });
    const b = new SetBehaviorParametersCommand({
      ...base,
      parameters: { axis: "y", speed: 60 },
      prev_parameters: { axis: "y", speed: 30 },
      timestamp: t + 100,
    });
    expect(a.canMergeWith(b)).toBe(true);
    const merged = a.mergeWith(b);
    // Merged: keeps a.prev_parameters (gesture origin) + b.parameters (latest)
    expect(merged.payload.prev_parameters).toEqual({ axis: "y", speed: 0 });
    expect(merged.payload.parameters).toEqual({ axis: "y", speed: 60 });
    expect(merged.id).toBe(a.id);
  });

  it("does NOT merge across different binding ids", () => {
    const t = Date.now();
    const a = new SetBehaviorParametersCommand({ ...base, timestamp: t });
    const b = new SetBehaviorParametersCommand({
      ...base,
      binding_id: "b2",
      timestamp: t + 100,
    });
    expect(a.canMergeWith(b)).toBe(false);
  });

  it("does NOT merge beyond the time window", () => {
    const t = Date.now();
    const a = new SetBehaviorParametersCommand({ ...base, timestamp: t });
    const b = new SetBehaviorParametersCommand({
      ...base,
      timestamp: t + PARAMS_MERGE_WINDOW_MS + 1,
    });
    expect(a.canMergeWith(b)).toBe(false);
  });

  it("does NOT merge with other command types", () => {
    const t = Date.now();
    const a = new SetBehaviorParametersCommand({ ...base, timestamp: t });
    const other = { type: "node.transform.set", timestamp: t + 10 } as never;
    expect(a.canMergeWith(other)).toBe(false);
  });

  it("type === SET_BEHAVIOR_PARAMETERS", () => {
    expect(new SetBehaviorParametersCommand(base).type).toBe(SET_BEHAVIOR_PARAMETERS);
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

```sh
pnpm vitest run src/core/command/commands/set-behavior-parameters.test.ts
```

预期：FAIL。

- [ ] **步骤 3：实现 `set-behavior-parameters.ts`**

```ts
import { generateUUID } from "../../id/uuid";
import type { Command, SceneEditorStore } from "../types";

export const SET_BEHAVIOR_PARAMETERS = "node.behavior.parameters.set" as const;
export const PARAMS_MERGE_WINDOW_MS = 500;

export interface SetBehaviorParametersPayload extends Record<string, unknown> {
  node_id: string;
  binding_id: string;
  parameters: Record<string, unknown>;
  prev_parameters: Record<string, unknown>;
}

export interface SetBehaviorParametersInput {
  node_id: string;
  binding_id: string;
  parameters: Record<string, unknown>;
  prev_parameters: Record<string, unknown>;
  id?: string;
  timestamp?: number;
}

export class SetBehaviorParametersCommand implements Command {
  readonly id: string;
  readonly type = SET_BEHAVIOR_PARAMETERS;
  readonly timestamp: number;
  readonly payload: SetBehaviorParametersPayload;

  constructor(input: SetBehaviorParametersInput) {
    this.id = input.id ?? generateUUID();
    this.timestamp = input.timestamp ?? Date.now();
    this.payload = {
      node_id: input.node_id,
      binding_id: input.binding_id,
      parameters: input.parameters,
      prev_parameters: input.prev_parameters,
    };
  }

  apply(store: SceneEditorStore): void {
    store.setBehaviorParameters(
      this.payload.node_id,
      this.payload.binding_id,
      this.payload.parameters,
    );
  }

  revert(store: SceneEditorStore): void {
    store.setBehaviorParameters(
      this.payload.node_id,
      this.payload.binding_id,
      this.payload.prev_parameters,
    );
  }

  canMergeWith(other: Command): boolean {
    if (other.type !== SET_BEHAVIOR_PARAMETERS) return false;
    const otherPayload = other.payload as SetBehaviorParametersPayload;
    if (otherPayload.binding_id !== this.payload.binding_id) return false;
    if (otherPayload.node_id !== this.payload.node_id) return false;
    return Math.abs(other.timestamp - this.timestamp) < PARAMS_MERGE_WINDOW_MS;
  }

  mergeWith(other: Command): SetBehaviorParametersCommand {
    if (!this.canMergeWith(other)) {
      throw new Error(
        "SetBehaviorParametersCommand: cannot merge — binding_id or window mismatch",
      );
    }
    const otherPayload = other.payload as SetBehaviorParametersPayload;
    return new SetBehaviorParametersCommand({
      id: this.id,
      node_id: this.payload.node_id,
      binding_id: this.payload.binding_id,
      parameters: otherPayload.parameters,
      prev_parameters: this.payload.prev_parameters,
      timestamp: other.timestamp,
    });
  }
}
```

- [ ] **步骤 4：运行测试确认通过**

```sh
pnpm vitest run src/core/command/commands/set-behavior-parameters.test.ts
```

预期：PASS（6 tests）。

- [ ] **步骤 5：Commit**

```sh
git add src/core/command/commands/set-behavior-parameters.ts src/core/command/commands/set-behavior-parameters.test.ts
git commit -m "feat(commands): SetBehaviorParametersCommand with merge window

Mirrors SetNodeTransformCommand's 500ms merge window: typing in a number
input fires per-keystroke, but the undo stack collapses bursts to one
entry. Earliest prev_parameters + latest parameters survive merge so
revert returns to the value before the burst started.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 B6：useUIStore 扩展

**文件：**

- 修改：`src/services/ui/store.ts`
- 修改：`src/services/ui/store.test.ts`

- [ ] **步骤 1：扩展测试**

```ts
describe("useUIStore — Phase 3 Stage B", () => {
  beforeEach(() => {
    // reset to defaults
    useUIStore.setState({
      rightPanelTab: "properties",
      playState: "edit",
    });
  });

  it("rightPanelTab defaults to 'properties'", () => {
    expect(useUIStore.getState().rightPanelTab).toBe("properties");
  });

  it("setRightPanelTab switches to behaviors", () => {
    useUIStore.getState().setRightPanelTab("behaviors");
    expect(useUIStore.getState().rightPanelTab).toBe("behaviors");
  });

  it("playState defaults to 'edit'", () => {
    expect(useUIStore.getState().playState).toBe("edit");
  });

  it("setPlayState toggles between edit and play", () => {
    useUIStore.getState().setPlayState("play");
    expect(useUIStore.getState().playState).toBe("play");
    useUIStore.getState().setPlayState("edit");
    expect(useUIStore.getState().playState).toBe("edit");
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

```sh
pnpm vitest run src/services/ui/store.test.ts
```

预期：FAIL。

- [ ] **步骤 3：扩展 `store.ts`**

在 `UIState` interface 加：

```ts
export type RightPanelTab = "properties" | "behaviors";
export type PlayState = "edit" | "play";

interface UIState {
  // ... existing fields ...
  rightPanelTab: RightPanelTab;
  setRightPanelTab: (tab: RightPanelTab) => void;
  playState: PlayState;
  setPlayState: (state: PlayState) => void;
}
```

在 `create<UIState>((set) => ({ ... }))` 里追加：

```ts
rightPanelTab: "properties",
setRightPanelTab: (rightPanelTab) => set({ rightPanelTab }),
playState: "edit",
setPlayState: (playState) => set({ playState }),
```

- [ ] **步骤 4：运行测试确认通过**

```sh
pnpm vitest run src/services/ui/store.test.ts
```

预期：PASS。

- [ ] **步骤 5：Commit**

```sh
git add src/services/ui/store.ts src/services/ui/store.test.ts
git commit -m "feat(ui-store): rightPanelTab + playState

Two new ephemeral fields:
- rightPanelTab: which tab is showing in the right aside ('properties'|'behaviors')
- playState: whether the editor is in authoring mode ('edit') or running
  behaviors ('play')

Both reset on session start (consistent with the rest of useUIStore).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 B7：Play 模式下 command-history 屏蔽

**文件：**

- 修改：`src/services/command-history/store.ts`
- 修改：`src/services/command-history/use-keyboard-shortcuts.ts`
- 修改：`src/services/command-history/store.test.ts`

- [ ] **步骤 1：扩展 store 测试**

```ts
import { useUIStore } from "@/services/ui/store";

describe("useCommandHistoryStore — play mode", () => {
  beforeEach(() => {
    useCommandHistoryStore.getState().clear();
    useUIStore.setState({ playState: "edit" });
  });

  function noopCommand(): Command {
    return {
      id: "c1",
      type: "test",
      timestamp: 0,
      payload: {},
      apply: vi.fn(),
      revert: vi.fn(),
      canMergeWith: () => false,
      mergeWith: () => {
        throw new Error("no merge");
      },
    };
  }

  it("execute is a no-op when playState === 'play'", () => {
    useUIStore.setState({ playState: "play" });
    const cmd = noopCommand();
    useCommandHistoryStore.getState().execute(cmd, {} as SceneEditorStore);
    expect(cmd.apply).not.toHaveBeenCalled();
    expect(useCommandHistoryStore.getState().undoStack).toEqual([]);
  });

  it("undo is a no-op when playState === 'play'", () => {
    // seed with one entry in edit mode
    const cmd = noopCommand();
    useCommandHistoryStore.getState().execute(cmd, {} as SceneEditorStore);
    useUIStore.setState({ playState: "play" });
    useCommandHistoryStore.getState().undo({} as SceneEditorStore);
    expect(cmd.revert).not.toHaveBeenCalled();
    expect(useCommandHistoryStore.getState().undoStack.length).toBe(1);
  });

  it("redo is a no-op when playState === 'play'", () => {
    const cmd = noopCommand();
    useCommandHistoryStore.getState().execute(cmd, {} as SceneEditorStore);
    useCommandHistoryStore.getState().undo({} as SceneEditorStore);
    useUIStore.setState({ playState: "play" });
    useCommandHistoryStore.getState().redo({} as SceneEditorStore);
    expect(useCommandHistoryStore.getState().redoStack.length).toBe(1);
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

```sh
pnpm vitest run src/services/command-history/store.test.ts
```

预期：FAIL — `cmd.apply` 被调用了 / 栈 push 了。

- [ ] **步骤 3：在 `store.ts` 加 play 模式判断**

在文件顶部加 import：

```ts
import { useUIStore } from "@/services/ui/store";
```

在 `execute` / `undo` / `redo` 三处入口加守卫：

```ts
execute: (command, editor) => {
  if (useUIStore.getState().playState === "play") return;
  // ... existing body ...
},

undo: (editor) => {
  if (useUIStore.getState().playState === "play") return;
  set((s) => { /* existing body */ });
},

redo: (editor) => {
  if (useUIStore.getState().playState === "play") return;
  set((s) => { /* existing body */ });
},
```

- [ ] **步骤 4：在 `use-keyboard-shortcuts.ts` 也加守卫**

读现有文件，找到 keydown handler 里 dispatch `undo`/`redo` 的地方，加：

```ts
if (useUIStore.getState().playState === "play") return;
```

`shortcuts` 测试如有覆盖，对应扩展用例。

- [ ] **步骤 5：运行测试确认通过**

```sh
pnpm vitest run src/services/command-history
```

预期：PASS（新增 3 + 原有）。

- [ ] **步骤 6：Commit**

```sh
git add src/services/command-history/store.ts src/services/command-history/use-keyboard-shortcuts.ts src/services/command-history/store.test.ts
git commit -m "feat(command-history): freeze stack in play mode

execute / undo / redo become no-ops when useUIStore.playState is 'play'.
This keeps behavior tick (which mutates the live Object3D but not the
SceneNode) from competing with the command bus, and prevents Cmd+Z from
silently reverting authoring state while watching a preview.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 B8：i18n keys

**文件：**

- 修改：`src/i18n/locales/en-US.json`（或对应文件）
- 修改：`src/i18n/locales/zh-CN.json`

> 先开 keys，让 B9+ 的 UI 组件直接 `t("behaviors.add")` 等不报错。具体 key 路径以现有 locale 文件结构为准（如果是嵌套对象 vs 平坦 dot key，沿用现有约定）。

- [ ] **步骤 1：打开 `src/i18n/locales/en-US.json` 添加**

```json
{
  "...existing keys...": "",
  "behaviors": {
    "tab_title": "Behaviors",
    "properties_tab_title": "Properties",
    "add_behavior": "Add Behavior",
    "empty_state": "No behaviors. Click + to add.",
    "unknown_type": "Unknown behavior \"{{type}}\"",
    "axis": "Axis",
    "speed": "Speed",
    "speed_unit": "deg/s",
    "auto_rotate_name": "Auto Rotate",
    "auto_rotate_desc": "Rotates the node around a local axis."
  },
  "play": {
    "play": "Play",
    "pause": "Pause"
  }
}
```

- [ ] **步骤 2：对 `zh-CN.json` 做对应中文翻译**

```json
{
  "behaviors": {
    "tab_title": "行为",
    "properties_tab_title": "属性",
    "add_behavior": "添加行为",
    "empty_state": "暂无行为。点 + 添加。",
    "unknown_type": "未知行为 \"{{type}}\"",
    "axis": "轴",
    "speed": "速度",
    "speed_unit": "度/秒",
    "auto_rotate_name": "自动旋转",
    "auto_rotate_desc": "让节点绕一个本地轴匀速旋转。"
  },
  "play": {
    "play": "播放",
    "pause": "暂停"
  }
}
```

- [ ] **步骤 3：跑测试确保现有 i18n 测试不退化**

```sh
pnpm vitest run src/i18n
```

预期：PASS。

- [ ] **步骤 4：Commit**

```sh
git add src/i18n/locales/en-US.json src/i18n/locales/zh-CN.json
git commit -m "i18n(behaviors): keys for Phase 3 UI

Adds behaviors.* + play.* namespaces so the upcoming Behaviors Tab,
AutoRotateForm, and PlayButton don't ship raw keys.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 B9：AutoRotateForm + form registry

**文件：**

- 创建：`src/ui/editor/behavior-params/AutoRotateForm.tsx`
- 创建：`src/ui/editor/behavior-params/registry.ts`
- 测试：`src/ui/editor/behavior-params/AutoRotateForm.test.tsx`

- [ ] **步骤 1：编写失败的测试**

```tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { AutoRotateForm } from "./AutoRotateForm";

describe("AutoRotateForm", () => {
  it("renders current axis + speed", () => {
    render(
      <AutoRotateForm
        value={{ axis: "y", speed: 30 }}
        onChange={() => {}}
        disabled={false}
      />,
    );
    expect(screen.getByLabelText(/y/i)).toBeChecked();
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("30");
  });

  it("calls onChange when axis changes", () => {
    const onChange = vi.fn();
    render(
      <AutoRotateForm
        value={{ axis: "y", speed: 30 }}
        onChange={onChange}
        disabled={false}
      />,
    );
    fireEvent.click(screen.getByLabelText(/x/i));
    expect(onChange).toHaveBeenCalledWith({ axis: "x", speed: 30 });
  });

  it("calls onChange when speed changes", () => {
    const onChange = vi.fn();
    render(
      <AutoRotateForm
        value={{ axis: "y", speed: 30 }}
        onChange={onChange}
        disabled={false}
      />,
    );
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "60" },
    });
    expect(onChange).toHaveBeenCalledWith({ axis: "y", speed: 60 });
  });

  it("disables all inputs when disabled", () => {
    render(
      <AutoRotateForm
        value={{ axis: "y", speed: 30 }}
        onChange={() => {}}
        disabled={true}
      />,
    );
    expect(screen.getByRole("spinbutton")).toBeDisabled();
    expect(screen.getByLabelText(/x/i)).toBeDisabled();
    expect(screen.getByLabelText(/y/i)).toBeDisabled();
    expect(screen.getByLabelText(/z/i)).toBeDisabled();
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

```sh
pnpm vitest run src/ui/editor/behavior-params/AutoRotateForm.test.tsx
```

预期：FAIL。

- [ ] **步骤 3：实现 `AutoRotateForm.tsx`**

```tsx
import { useTranslation } from "react-i18next";

interface AutoRotateValue {
  axis: "x" | "y" | "z";
  speed: number;
}

interface Props {
  value: AutoRotateValue;
  onChange: (next: AutoRotateValue) => void;
  disabled: boolean;
}

export function AutoRotateForm({ value, onChange, disabled }: Props) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-3">
        <label className="w-12 text-zinc-400">{t("behaviors.axis")}</label>
        {(["x", "y", "z"] as const).map((axis) => (
          <label key={axis} className="flex items-center gap-1" aria-label={axis}>
            <input
              type="radio"
              name="auto-rotate-axis"
              value={axis}
              checked={value.axis === axis}
              disabled={disabled}
              onChange={() => onChange({ ...value, axis })}
            />
            {axis.toUpperCase()}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <label className="w-12 text-zinc-400">{t("behaviors.speed")}</label>
        <input
          type="number"
          value={value.speed}
          step="1"
          disabled={disabled}
          onChange={(e) => onChange({ ...value, speed: Number(e.target.value) })}
          className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 disabled:opacity-50"
        />
        <span className="text-zinc-500">{t("behaviors.speed_unit")}</span>
      </div>
    </div>
  );
}
```

- [ ] **步骤 4：实现 `registry.ts`**

```tsx
import type { ComponentType } from "react";

import { AutoRotateForm } from "./AutoRotateForm";

export interface BehaviorFormProps {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled: boolean;
}

/**
 * Map from BehaviorDefinition.type → React form component. The form is
 * responsible for rendering inputs for that behavior's parameter schema and
 * pushing changes via onChange. Components receive an opaque
 * Record<string, unknown> + opaque setter because the parent
 * (BehaviorsPanel) doesn't know individual behavior schemas — it just
 * forwards the params blob.
 */
export const BEHAVIOR_FORM_REGISTRY: Record<
  string,
  ComponentType<BehaviorFormProps>
> = {
  "auto-rotate": AutoRotateForm as ComponentType<BehaviorFormProps>,
};
```

- [ ] **步骤 5：运行测试确认通过**

```sh
pnpm vitest run src/ui/editor/behavior-params/AutoRotateForm.test.tsx
```

预期：PASS（4 tests）。

- [ ] **步骤 6：Commit**

```sh
git add src/ui/editor/behavior-params/
git commit -m "feat(ui): AutoRotateForm + BEHAVIOR_FORM_REGISTRY

Per-behavior parameter form component, dispatched by behavior_type. The
registry pattern means future behaviors plug into BehaviorsPanel with
zero changes to that file.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 B10：BehaviorsPanel + BehaviorRow

**文件：**

- 创建：`src/ui/editor/BehaviorsPanel.tsx`
- 创建：`src/ui/editor/BehaviorRow.tsx`
- 测试：`src/ui/editor/BehaviorsPanel.test.tsx`

- [ ] **步骤 1：编写失败的测试**

```tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { BehaviorsPanel } from "./BehaviorsPanel";
import { useSceneStore } from "@/services/scene/store";
import { useUIStore } from "@/services/ui/store";
import { useCommandHistoryStore } from "@/services/command-history/store";

function seedProjectWithNode(
  nodeId: string,
  behaviors: ReturnType<typeof binding>[] = [],
) {
  // existing helpers: makeEmptyProject + makeMeshNode
  const project = makeEmptyProject();
  project.scene.root_node_ids = [nodeId];
  project.scene.nodes[nodeId] = { ...makeMeshNode(nodeId), behaviors };
  useSceneStore.setState({ project });
  useUIStore.setState({ selectedNodeId: nodeId, playState: "edit" });
}

function binding(overrides: Partial<BehaviorBinding> = {}) {
  return {
    id: "b1",
    behavior_type: "auto-rotate",
    enabled: true,
    parameters: { axis: "y", speed: 30 },
    ...overrides,
  };
}

describe("BehaviorsPanel", () => {
  beforeEach(() => {
    useSceneStore.setState({ project: null });
    useUIStore.setState({ selectedNodeId: null, playState: "edit" });
    useCommandHistoryStore.getState().clear();
  });

  it("shows empty-state when selected node has no behaviors", () => {
    seedProjectWithNode("n1");
    render(<BehaviorsPanel />);
    expect(screen.getByText(/no behaviors/i)).toBeInTheDocument();
  });

  it("renders one row per binding", () => {
    seedProjectWithNode("n1", [binding(), binding({ id: "b2" })]);
    render(<BehaviorsPanel />);
    expect(screen.getAllByText(/auto rotate/i).length).toBeGreaterThanOrEqual(2);
  });

  it("Add Behavior dispatches AddBehaviorCommand", () => {
    seedProjectWithNode("n1");
    render(<BehaviorsPanel />);
    fireEvent.click(screen.getByText(/add behavior/i));
    fireEvent.click(screen.getByText(/auto rotate/i));
    const node = useSceneStore.getState().getNode("n1");
    expect(node!.behaviors.length).toBe(1);
    expect(node!.behaviors[0].behavior_type).toBe("auto-rotate");
    expect(useCommandHistoryStore.getState().undoStack.length).toBe(1);
  });

  it("Remove button dispatches RemoveBehaviorCommand", () => {
    seedProjectWithNode("n1", [binding()]);
    render(<BehaviorsPanel />);
    fireEvent.click(screen.getByLabelText(/remove/i));
    expect(useSceneStore.getState().getNode("n1")!.behaviors).toEqual([]);
  });

  it("Enabled checkbox dispatches SetBehaviorEnabledCommand", () => {
    seedProjectWithNode("n1", [binding()]);
    render(<BehaviorsPanel />);
    fireEvent.click(screen.getByRole("checkbox", { name: /enabled/i }));
    expect(useSceneStore.getState().getNode("n1")!.behaviors[0].enabled).toBe(false);
  });

  it("Editing speed dispatches SetBehaviorParametersCommand", () => {
    seedProjectWithNode("n1", [binding()]);
    render(<BehaviorsPanel />);
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "60" },
    });
    expect(useSceneStore.getState().getNode("n1")!.behaviors[0].parameters.speed).toBe(
      60,
    );
  });

  it("Disables all controls when playState === 'play'", () => {
    seedProjectWithNode("n1", [binding()]);
    useUIStore.setState({ playState: "play" });
    render(<BehaviorsPanel />);
    expect(screen.getByText(/add behavior/i)).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /enabled/i })).toBeDisabled();
    expect(screen.getByRole("spinbutton")).toBeDisabled();
    expect(screen.getByLabelText(/remove/i)).toBeDisabled();
  });

  it("Renders placeholder for unknown behavior_type with only a delete affordance", () => {
    seedProjectWithNode("n1", [binding({ id: "x", behavior_type: "future-thing" })]);
    render(<BehaviorsPanel />);
    expect(screen.getByText(/unknown behavior/i)).toBeInTheDocument();
    // Delete still present
    expect(screen.getByLabelText(/remove/i)).toBeInTheDocument();
    // No spinbutton (no params form)
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });
});
```

> Helper imports (`makeEmptyProject` / `makeMeshNode` / `BehaviorBinding`) follow the same convention as existing component tests. If `@/test/setup.ts` doesn't already register i18n / RTL, follow its pattern.

- [ ] **步骤 2：运行测试确认失败**

```sh
pnpm vitest run src/ui/editor/BehaviorsPanel.test.tsx
```

预期：FAIL — components don't exist.

- [ ] **步骤 3：实现 `BehaviorRow.tsx`**

```tsx
import { useTranslation } from "react-i18next";

import type { BehaviorBinding } from "@/core/scene/types";

import { BEHAVIOR_FORM_REGISTRY } from "./behavior-params/registry";

interface Props {
  binding: BehaviorBinding;
  disabled: boolean;
  onToggleEnabled: (next: boolean) => void;
  onChangeParams: (next: Record<string, unknown>) => void;
  onRemove: () => void;
}

export function BehaviorRow({
  binding,
  disabled,
  onToggleEnabled,
  onChangeParams,
  onRemove,
}: Props) {
  const { t } = useTranslation();
  const Form = BEHAVIOR_FORM_REGISTRY[binding.behavior_type];
  const isUnknown = !Form;
  const displayName = isUnknown
    ? t("behaviors.unknown_type", { type: binding.behavior_type })
    : t(`behaviors.${binding.behavior_type.replace("-", "_")}_name`, {
        defaultValue: binding.behavior_type,
      });

  return (
    <div className="space-y-2 rounded border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          aria-label="enabled"
          checked={binding.enabled}
          disabled={disabled || isUnknown}
          onChange={(e) => onToggleEnabled(e.target.checked)}
        />
        <span className={`flex-1 truncate ${isUnknown ? "text-amber-400" : ""}`}>
          {displayName}
        </span>
        <button
          type="button"
          aria-label="remove"
          disabled={disabled}
          onClick={onRemove}
          className="rounded px-2 text-zinc-400 hover:text-red-400 disabled:opacity-50"
        >
          ×
        </button>
      </div>
      {!isUnknown && (
        <Form
          value={binding.parameters as Record<string, unknown>}
          onChange={onChangeParams}
          disabled={disabled}
        />
      )}
    </div>
  );
}
```

- [ ] **步骤 4：实现 `BehaviorsPanel.tsx`**

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useSceneStore } from "@/services/scene/store";
import { useUIStore } from "@/services/ui/store";
import { useCommandHistoryStore } from "@/services/command-history/store";
import { useThreeAdapter } from "@/runtime/three/use-adapter"; // existing hook; if not, see note below
import { generateUUID } from "@/core/id/uuid";
import { AddBehaviorCommand } from "@/core/command/commands/add-behavior";
import { RemoveBehaviorCommand } from "@/core/command/commands/remove-behavior";
import { SetBehaviorEnabledCommand } from "@/core/command/commands/set-behavior-enabled";
import { SetBehaviorParametersCommand } from "@/core/command/commands/set-behavior-parameters";

import { BehaviorRow } from "./BehaviorRow";

export function BehaviorsPanel() {
  const { t } = useTranslation();
  const adapter = useThreeAdapter(); // for getSupportedBehaviors()
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const playState = useUIStore((s) => s.playState);
  const node = useSceneStore((s) =>
    selectedNodeId ? s.project?.scene.nodes[selectedNodeId] : undefined,
  );
  const editor = useSceneStore.getState();
  const exec = useCommandHistoryStore((s) => s.execute);

  const [addOpen, setAddOpen] = useState(false);
  const disabled = playState === "play";

  if (!node) return null;

  function addAutoRotate(behavior_type: string) {
    const binding = {
      id: generateUUID(),
      behavior_type,
      enabled: true,
      parameters: { axis: "y", speed: 30 }, // sensible default for auto-rotate
    };
    exec(new AddBehaviorCommand({ node_id: node!.id, binding }), editor);
    setAddOpen(false);
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <span className="truncate text-zinc-200">{node.name}</span>
      </div>

      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setAddOpen((o) => !o)}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-left disabled:opacity-50"
        >
          + {t("behaviors.add_behavior")} ▾
        </button>
        {addOpen && (
          <div className="absolute z-10 mt-1 w-full rounded border border-zinc-700 bg-zinc-900 shadow">
            {adapter.getSupportedBehaviors().map((def) => (
              <button
                key={def.type}
                type="button"
                className="block w-full px-2 py-1 text-left hover:bg-zinc-800"
                onClick={() => addAutoRotate(def.type)}
              >
                {t(`behaviors.${def.type.replace("-", "_")}_name`, {
                  defaultValue: def.name,
                })}
              </button>
            ))}
          </div>
        )}
      </div>

      {node.behaviors.length === 0 && (
        <div className="rounded border border-dashed border-zinc-800 p-3 text-center text-zinc-500">
          {t("behaviors.empty_state")}
        </div>
      )}

      {node.behaviors.map((binding) => (
        <BehaviorRow
          key={binding.id}
          binding={binding}
          disabled={disabled}
          onToggleEnabled={(enabled) =>
            exec(
              new SetBehaviorEnabledCommand({
                node_id: node.id,
                binding_id: binding.id,
                enabled,
                prev_enabled: binding.enabled,
              }),
              editor,
            )
          }
          onChangeParams={(parameters) =>
            exec(
              new SetBehaviorParametersCommand({
                node_id: node.id,
                binding_id: binding.id,
                parameters,
                prev_parameters: binding.parameters,
              }),
              editor,
            )
          }
          onRemove={() =>
            exec(
              new RemoveBehaviorCommand({
                node_id: node.id,
                prev_binding: binding,
              }),
              editor,
            )
          }
        />
      ))}
    </div>
  );
}
```

> **`useThreeAdapter` note：** If the codebase has no such hook (likely——the adapter is owned by ThreeViewport), surface the adapter via a small Context provider. The minimum needed here is `getSupportedBehaviors()` — for a smaller-blast-radius alternative, hardcode `[{ type: "auto-rotate", name: "Auto Rotate" }]` for now and revisit when a second behavior lands. **Pick the smaller change.**

- [ ] **步骤 5：运行测试确认通过**

```sh
pnpm vitest run src/ui/editor/BehaviorsPanel.test.tsx
```

预期：PASS（8 tests）。

如未通过：用例假定测试文件 `beforeEach` 已 reset stores — 确认实现里 `useSceneStore.getState().getNode` 走的是 react hook subscription，否则状态变化测试拿不到新值。可换成 selector 形式 `useSceneStore((s) => s.project?.scene.nodes[selectedNodeId])` （上面代码已用此写法）。

- [ ] **步骤 6：Commit**

```sh
git add src/ui/editor/BehaviorsPanel.tsx src/ui/editor/BehaviorRow.tsx src/ui/editor/BehaviorsPanel.test.tsx
git commit -m "feat(ui): BehaviorsPanel + BehaviorRow

Right-side tab content for editing a node's behaviors:
- Add Behavior dropdown sourced from adapter.getSupportedBehaviors()
- Per-binding row: enabled checkbox, name, params form (dispatched via
  BEHAVIOR_FORM_REGISTRY), remove button
- All four actions dispatch through useCommandHistoryStore so undo/redo
  works
- playState === 'play' disables every interactive control
- Unknown behavior_type renders a delete-only placeholder so old
  projects don't lose data silently

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 B11：EditorView Tab 切换

**文件：**

- 修改：`src/ui/views/EditorView.tsx`
- （可能）测试：`src/ui/views/EditorView.test.tsx`（若已有）

- [ ] **步骤 1：浏览现有 EditorView**

读 `src/ui/views/EditorView.tsx`（399 行）。定位右侧 `<aside>`（Properties panel 容器）。

- [ ] **步骤 2：在 `<aside>` 顶部加 Tab 栏**

```tsx
import { useUIStore, type RightPanelTab } from "@/services/ui/store";
import { useTranslation } from "react-i18next";

import { BehaviorsPanel } from "@/ui/editor/BehaviorsPanel";

// inside EditorView body
const rightPanelTab = useUIStore((s) => s.rightPanelTab);
const setRightPanelTab = useUIStore((s) => s.setRightPanelTab);
const playState = useUIStore((s) => s.playState);
const { t } = useTranslation();

// inside the right <aside> JSX, at the top:
<div className="flex shrink-0 border-b border-zinc-800">
  {(["properties", "behaviors"] as RightPanelTab[]).map((tab) => (
    <button
      key={tab}
      type="button"
      onClick={() => setRightPanelTab(tab)}
      className={`flex-1 px-3 py-2 text-sm ${
        rightPanelTab === tab
          ? "border-b-2 border-blue-500 text-zinc-100"
          : "text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {tab === "properties"
        ? t("behaviors.properties_tab_title")
        : t("behaviors.tab_title")}
    </button>
  ))}
</div>

<div className="min-h-0 flex-1 overflow-auto">
  {rightPanelTab === "properties" ? (
    /* existing Properties content, but pass a `disabled={playState === 'play'}`
       prop down to Vec3Row/NumberInput components, or wrap them in a fieldset
       with disabled={playState==='play'} */
    <PropertiesContent disabled={playState === "play"} />
  ) : (
    <BehaviorsPanel />
  )}
</div>
```

**Properties 内容 `disabled` 透传**：定位现有 Vec3Row / NumberInput 的使用点。
最小改动是套一层 `<fieldset disabled={playState === 'play'}>`——HTML fieldset
disabled 会向下传递给所有原生表单元素。若现有 inputs 已经支持 `disabled` prop，
逐个传也行；fieldset 路径副作用更小。

- [ ] **步骤 3：跑测试 + visual smoke**

```sh
pnpm vitest run src/ui/views
pnpm typecheck
```

预期：原有用例不退化；新加的 Tab 切换没有 typecheck 错误。

- [ ] **步骤 4：Commit**

```sh
git add src/ui/views/EditorView.tsx
git commit -m "feat(editor-view): Properties↔Behaviors tab switcher in right aside

Two-tab switcher at the top of the right pane backed by
useUIStore.rightPanelTab. Properties content is wrapped so playState
'play' disables every form input (HTML <fieldset disabled> propagates
to nested native inputs).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 B12：PlayButton

**文件：**

- 创建：`src/ui/viewport/PlayButton.tsx`
- 测试：`src/ui/viewport/PlayButton.test.tsx`

- [ ] **步骤 1：编写失败的测试**

```tsx
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { PlayButton } from "./PlayButton";
import { useUIStore } from "@/services/ui/store";

describe("PlayButton", () => {
  beforeEach(() => useUIStore.setState({ playState: "edit" }));

  it("shows 'Play' label when in edit mode", () => {
    render(<PlayButton />);
    expect(screen.getByText(/play/i)).toBeInTheDocument();
  });

  it("clicking switches to play state", () => {
    render(<PlayButton />);
    fireEvent.click(screen.getByText(/play/i));
    expect(useUIStore.getState().playState).toBe("play");
  });

  it("shows 'Pause' label when in play mode", () => {
    useUIStore.setState({ playState: "play" });
    render(<PlayButton />);
    expect(screen.getByText(/pause/i)).toBeInTheDocument();
  });

  it("clicking again returns to edit", () => {
    useUIStore.setState({ playState: "play" });
    render(<PlayButton />);
    fireEvent.click(screen.getByText(/pause/i));
    expect(useUIStore.getState().playState).toBe("edit");
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

```sh
pnpm vitest run src/ui/viewport/PlayButton.test.tsx
```

预期：FAIL。

- [ ] **步骤 3：实现 `PlayButton.tsx`**

```tsx
import { useTranslation } from "react-i18next";

import { useUIStore } from "@/services/ui/store";

export function PlayButton() {
  const { t } = useTranslation();
  const playState = useUIStore((s) => s.playState);
  const setPlayState = useUIStore((s) => s.setPlayState);
  const isPlay = playState === "play";

  return (
    <button
      type="button"
      onClick={() => setPlayState(isPlay ? "edit" : "play")}
      className={`rounded px-3 py-1 text-sm ${
        isPlay
          ? "bg-amber-600 text-white"
          : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
      }`}
    >
      {isPlay ? `⏸ ${t("play.pause")}` : `▶ ${t("play.play")}`}
    </button>
  );
}
```

- [ ] **步骤 4：把 PlayButton 接入 ThreeViewport 工具栏**

打开 `src/ui/viewport/ThreeViewport.tsx`，定位现有的 Move/Rotate/Scale mode pill 容器，在最右侧追加 `<PlayButton />`。

- [ ] **步骤 5：运行测试确认通过**

```sh
pnpm vitest run src/ui/viewport/PlayButton.test.tsx
pnpm typecheck
```

预期：PASS。

- [ ] **步骤 6：Commit**

```sh
git add src/ui/viewport/PlayButton.tsx src/ui/viewport/PlayButton.test.tsx src/ui/viewport/ThreeViewport.tsx
git commit -m "feat(viewport): PlayButton toggle in viewport toolbar

Single button: shows ▶ Play in edit mode (amber accent on click) and ⏸
Pause in play mode. Pressing toggles useUIStore.playState; the actual
side effects (gizmo detach, RAF tick) are wired in ThreeViewport's
effect on playState changes.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 B13：ThreeViewport play 模式副作用

**文件：**

- 修改：`src/ui/viewport/ThreeViewport.tsx`

> **复杂度警告**：本任务是 Stage B 最大的改动点。涉及：
>
> 1. 监听 `playState` 变化
> 2. play 进入：snapshot 所有 object3D 的 transform、detach gizmo、清 outline、disable pickAt、注册 RAF tick 调 `adapter.tickBehaviors(dt)`
> 3. play 退出：取消 RAF tick、恢复所有 object3D 到 snapshot、re-attach gizmo（若有选中）
> 4. install/uninstall behaviors

由于这块 effect 容易在 React Strict Mode 下双挂载，按 PR #18 已建立的 `let cancelled = false; let unlisten;` 约定写 cleanup。

- [ ] **步骤 1：编写测试（可选 — viewport 主要靠手动验收）**

如果 `ThreeViewport.test.tsx` 已存在 unit-level 测试，扩展用例：

```tsx
it("enters play mode: installs behaviors and ticks once per frame", async () => {
  // ... seed project with one auto-rotate node ...
  const { rerender } = render(<ThreeViewport />);
  useUIStore.setState({ playState: "play" });
  // wait one RAF
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  const obj = adapter.getRuntimeObject("n1");
  expect(obj.rotation.y).toBeGreaterThan(0);
});
```

若现有测试无法可靠捕获 RAF，本任务依赖 Stage B 最后的手动 visual verification。

- [ ] **步骤 2：在 ThreeViewport 加 playState 监听**

定位现有 ThreeViewport 的主 useEffect（mount renderer + subscribe scene store 的那一块）。**保持其 deps 不变**——`project?.metadata.id` + `setSelectedNodeId` 等约定不能动（PR #7 viewport sync 约定）。

新加一个**独立**的 effect：

```tsx
useEffect(() => {
  // sub to playState transitions
  const unsub = useUIStore.subscribe(
    (s) => s.playState,
    (playState) => {
      if (playState === "play") enterPlay();
      else exitPlay();
    },
  );
  return unsub;
}, []);

function enterPlay() {
  if (!adapterRef.current || !sceneRef.current) return;
  // 1. snapshot transforms (Map<nodeId, Transform>) — used to restore on Pause
  transformSnapshotsRef.current = new Map();
  for (const [id, obj] of adapterRef.current.objects /* if accessible */) {
    transformSnapshotsRef.current.set(id, {
      position: [obj.position.x, obj.position.y, obj.position.z],
      rotation: [
        obj.quaternion.x,
        obj.quaternion.y,
        obj.quaternion.z,
        obj.quaternion.w,
      ],
      scale: [obj.scale.x, obj.scale.y, obj.scale.z],
    });
  }
  // (If adapter.objects isn't exposed, add a public iterator method like
  // ThreeAdapter.eachObject((id, obj) => …) and use it here.)

  // 2. install behaviors for every node with bindings
  const project = useSceneStore.getState().project;
  if (project) {
    for (const node of Object.values(project.scene.nodes)) {
      if (node.behaviors.length > 0) {
        adapterRef.current.installBehaviors(node.id, node.behaviors);
      }
    }
  }

  // 3. detach gizmo + clear outline
  transformControlsRef.current?.detach();
  outlinePassRef.current.selectedObjects = [];

  // 4. start RAF tick loop
  const clock = new THREE.Clock();
  function tickLoop() {
    const dt = clock.getDelta();
    adapterRef.current?.tickBehaviors(dt);
    playRafRef.current = requestAnimationFrame(tickLoop);
  }
  playRafRef.current = requestAnimationFrame(tickLoop);
}

function exitPlay() {
  // 1. stop RAF
  if (playRafRef.current !== null) {
    cancelAnimationFrame(playRafRef.current);
    playRafRef.current = null;
  }
  // 2. uninstall behaviors
  const project = useSceneStore.getState().project;
  if (project) {
    for (const node of Object.values(project.scene.nodes)) {
      adapterRef.current?.uninstallBehaviors(node.id);
    }
  }
  // 3. restore transforms from snapshot
  for (const [nodeId, t] of transformSnapshotsRef.current) {
    const obj = adapterRef.current?.getRuntimeObject(nodeId);
    if (!obj) continue;
    obj.position.fromArray(t.position);
    obj.quaternion.fromArray(t.rotation);
    obj.scale.fromArray(t.scale);
  }
  transformSnapshotsRef.current.clear();
  // 4. re-attach gizmo if a node is selected (use existing syncSelection helper)
  syncSelection(useUIStore.getState().selectedNodeId);
}
```

`pickAt` 旁路：

```tsx
function onPointerDown(e: PointerEvent) {
  if (useUIStore.getState().playState === "play") return;
  // ... existing logic ...
}
```

- [ ] **步骤 3：可能需要给 ThreeAdapter 加 eachObject helper**

如果 `adapter.objects` 不是 public，给 `src/runtime/three/adapter.ts` 加：

```ts
/**
 * Iterates every (nodeId, Object3D) currently held by the adapter. Used
 * by ThreeViewport to snapshot transforms on play-mode entry.
 */
eachObject(cb: (nodeId: string, object: THREE.Object3D) => void): void {
  for (const [id, obj] of this.objects) cb(id, obj);
}
```

并在测试里覆盖一行（往现有 adapter.test.ts 加一条）。

- [ ] **步骤 4：跑 typecheck + 完整测试**

```sh
pnpm typecheck
pnpm test
```

预期：所有 PASS。

- [ ] **步骤 5：Commit**

```sh
git add src/ui/viewport/ThreeViewport.tsx src/runtime/three/adapter.ts src/runtime/three/adapter.test.ts
git commit -m "feat(viewport): wire Play/Pause side effects

Subscribes to useUIStore.playState. On entering play:
- snapshots every adapter Object3D transform
- installs behaviors on each node that has bindings
- detaches gizmo, clears outline pass selection, bypasses pickAt
- starts a RAF loop driving adapter.tickBehaviors(dt) via THREE.Clock

On exiting play:
- stops the RAF loop
- uninstalls all behaviors (releases handles)
- restores Object3D transforms from the entry snapshot (so rotation
  doesn't 'pop' to whatever the behavior happened to be at)
- re-attaches gizmo via the existing syncSelection helper

Adds ThreeAdapter.eachObject so the snapshot doesn't reach into private
state.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 B14：Stage B 端到端验证 + PR

**文件：** 无新增；跑 CI 等价命令 + 完成 spec §11 视觉验证清单。

- [ ] **步骤 1：跑完整 CI 等价命令**

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

预期：全绿。

- [ ] **步骤 2：手动 visual verification（spec §11 清单）**

```sh
pnpm tauri dev
```

逐项验证并打勾：

- [ ] 新建项目 → 给 cube 加 auto-rotate(y, 30) → Play → 看到旋转
- [ ] Play 状态下属性面板灰（Vec3Row / NumberInput 全 disabled）
- [ ] Pause 后 cube rotation 回到初始（不停在旋转过的位置）
- [ ] Cmd+Z 在 Play 状态下不可用 / Edit 状态下 undo 行为成功
- [ ] Save 项目 → 重启 → 打开 → behavior 还在 + Play 仍旋转
- [ ] Export Vite → `pnpm install && pnpm dev` → 浏览器看到旋转（实际上 Stage A 已验过，Stage B 复查一次确认 store↔ 导出未退化）
- [ ] Export Standalone → `python -m http.server` → 浏览器看到旋转
- [ ] 切到一个未给 cube 加 behavior 的别的节点 → Behaviors Tab 显示空状态
- [ ] 同一节点加两个 auto-rotate（不同轴）→ 同时旋转无冲突
- [ ] 切换 Tab（Properties ↔ Behaviors）状态保持
- [ ] 在 Behaviors Tab 改 speed → 立即生效（Play 下也即时反映；Edit 下不动直到 Play）

- [ ] **步骤 3：开 PR（Stage B）**

```sh
git push -u origin feat/phase3-behaviors-ui
/opt/homebrew/bin/gh pr create --base main --head feat/phase3-behaviors-ui --title "feat(phase3): behaviors editor UI + Play/Pause + undo (Stage B)" --body "$(cat <<'EOF'
## Summary

- 4 behavior mutators on useSceneStore (add / remove / setEnabled / setParameters)
- 4 Command classes following the PR #7 pattern (only SetBehaviorParameters merges, 500ms window)
- useUIStore.rightPanelTab ('properties'|'behaviors') + playState ('edit'|'play')
- BehaviorsPanel + BehaviorRow + AutoRotateForm + BEHAVIOR_FORM_REGISTRY
- EditorView right aside grew a Tab switcher; Properties content wrapped in disabled fieldset under play
- PlayButton in viewport toolbar; ThreeViewport handles play/pause side effects
  (install/uninstall behaviors, RAF tick, transform snapshot/restore, gizmo detach/reattach)
- command-history execute/undo/redo become no-ops in play mode

Depends on PR for Stage A (must merge first).

Spec: `docs/superpowers/specs/2026-05-25-phase3-behaviors-design.md`

## Test plan

- [ ] pnpm test — local green (incl. ~30 new vitest cases)
- [ ] pnpm typecheck — local green
- [ ] pnpm lint / pnpm build — local green
- [ ] Manual visual verification per spec §11 (full 11-item checklist)
- [ ] CI green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## 自检（writing-plans 要求的最后一步）

**1. 规格覆盖度（对照 spec）：**

- spec §6.1 Play/Pause toggle → B6（state）、B12（按钮）、B13（副作用）✅
- spec §6.1 step 3 EditorView 副作用：表单 disabled、command-history disabled → B7、B11 ✅
- spec §6.2 Behaviors Tab → B10 ✅
- spec §8 4 个 Commands → B2 / B3 / B4 / B5 ✅
- spec §8 4 个 mutator → B1 ✅
- spec §9 Forward-compat 未知 type → B10（BehaviorsPanel.test 第 8 个用例 + BehaviorRow 渲染分支）✅
- spec §10 测试矩阵 BehaviorsPanel.test → B10 ✅
- spec §11 视觉验证清单 → B14 ✅
- spec §13 hierarchy 在 play 下仍可点选 → B13 步骤 2（pickAt 旁路只针对 canvas，hierarchy 行点击走单独 onClick，**不需要改**——验证项纳入 B14 visual check）

**2. 占位符扫描：** 全文搜过——无 "TBD" / "后续实现" / "类似任务 N"。每一步都有可执行的代码 + 命令。`useThreeAdapter` hook 的存在性在 B10 步骤 4 注明了 fallback（硬编码 supported behaviors list），不是占位符——是 plan-time 的决策提示。

**3. 类型一致性：**

- `SceneEditorStore` 在 B1 扩展，B2-B5 commands 用同样的方法名（`addBehavior` / `removeBehavior` / `setBehaviorEnabled` / `setBehaviorParameters`）✅
- `BehaviorBinding` 字段名 `{id, behavior_type, enabled, parameters}` 在所有任务里一致（这是 spec / `schemas.ts` 已 frozen 的）✅
- `useUIStore.playState` 取值 `"edit" | "play"`（不是 boolean）在 B6 定义，B7 / B11 / B12 / B13 / BehaviorsPanel.test 所有使用点一致 ✅
- `BEHAVIOR_FORM_REGISTRY` 在 B9 创建，B10 BehaviorRow.tsx 导入 ✅

---

## 执行交接

计划已完成并保存到 `docs/superpowers/plans/2026-05-25-phase3-behaviors-stage-b.md`。两种执行方式：

**1. 子代理驱动（推荐）** — 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** — 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

执行前置：确保 Stage A 的 PR 已合并到 main。
