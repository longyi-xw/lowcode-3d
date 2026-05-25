---
phase: 3
status: draft
date: 2026-05-25
related:
  - design/framework/architecture.md (§3.4 BehaviorBinding, §4.1 IRuntimeAdapter)
  - docs/scene-graph-spec.md §5
  - src/runtime/adapter.ts (IRuntimeAdapter, BehaviorDefinition, CodegenContext)
  - src/runtime/three/adapter.ts:300-306 (current stubs)
  - src/runtime/three/export/scene-codegen.ts (codegen integration point)
---

# Phase 3 — Behaviors v1 设计规格

## TL;DR

Phase 3 把架构里悬置的 "Behavior" 概念落到代码层面。本期采用**纵向切片**：
注册表 + 一个具体行为（`auto-rotate`）+ 编辑器运行时预览（Play/Pause）+
属性面板 Behaviors Tab + 导出代码集成（`tickers` 数组），所有 5 个子系统一次性走通。
首版只交付一个行为，后续行为（hover-highlight / click-trigger / 自定义脚本）作为
增量 PR 在同一框架下扩展。AI 驱动的行为编辑路径**不在本期范围内**，留 Phase 4。

---

## 1. 目标 & 非目标

### 目标

- 解除 `IRuntimeAdapter.getSupportedBehaviors()` / `generateBehaviorCode()` 两个 stub。
- 引入 `Behavior` 接口与 `ThreeBehaviorRegistry`，允许后续行为通过单文件即可扩展。
- 提供编辑器内**显式 Play/Pause** 模式，让作者能直接预览行为效果。
- 让 Vite 与 Standalone 两个导出目标输出可运行的、带行为的页面。
- 沿用既有 command-history / persistence / codegen 约定，不引入新的"特例"。

### 非目标（本期不做，留后续 PR）

- 多种行为目录（仅交付 `auto-rotate`）。
- 行为之间的依赖关系 / 排序 / 组合 DSL。
- AI 驱动的"自然语言 → 行为参数"生成路径。
- 自定义脚本行为（用户写 JS / TS 直接挂到 node）。
- 行为参数的动画曲线 / 时间轴 UI。
- 移动端 Play 模式（pointer / 触摸事件相关交互的行为）。

### 成功标准

1. 用户在编辑器里给一个 cube 加 `auto-rotate(y, 30 deg/s)`，按 Play 后能看到旋转。
2. 用户保存项目 → 重新打开 → behavior binding 完整恢复。
3. 用户导出 Vite 或 Standalone 项目，运行后 cube 同样旋转（角速度一致）。
4. 用户 undo 删除 behavior → behavior 回来；undo 改 speed → 旧值回来。
5. 项目文件含未知 `behavior_type`（来自未来版本）→ 不阻塞加载，UI 显示一行可删的占位项。
6. `pnpm test` 全绿；新增测试覆盖 §10 列出的全部测试点。

---

## 2. 范围与切分

Phase 3 behaviors 实际跨 5 个独立子系统：

| 子系统       | 本期交付                                                  |
| ------------ | --------------------------------------------------------- |
| 行为注册表   | ✅ `Behavior` 接口 + `ThreeBehaviorRegistry`，可注册多个  |
| 行为目录     | ✅ 仅 `auto-rotate`（轴 + 角速度）                        |
| 编辑器运行时 | ✅ Play/Pause toggle + RAF 内 `adapter.tickBehaviors(dt)` |
| 编辑器 UI    | ✅ 右侧主面板加 Tab（Properties ↔ Behaviors），含参数表单 |
| 导出代码集成 | ✅ `buildScene` 返回 `tickers[]`，main.js 在 RAF 里迭代   |

**为什么必须纵向**：每个子系统单独发布对用户都没有可感知价值。一个纯数据层的 PR
（"加了 BehaviorBinding 字段但什么都不动"）很难 review，也无法验证设计；纵向切片让
本期 PR 自带 acceptance（按 Play 看到旋转 / 导出后浏览器里看到旋转）。

---

## 3. 架构分层

```
src/core/behaviors/                    ← engine-neutral metadata（本期是空壳）
  registry.ts                          ← 类型转发；future Babylon adapter 会用
  index.ts                             ← re-exports

src/runtime/three/behaviors/           ← three-specific 实现
  types.ts                             ← Behavior<TParams> interface + BehaviorHandle
  registry.ts                          ← ThreeBehaviorRegistry 类
  auto-rotate.ts                       ← class AutoRotateBehavior + static definition
  auto-rotate.test.ts
  registry.test.ts
  index.ts                             ← createThreeBehaviorRegistry()
```

### 关键约定

- **一个 behavior = 一个文件**（与 `src/runtime/three/node-builders/group.ts` 等
  per-kind 模块的约定一致）。该文件同时导出 class 实例和 `static definition`。
- **`core/behaviors/` 本期不实质承载数据**。Babylon 适配器登场时，会把
  `BehaviorDefinition` 上抽到 core（届时 Three 实现继续在 `runtime/three/`），
  让两个适配器共享 metadata。YAGNI：现在还没有第二个 adapter，不预先抽。
- `ThreeAdapter` 持有 `behaviorRegistry: ThreeBehaviorRegistry` 单例（per-adapter
  instance，与 `AssetCache` / `BuilderRegistry` 模式一致）。
- `scene-codegen.ts` **不直接 import 任何 behavior class**。它通过
  `SceneCodegenInput.generateBehaviorCode`（由 adapter 在调用时注入，详见 §7.1）
  拿到代码字符串。这样后续往目录里加行为时，scene-codegen 的 import 图保持稳定，
  scene-codegen 也不需要 import `IRuntimeAdapter`（避免循环依赖）。

---

## 4. Behavior class 契约

```ts
// src/runtime/three/behaviors/types.ts
import type * as THREE from "three";
import type { BehaviorBinding } from "@/core/scene/types";
import type { BehaviorDefinition, CodegenContext } from "@/runtime/adapter";

export interface BehaviorHandle {
  /** 由 install 返回；tick / dispose 之间携带 per-binding 状态。
   *  auto-rotate 不需要持久状态，所以可以返回 `{}`。 */
  dispose?(): void;
}

export interface Behavior<TParams = unknown> {
  readonly definition: BehaviorDefinition;
  install(object: THREE.Object3D, params: TParams): BehaviorHandle;
  tick(
    object: THREE.Object3D,
    params: TParams,
    handle: BehaviorHandle,
    dt: number,
  ): void;
  /** 返回**已缩进 + 已分号收尾**的代码字符串，scene-codegen 直接 push 进
   *  `buildScene()` 函数体（缩进层级 = 1）。 */
  emit(varName: string, params: TParams, ctx: CodegenContext): string;
}
```

**设计点：**

- `BehaviorHandle.dispose` 是可选的（避免 auto-rotate 这种无副作用行为被迫写
  空 `uninstall`）。约定：handle 持有 `{ unlisten?: () => void; pass?: OutlinePass }`
  之类，dispose 在 handle 上而不是 behavior 实例上，因为同一个 Behavior 实例
  可被多个 binding 复用（Flyweight）。
- `tick(object, params, handle, dt)` 显式传所有依赖，behavior 类自身**不持有
  per-binding 状态**。runtime 状态完全装在 handle 里。
- `emit` 输出是字符串而非 AST —— 与 `scene-codegen.ts` 现有 `push(ctx, "…")`
  风格一致，零额外依赖。
- 参数类型 `TParams` 由 `z.infer<typeof definition.parameters_schema>` 推导。

### `auto-rotate.ts` 形态

```ts
// src/runtime/three/behaviors/auto-rotate.ts
import { z } from "zod";
import type * as THREE from "three";
import type { Behavior, BehaviorHandle } from "./types";
import type { BehaviorDefinition, CodegenContext } from "@/runtime/adapter";

const AxisSchema = z.enum(["x", "y", "z"]);
const ParamsSchema = z.object({
  axis: AxisSchema,
  speed: z.number(), // deg/s；可负
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
    return {}; // 无状态
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
    // 大括号包围一个 emit 内部的局部 const —— 多个 auto-rotate binding 互不干扰
    // 实施约定：每行从列 0 开始；缩进由 scene-codegen 的 push() 按当前
    // ctx.indent 注入（参考 emitMesh / emitLight 的多行处理模式）。
    return [
      `{`,
      `  const _omega = ${params.speed} * Math.PI / 180;`,
      `  tickers.push((dt) => { ${varName}.rotation.${params.axis} += _omega * dt; });`,
      `}`,
    ].join("\n");
  }
}
```

---

## 5. 注册表 & adapter wiring

### `ThreeBehaviorRegistry`

```ts
// src/runtime/three/behaviors/registry.ts
import type { Behavior } from "./types";

export class ThreeBehaviorRegistry {
  private behaviors = new Map<string, Behavior>();

  register(b: Behavior): void {
    if (this.behaviors.has(b.definition.type)) {
      throw new Error(`ThreeBehaviorRegistry: duplicate type "${b.definition.type}"`);
    }
    this.behaviors.set(b.definition.type, b);
  }

  get(type: string): Behavior | undefined {
    return this.behaviors.get(type);
  }

  list(): Behavior[] {
    return [...this.behaviors.values()];
  }
}
```

### Adapter 集成点（修改 `src/runtime/three/adapter.ts`）

```ts
// 新增 import
import { createThreeBehaviorRegistry, ThreeBehaviorRegistry } from "./behaviors";

// 字段（与 assetCache / objects 等同级）
private readonly behaviorRegistry: ThreeBehaviorRegistry;

// per-node live 状态
private readonly behaviorRuntime = new Map<string, {
  handles: Map<string /* bindingId */, BehaviorHandle>;
}>();

// constructor 中
this.behaviorRegistry = createThreeBehaviorRegistry();

// 已有 stub 改写
getSupportedBehaviors(): BehaviorDefinition[] {
  return this.behaviorRegistry.list().map(b => b.definition);
}

generateBehaviorCode(binding: BehaviorBinding, ctx: CodegenContext): string {
  if (!binding.enabled) return "";
  const b = this.behaviorRegistry.get(binding.behavior_type);
  if (!b) {
    ctx.warnings.push(`unknown behavior_type "${binding.behavior_type}" — skipped`);
    return "";
  }
  const parsed = b.definition.parameters_schema.safeParse(binding.parameters);
  if (!parsed.success) {
    ctx.warnings.push(`behavior "${binding.behavior_type}" (id ${binding.id}) skipped: invalid params`);
    return "";
  }
  // varName 由 scene-codegen 注入；ctx 里需新增 currentNodeVar 字段（见 §7）。
  return b.emit(ctx.currentNodeVar, parsed.data, ctx);
}

// 新增三个 API（live editor runtime）
installBehaviors(nodeId: string): void { /* binding → handle map */ }
uninstallBehaviors(nodeId: string): void { /* dispose all handles */ }
tickBehaviors(dt: number): void { /* iterate all node→bindings */ }
```

### Live runtime ↔ codegen 共享同一个 Behavior 实例

`tick` 和 `emit` 在同一个 class 上 —— 行为的"运行时语义"和"导出语义"由作者一次性
写完，两条调用路径走的是同一个内存对象（`registry.get(type)` 返回的 instance）。
这避免了"运行时行为是 X，导出后行为是 Y"的悖论。

**测试上的等价性约束**：`AutoRotateBehavior` 的 tick 跑 `dt` 时间后 object.rotation
的增量，必须等于 emit 出来的 ticker 跑同样 dt 后的增量。这一点会有专门的等价性
测试（§10）。

---

## 6. 编辑器 UX：Play/Pause + Behaviors Tab

### 6.1 Play/Pause toggle

**位置**：ThreeViewport 上方那条工具栏（当前有 Move / Rotate / Scale 三个 mode pill）
最右侧新增一个 `▶ Play` / `⏸ Pause` 按钮。

**状态**：`useUIStore.playState: "edit" | "play"`，默认 `"edit"`。

**Edit → Play 切换：**

1. `useUIStore.setPlayState("play")`
2. ThreeViewport 副作用：
   - 调 `adapter.installBehaviors(nodeId)` for each node 持有 enabled binding
   - 在 RAF 里追加 `adapter.tickBehaviors(dt)` 调用（`THREE.Clock.getDelta()` 提供 dt）
   - 调 `transformControls.detach()` 并隐藏
   - 调 `outlinePass.selectedObjects = []` 清空选择高亮
3. EditorView 副作用：
   - Properties Tab 表单全部 `disabled`
   - Behaviors Tab "+ Add" 按钮 / 参数输入框 / toggle / 删除按钮全部 `disabled`
   - 顶部工具栏 Move/Rotate/Scale pills `disabled`
   - **Command-history 整体 disabled**：`executeCommand` / `undo` / `redo` 在
     `playState === "play"` 时全部 no-op。Cmd+Z / Cmd+Shift+Z 快捷键也被吞掉。
     这避免用户在 Play 期间触发的编辑指令污染 history（行为 tick 改的是
     object3D，不入 store，不算编辑）。
   - **Hierarchy 面板仍允许点击切换选中**（只读浏览，不算编辑）。但点选后
     gizmo 不 attach、不显示 Outline（因为 §6.1 step 2 已 detach + 清空）。
4. ThreeViewport pointerdown → pickAt 被旁路（直接 `return null`）。

**Play → Edit 切换：**

1. `useUIStore.setPlayState("edit")`
2. `adapter.uninstallBehaviors(nodeId)` for all nodes
3. **恢复 object3D.transform 到 `nodeSnapshots` 里的值** —— 让 auto-rotate 跑了
   5 秒后停下来，节点回到原始 rotation。这是关键约定：编辑模式下 object 的
   transform 必须与 `useSceneStore` 里 SceneNode 的 transform 一致，否则属性
   面板显示的数字和画布上看到的位置/角度不符。
4. transformControls 在选中节点上重新 attach（若有选中）。
5. 所有 disabled 输入框恢复。

### 6.2 Behaviors Tab

**布局**：右侧 `<aside>` 顶部加 Tab 栏（仿现有 mode pill 风格的两个按钮：Properties / Behaviors），下方按 tab 切换内容。

**状态**：`useUIStore.rightPanelTab: "properties" | "behaviors"`，默认 `"properties"`。

**Behaviors Tab 内容（伪结构）：**

```
┌────────────────────────────────────┐
│ Cube                               │  ← 选中节点名（同 Properties）
├────────────────────────────────────┤
│ [+ Add Behavior         ▾]         │  ← 下拉来源：adapter.getSupportedBehaviors()
├────────────────────────────────────┤
│ ☑ Auto Rotate                  [×]│  ← enabled toggle + 删除
│   axis:  ◉ x   ○ y   ○ z          │
│   speed: [    30    ] deg/s        │
├────────────────────────────────────┤
│ ⚠ unknown: "future-thing"      [×]│  ← 未知 behavior_type 的占位
└────────────────────────────────────┘

（空状态："No behaviors. Click + to add."）
```

**组件文件：**

- `src/components/editor/BehaviorsPanel.tsx` —— 顶层 Tab 内容
- `src/components/editor/BehaviorRow.tsx` —— 单条 binding 渲染（含参数表单分发）
- `src/components/editor/behavior-params/AutoRotateForm.tsx` —— per-behavior 参数表单

**参数表单分发：** `BehaviorRow` 根据 `binding.behavior_type` 查表选择子表单组件。
表中条目作为 const 数组维护（`BEHAVIOR_FORM_REGISTRY`），未来新增行为时同时改：

- registry.ts 注册 class
- BEHAVIOR_FORM_REGISTRY 注册 form 组件

**i18n**：所有 UI 字符串走 `t()`（参见 `src/test/setup.ts` 约定）。

---

## 7. 导出代码集成

### 7.1 `scene-codegen.ts` 改动

`SceneCodegenInput` 新增字段：

```ts
export interface SceneCodegenInput {
  project: SceneProject;
  includeDevComments?: boolean;
  /** 由 adapter 注入，用于 emit behavior 代码。 */
  generateBehaviorCode(binding: BehaviorBinding, ctx: CodegenContext): string;
}
```

`EmitContext` 新增 `currentNodeVar: string`（每个 emitNode 调用时设置），用于
`generateBehaviorCode` 拿到当前节点变量名。

**新增 helper：** `pushBlock(ctx, text)` —— `text.split("\n")` 后对每行调
`push(ctx, line)`，让 behavior emit 输出的多行字符串能正确按当前 `ctx.indent`
对齐。`emitMesh` / `emitLight` 等已有 emitter 用的是单行 push，本期不动；
behavior code 路径用新 helper。

**emitNode 末尾插入：**

```ts
// 在 push(ctx, `${parentVar}.add(${varName});`); 之后
ctx.currentNodeVar = varName;
for (const binding of node.behaviors) {
  const code = ctx.generateBehaviorCode(binding, {
    project: ctx.project,
    warnings: ctx.warnings,
    currentNodeVar: varName,
  });
  if (code) pushBlock(ctx, code);
}
```

### 7.2 prolog / epilog 改动

prolog 增加 `const tickers = [];` 一行（紧跟 `const templates = new Map();` 之后）。

epilog 改为：

```js
return { scene, camera, templates, tickers };
```

### 7.3 `main.js` 模板改动（vite + standalone 共享）

```js
const built = await buildScene();
const { scene, camera, tickers } = built;

// ……OrbitControls / fallback ambient light 等已有代码……

const clock = new THREE.Clock();

function animate() {
  const dt = clock.getDelta();
  for (const t of tickers) t(dt);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
```

**为什么 `Clock.getDelta()` 而不是 RAF timestamp 差**：first-frame 处理 / 暂停
切回的累积 dt 重置都由 three 自带，不用我们自己写边界条件。

### 7.4 CodegenContext 接口扩展

```ts
// src/runtime/adapter.ts
export interface CodegenContext {
  project: SceneProject;
  warnings: string[];
  /** 当前节点的运行时变量名（由 scene-codegen 在 emit 每个节点前设置）。
   *  behavior 的 emit 用它生成 `${varName}.rotation…`。 */
  currentNodeVar: string;
}
```

---

## 8. Undo/redo + Commands

沿用 PR #7 约定的 `executeCommand(new XxxCommand({...}))` 模式。`useSceneStore`
新增 4 个 mutator（仅 command 调用，UI 不直接调）：

```ts
addBehavior(nodeId: string, binding: BehaviorBinding): void;
removeBehavior(nodeId: string, bindingId: string): void;
setBehaviorEnabled(nodeId: string, bindingId: string, enabled: boolean): void;
setBehaviorParameters(nodeId: string, bindingId: string, params: Record<string, unknown>): void;
```

### Commands

| Command                        | payload                                          | mergeWith                                                     |
| ------------------------------ | ------------------------------------------------ | ------------------------------------------------------------- |
| `AddBehaviorCommand`           | `{nodeId, binding}`                              | 不合并                                                        |
| `RemoveBehaviorCommand`        | `{nodeId, prevBinding}` (完整 binding 供 revert) | 不合并                                                        |
| `SetBehaviorEnabledCommand`    | `{nodeId, bindingId, enabled, prevEnabled}`      | 不合并                                                        |
| `SetBehaviorParametersCommand` | `{nodeId, bindingId, params, prevParams}`        | 同 bindingId + 500ms 窗口合并（仿 `SetNodeTransformCommand`） |

**测试覆盖**：每个 command 的 `apply → revert` 回到原状（已有 command 测试模板）。

---

## 9. Forward-compat & 错误处理

### 未知 `behavior_type` 加载流程

- `BehaviorBindingSchema` 仍是 `z.object({...behavior_type: z.string()})` —— 开放
  字符串，不校验是否注册。
- Behaviors Tab 拿到未知 type 的 binding：渲染为 "⚠ unknown: \"<type>\" [×]"。
  用户**只能删除，不能编辑参数**（没有 schema 也就没有表单）。
- Play 模式：`adapter.installBehaviors` 跳过未知 type，`console.warn` 一行。
- 导出：`generateBehaviorCode` 推 warning，返回 ""（不阻塞导出，节点继续输出）。

### 参数 schema 校验失败

- 加载时不校验（schema 在 registry 里，BehaviorBindingSchema 不知道）。
- 实时编辑时表单本身约束（NumberInput 限制 type=number 等），命令 apply 前
  调 `definition.parameters_schema.safeParse`；失败则不 apply + UI 给红边 tooltip。
- Play 模式 install 时 safeParse 失败 → 这条 binding skip + console.warn。
- 导出时 safeParse 失败 → warnings + skip（已写在 §5）。

### Install/tick 抛错

- `install` 抛错 → `console.error`，该 binding 不进 handle map，但其他 binding 不
  受影响。Behaviors Tab 显示这条 binding 为 "broken" 状态（红边）。
- `tick` 抛错 → try/catch wrap 在 `tickBehaviors` 循环里，console.error，下一帧
  继续尝试（不主动 uninstall）。这样偶发性错误不会让整个场景假死。

---

## 10. 测试矩阵

新增/扩展测试文件：

- `src/runtime/three/behaviors/auto-rotate.test.ts`
  - params schema parse（合法 / 非法 axis / 非法 speed 类型）
  - install 返回 BehaviorHandle 形状
  - tick：单次 `dt=1` 后 `object.rotation.y` 增量 = `speed * π/180`
  - tick：负 speed
  - emit 输出含 `tickers.push` + 度→弧度数字
  - emit 输出在 `eval` 后跑 1 秒，旋转量与 tick 1 秒一致（**等价性测试**）

- `src/runtime/three/behaviors/registry.test.ts`
  - register → get / list
  - 重复 type register 抛错
  - get 未注册 type 返回 undefined

- `src/runtime/three/export/scene-codegen.test.ts`（扩展）
  - 节点带 enabled binding → 输出含 `tickers.push`
  - disabled binding → 不出现
  - 未知 behavior_type → 不出现 + 进 warnings
  - 多个 binding 在一个节点 → 各自独立 const block（var 不冲突）

- `src/runtime/three/export/emitters.test.ts`（扩展）
  - vite emitter main.js 输出含 `const clock = new THREE.Clock();` + `for (const t of tickers) t(dt);`
  - standalone emitter 同上
  - buildScene 返回值字段含 `tickers`

- `src/runtime/three/adapter.test.ts`（扩展）
  - `getSupportedBehaviors()` 包含 auto-rotate definition
  - `generateBehaviorCode` 对 enabled binding 返回非空字符串
  - `generateBehaviorCode` 对 disabled binding 返回 ""
  - `generateBehaviorCode` 对未知 type 返回 "" + push warning
  - `installBehaviors → tickBehaviors(1) → uninstallBehaviors` 正确改变 object.rotation
  - install 抛错 / tick 抛错不破坏其它 binding

- `src/services/command-history/*.test.ts`（扩展或新增 behavior commands 测试）
  - AddBehaviorCommand apply → behavior 在节点上；revert → 节点 binding 列表回到 prev
  - SetBehaviorParametersCommand 同 binding 500ms 内合并

- `src/components/editor/BehaviorsPanel.test.tsx`（新增 RTL 组件测试）
  - 选中节点带 binding → 渲染 BehaviorRow + 表单初值
  - 切换 enabled toggle → dispatch SetBehaviorEnabledCommand
  - 改 speed input → dispatch SetBehaviorParametersCommand
  - 点 [×] → dispatch RemoveBehaviorCommand
  - 未知 type → 渲染 "unknown: ..." 占位，参数表单不显示
  - PlayState=play → 所有控件 disabled

**估算**：新增 25–35 个 vitest cases，全套 cargo + vitest 仍应在 < 60s 内。

---

## 11. 视觉验证清单（per `feedback_visual_verification` 约定）

vitest 绿不等于功能正确，最终必须在 `pnpm tauri dev` 里手动验：

- [ ] 新建项目 → 给 cube 加 auto-rotate(y, 30) → Play → 看到旋转
- [ ] Play 状态下属性面板灰
- [ ] Pause 后 cube rotation 回到初始（不停在旋转过的位置）
- [ ] Cmd+Z 在 Play 状态下不可用 / Edit 状态下 undo 行为成功
- [ ] Save 项目 → 重启 → 打开 → behavior 还在 + Play 仍旋转
- [ ] Export Vite → `pnpm install && pnpm dev` → 浏览器看到旋转
- [ ] Export Standalone → 起 `python -m http.server` → 浏览器看到旋转
- [ ] 切到一个未给 cube 加 behavior 的别的节点 → Behaviors Tab 显示空状态
- [ ] 同一节点加两个 auto-rotate（不同轴）→ 同时旋转无冲突

---

## 12. 实施粒度建议

按可独立 review 的颗粒度，建议拆 2 个 PR：

1. **PR A：行为框架 + auto-rotate + 导出**（不含 Play/Pause 与 Behaviors Tab UI）
   - core/behaviors/，runtime/three/behaviors/，scene-codegen 改动，main.js 模板改动
   - adapter live runtime API（installBehaviors / tickBehaviors / uninstallBehaviors）
   - 测试：第 §10 节除 BehaviorsPanel.test 外全部
   - 验收：能从 JSON 手工塞 binding 进项目文件然后 export 看到旋转
2. **PR B：编辑器 UI（Play/Pause toggle + Behaviors Tab + commands）**
   - useUIStore 状态扩展、Tab 切换、BehaviorsPanel + AutoRotateForm
   - 4 个 commands + useSceneStore 4 个 mutator
   - 测试：BehaviorsPanel.test + command-history 测试
   - 验收：手动 §11 全部走完

可不可以合一个 PR？也行 —— 但参考 PR #19 的体量（codegen + emitter + Rust write

- menu wire），分两个 review 更轻。最终由 writing-plans 阶段定。

---

## 13. Out of scope reminders

写下来防止 scope creep：

- 行为不允许跨节点 mutate（不会有 "click A 让 B 移动"）—— 这要等到事件系统 / 消息总线，留更晚的 phase
- 不引入 tween 库 / animation curve UI
- 不做 behavior 模板 / 预设管理
- 不做 behavior 之间的依赖排序（assume 顺序无关，runtime 按 `node.behaviors[]` 数组顺序 tick）
- 不做行为参数的国际化 label（display name 走 t()，但参数 key 是英文 hard-coded）

---

## Open questions for plan stage

留给 writing-plans 阶段决定的细节：

- `useUIStore.playState` 是否需要持久化到 `project.json`？（建议否：纯编辑器状态）
- Behavior Tab UI 的具体配色/控件选择沿用既有 design tokens 即可，不在本 spec 范围
- BehaviorsPanel.test.tsx 是用 RTL 还是 vitest snapshot？沿用项目里 EditorView.test 现有风格
