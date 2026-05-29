# Phase 3 · 3.4 文档补完 · 设计

> **架构对照**：`design/framework/architecture.md` §6 把 "Phase 3 打磨与发布" 列为 v0.1 MVP 的收口阶段，包含快捷键完整化、项目模板、错误处理、文档与示例工程、GitHub Release 五个子目标。本 spec 聚焦其中之一 —— **文档补完**（项目内拆分编号 3.4）。
>
> **命名澄清**：项目 PR 历史里出现过 "Phase 3 Stage A/B"（PR #20、#21）实际落地的是架构文档定义的 **v0.5 行为系统** 的提前部分，与本 spec 的 "Phase 3" 不是同一阶段。本 spec 与后续 roadmap.md 一起承担命名重制。

---

## TL;DR

把 `docs/scene-graph-spec.md` 与 `docs/adapter-guide.md` 从 TBD 占位写到中型独立可读版（含 JSON 示例、字段表、"如何写新 adapter" step-by-step）；同步更新 `README.md` 让首屏不再说 "v0.0.1-scaffold"；新增 `docs/roadmap.md` 作为项目内部的进度跟踪文档与命名重制权威。4 份产物耦合度高（互相引用、首屏入口），一次 PR 内交付，体量约 1 周。

---

## 1. 目标 & 非目标

### 目标

- **scene-graph-spec.md 与 adapter-guide.md 写实**：从 TBD 占位抽到 v0.1.0 完整版，第三方读者读完能（a）独立理解 Scene Graph 数据格式，（b）按 guide 写自己的运行时适配器。
- **README 跟上实际进度**：milestone 表反映 Phase 0-3 + v0.5 framework 已交付的现状；新增"What works today"段；架构图段链向新 spec/adapter-guide/roadmap。
- **新增 docs/roadmap.md 作为进度跟踪文档**：架构 vs 实际映射、release 级别 sub-stage checkbox、命名重制说明（项目内 "Phase 3 Stage A/B" → "v0.5 Stage A/B"）。
- **建立文档间的导航约定**：架构文档 → spec → adapter-guide → roadmap → CHANGELOG 各司其职，互相引用清晰。

### 非目标

- 不写 `docs/skill-guide.md`（架构 §2 提到的 TBD 占位，AI Skill 是 v0.3 才落地，留给那时）。
- 不做自动生成 JSON Schema 文件（方案 C 的内容，现阶段过度）。
- 不写 conformance test 套件（adapter-guide 里只描述未来计划，v1.0 才落地）。
- 不写新的 design/prototype 资产（截图复用现有 `design/prototype/img.png` + `design/screenshots/img.png`）。
- 不改 `design/framework/architecture.md`（用户明确说架构文档是项目方向、保持稳定；本 spec 只在 roadmap.md 与 spec 内做"对照说明"，不修订架构文档主体）。
- 不重构 `CONTRIBUTING.md`（已有，与本次范围无强耦合，需要时单独 PR）。
- 不发布 v0.1.0 release（那是 Phase 3 的 3.5 sub-stage）。

### 成功标准

1. 一个不熟悉本项目的 Three.js 开发者通过 `README.md` + `docs/scene-graph-spec.md` + `docs/adapter-guide.md` 能（a）了解项目是什么、（b）读懂 Scene Graph JSON 格式、（c）画出 IRuntimeAdapter 接口并知道关键方法语义，无需读 `src/`。
2. `docs/roadmap.md` 能在一屏内回答"项目现在哪里、下一步什么、什么时候发 v0.1"。
3. 新文档与 `design/framework/architecture.md` 互不矛盾，且引用关系清楚（架构文档 = 项目方向，spec = 数据格式权威，adapter-guide = 适配器作者教程 + 参考，roadmap = 进度状态）。
4. `pnpm lint` / `pnpm typecheck` / `pnpm test` 全绿（本 sub-stage 不改代码，理论上 zero risk，但需验证 prettier 不动 design/）。

---

## 2. 上下文与命名约定

### 2.1 架构 vs 实际进度映射

| 架构阶段（`architecture.md` §6-7） | 内容                                                      | 项目实际交付                                                     |
| ---------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| Phase 0 地基                       | Scene Graph + Command + 适配器接口 + Tauri 骨架           | ✅ PR #1-#11                                                     |
| Phase 1 渲染编辑                   | ThreeAdapter + 视口 + 拾取 + Gizmo + 属性/层级面板        | ✅ PR #1-#11                                                     |
| Phase 2 导入导出                   | .glb 导入 + 资源管线 + 代码模板 + 导出对话框              | ✅ PR #12-#19                                                    |
| **Phase 3 打磨发布**               | 快捷键 + 项目模板 + 错误处理 + 文档 + v0.1 GitHub Release | 🟡 未做（**本 spec 是 3.4 文档补完**）                           |
| v0.5 行为系统                      | auto-rotate、hover-highlight 等内置行为                   | 🟡 framework + 1 个 behavior（**PR #20 + #21，提前于架构顺序**） |
| v0.2 资源库 + 材质编辑             | 内置库 + 用户上传 + 材质参数                              | ⏳                                                               |
| v0.3 AI Skill 框架                 | Skill 接口 + AI proxy + 自然语言操作                      | ⏳                                                               |
| v0.4 空间吸附                      | Socket 系统 + 几何约束                                    | ⏳                                                               |
| v1.0 多适配器                      | Babylon.js 适配器                                         | ⏳                                                               |
| v1.x                               | R3F、Unity                                                | ⏳                                                               |

### 2.2 命名重制

- **项目内历史命名 "Phase 3 Stage A/B"**（PR #20、#21）→ 新文档中统一称 **"v0.5 Stage A"** 与 **"v0.5 Stage B"**。
  - PR 标题、commit message、历史 plan 文件（`docs/superpowers/plans/2026-05-25-phase3-behaviors-stage-{a,b}.md`）保留原名（不改 git 历史），但在 roadmap.md 写一段"历史命名映射"说明。
- **架构 §6 的 Phase 3** → 项目内继续叫 **"Phase 3"**，但所有未来引用必须明确指向 v0.1 打磨发布（包含 3.1-3.5 sub-stage）。
- **本 sub-stage** → 称作 **"Phase 3 · 3.4 文档补完"**。

### 2.3 文档定位矩阵

| 文档                               | 受众                              | 权威范围                                            | 更新节奏               |
| ---------------------------------- | --------------------------------- | --------------------------------------------------- | ---------------------- |
| `design/framework/architecture.md` | 项目内部高层、未来开源生态        | 项目方向、五层架构原则、技术决策                    | 重大方向变化才动       |
| `docs/scene-graph-spec.md`         | **写自己 adapter 的第三方开发者** | Scene Graph JSON 数据格式                           | spec_version 升级时    |
| `docs/adapter-guide.md`            | **想集成新引擎的 adapter 作者**   | IRuntimeAdapter 接口 + 实现教程 + ThreeAdapter 参考 | 接口变化或重大新能力时 |
| `docs/roadmap.md`                  | 项目内部、PR reviewer、issue 跟踪 | 进度、命名、release 计划                            | 每个 release 完成时    |
| `README.md`                        | GitHub 路过者、新用户             | 项目概览、如何上手、当前状态                        | 首屏需要常态对齐       |
| `CHANGELOG.md`                     | 用户、PR reviewer                 | 已发布版本的细节变更                                | 每次 release tag       |

---

## 3. 范围与拆分

本 sub-stage 一个 PR 交付 4 份产物（耦合度高、互相引用）。如果实施时发现单 PR 太大，可拆为：

- **PR A**: scene-graph-spec.md + adapter-guide.md（spec/guide pair，互相引用）
- **PR B**: README.md 更新 + docs/roadmap.md（项目状态对齐，依赖 PR A 的链接）

但默认按一个 PR 推进。

---

## 4. 产物 §1：`docs/scene-graph-spec.md`

### 4.1 章节结构

```
# Scene Graph Specification

## Status
- spec_version: 0.1.0
- 与 design/framework/architecture.md §3 的关系
- 引用 src/core/scene/schemas.ts 作为 source of truth (但 spec 本身可独立阅读)

## 1. Overview
- 什么是 Scene Graph、为什么 tech-stack independent、git-friendly 设计动机

## 2. SceneProject (top-level)
- 字段表 (spec_version / metadata / scene / assets / settings)
- 完整 JSON 示例 (从 examples/single-cube 反推 / 简化)
- RuntimeTarget 类型说明 (当前仅 three.js 落地, 其他枚举值"reserved")

## 3. SceneGraph & Node
- SceneGraph 结构 (root_id + nodes record)
- Node 字段表
- Transform (含四元数 [x,y,z,w] 顺序约定; 与 Three.js / glTF 对齐)
- NodeKind 枚举与扩展点 (custom)

## 4. NodeData per kind
分 7 节, 每节含字段表 + JSON 示例 + ThreeAdapter 支持矩阵:
- 4.1 group
- 4.2 mesh (含 material_overrides 当前未实现说明)
- 4.3 light (directional / point / spot / ambient)
- 4.4 camera (perspective / orthographic)
- 4.5 helper (grid / axes; pickability 约定引用 PR #15 fixup)
- 4.6 prefab_instance (引用 AssetReference; 子树在 AssetCache; PR #17 集中描述)
- 4.7 custom (扩展点契约)

## 5. AssetReference
- 字段表 (id / content_hash / kind / relative_path / tags / description / source)
- AssetSource 四种 (builtin / user_upload / online / ai_generated)
- 内容寻址约定 (project/assets/{hash}.{ext}; 跨 save 用 hardlink 保留, PR #17)
- AssetCache 模型说明 (per-ThreeAdapter 实例; 不进 spec, 留给 adapter-guide)

## 6. BehaviorBinding
- 字段表 (id / behavior_type / enabled / parameters)
- 内置 behavior 注册表 (当前仅 auto-rotate; 含参数 schema: axis "x"|"y"|"z" + speed number deg/s)
- 跨适配器 behavior 设计原则 (semantic action; 每个 adapter 自实现)
- 未知 behavior_type 加载策略 (forward-compat: 保留 binding, runtime 标记 unknown)

## 7. Settings
- units / up_axis / background 字段说明

## 8. Serialization (on-disk)
- 文件夹布局 (project.json + scene/hierarchy.json + scene/nodes/{id}.json + assets/{hash}.ext)
- 为什么 per-node 文件 (git diff 最小化)
- parent_id / children_ids 省略约定 (per-node 文件不含, 由 hierarchy.json 重建)
- 文件命名规则 + 大小写敏感性

## 9. Versioning & Migration
- spec_version semver 升级时机
- 未来 v0.2 兼容策略 (forward 加字段 / 改字段)
- migration 函数约定 (src/core/migrations/, 未来落地)

## 10. Validation
- zod schema 引用 (src/core/scene/schemas.ts)
- 必填 vs 可选字段表
- 校验失败的错误码约定 (PersistenceError, 引用 PR #14)

## 11. Reserved & Future
- RuntimeTarget 未落地 kind (babylon.js / unity / react-three-fiber)
- custom node 与 custom behavior 的扩展边界
- v0.2+ 计划的字段 (e.g. material_overrides 的细化)
```

### 4.2 关键决策

- **与 architecture.md §3 的关系**：spec 是面向生态的 **唯一权威**（包括 JSON 字段语义、序列化布局）。architecture.md §3 在文档头部加一行 "see [scene-graph-spec.md](../docs/scene-graph-spec.md) for the canonical schema"，正文不动。**spec 一处包含的，architecture.md 不重复**（避免 drift）。
- **JSON 示例反推源**：优先用 `examples/single-cube` 与 `examples/empty-project` 已有内容；不够时手写 minimal 示例，保证可对照 zod schema 校验通过。
- **当前 vs 未来字段**：明确标注"current"与"reserved"，避免读者误以为 `material_overrides` / `RuntimeTarget.babylon.js` 当前能用。

### 4.3 反推源

- `src/core/scene/schemas.ts` — zod schema 完整字段
- `src/core/scene/types.ts` — 类型别名（`SceneNode` 对应规范的 `Node`，仅命名差异）
- `src/core/scene/persistence.ts` — 序列化布局
- `src/core/scene/defaults.ts` — 默认值
- `src/services/scene/demo-project.ts` — 真实 JSON 示例素材
- `examples/single-cube/` + `examples/empty-project/` — 已有 JSON
- `src/runtime/three/behaviors/auto-rotate.ts` — behavior 参数 schema
- 已合并 PR 描述（PR #14、#15、#17、#19、#20）—— 关键决策上下文

### 4.4 命名兼容性

- spec 文档用 architecture 原始命名（`Node`、`NodeType`），代码内 `SceneNode`、`NodeKind` 是 TS 命名分歧（避免 lib.dom 冲突），在 spec §3 写明 "JSON 字段名 `type` 不变，TS 类型在 src/ 中叫 `SceneNode`/`NodeKind`，与 spec 等价"。

---

## 5. 产物 §2：`docs/adapter-guide.md`

### 5.1 章节结构

```
# Runtime Adapter Authoring Guide

## Status
- 与 design/framework/architecture.md §4.1 的关系
- 与 docs/scene-graph-spec.md 的关系 (spec 是数据格式; guide 是接口 + how-to)

## 1. What is a runtime adapter
- 概念: SceneGraph (技术中立 JSON) ↔ engine (Three.js / Babylon / ...) 桥
- 五层架构里的位置 (src/runtime/, 只依赖 src/core/)
- MVP 仅 Three.js 落地; 其他 kind 保留

## 2. The IRuntimeAdapter interface
- 完整签名 (含 Stage A 加的 installBehaviors / tickBehaviors / uninstallBehaviors / getRuntimeObject / setViewportSize 等扩展)
- 每方法语义 + 错误约定 (NotImplementedYet vs runtime error)
- 输入 / 输出契约表

## 3. Lifecycle
- mount: 创建渲染器 / 场景 / 相机 / 控件
- sync: syncNode("add"|"update"|"remove") 增量
- pick: pickAt(x, y) 返回 node_id 或 null
- export: exportProject(project, options) → ExportResult
- behavior: installBehaviors / tickBehaviors / uninstallBehaviors (Stage A)
- unmount: 清理引用 + dispose
- 配合 diffAndApply / asset preload 流程 (引用 src/runtime/three/adapter.ts)

## 4. Mapping Node kinds
- 通用 builder 模式 (BuilderRegistry + buildObject / updateObject)
- per-kind 子节, 与 spec §4 一一对应:
  - 4.1 group → THREE.Group
  - 4.2 mesh → THREE.Mesh + 几何 / 材质
  - 4.3 light → THREE.{Directional|Point|Spot|Ambient}Light
  - 4.4 camera → THREE.{Perspective|Orthographic}Camera
  - 4.5 helper → THREE.GridHelper / AxesHelper (pickability override 约定)
  - 4.6 prefab_instance → cached THREE.Group clone (引用 AssetCache, PR #17)
  - 4.7 custom → throw 或 builder 扩展点

## 5. Mapping Behaviors
- Behavior class 契约 (install / tick / uninstall / generateCode)
- behaviorRegistry 注册 (per-adapter, src/runtime/three/behaviors/registry.ts)
- codegen ↔ runtime 共享 Behavior 实例的设计原则 (Stage A 关键决策)
- 错误隔离: 一个 binding throw 不影响其他 binding tick

## 6. Code export
- Exporter interface (单 emit 方法 → ExportResult)
- ExportFile = text | asset_copy reference
- Rust hardlink 集成 (PR #17, asset_copy → 同盘 hardlink)
- 当前内置 target: vite / standalone-esm
- 添加新 target 的步骤 (1 entry EXPORTERS + 1 Exporter impl)

## 7. Writing your own adapter
Step-by-step, 含 Babylon 假设示例:
- 7.1 Step 1: 实现 mount + sync (空场景能渲染)
- 7.2 Step 2: per-kind builder (mesh / light / camera)
- 7.3 Step 3: pickAt (raycast / engine 拾取)
- 7.4 Step 4: BehaviorRegistry 注册
- 7.5 Step 5: Exporter 写 main.js 模板
- 7.6 Step 6: 接入 useUIStore / RuntimeTarget enum
- 每步骤含: Babylon 假设代码片段 + 测试该步的方法

## 8. ThreeAdapter reference
- src/runtime/three/ 导览
- 关键设计决策链接到 PR 描述 (#11 OutlinePass / #15 lock 策略 / #17 asset cache / #19 export 等)
- 视口集成: ThreeViewport + canvas style + manual setSize (PR #5 layout, PR #9 bundle)

## 9. Testing your adapter
- 现状: src/runtime/three/adapter.test.ts 覆盖范围
- 未来: conformance suite (v1.0 计划, 同时落地 Babylon adapter 时立)
- 与 src/runtime/three/export/scene-codegen.test.ts 的"no TS syntax" 约定

## 10. Reserved & Future
- runtime target 扩展 (babylon / unity / r3f)
- multi-adapter scenarios (导出时选 target, 编辑时 fixed)
- AI Skill 集成 (v0.3, getRuntimeObject 是入口)
```

### 5.2 关键决策

- **教程 + 参考混合**：§7 是教程（Babylon 假设示例），§8 是参考（ThreeAdapter 导览）。读者可以按需切换。
- **Babylon 示例代码**：用伪代码 + Babylon 真实 API 名（让示例可读且不需要实际验证），明确标注 "hypothetical, not tested"。
- **PR 链接策略**：关键决策（lock 策略、asset cache、bundle 分包、layout 约定）链接到 PR 描述 URL，让读者能追溯当时的设计推理。
- **不重复 spec 内容**：guide §4 与 spec §4 对应，但 guide 只描述 "如何映射到 engine 对象"，不重复 spec 的 JSON 字段定义。

### 5.3 反推源

- `src/runtime/adapter.ts` — IRuntimeAdapter 接口
- `src/runtime/three/adapter.ts` — ThreeAdapter 实现
- `src/runtime/three/node-builders/` — per-kind builder
- `src/runtime/three/behaviors/` — Behavior framework
- `src/runtime/three/export/` — Exporter 实现 + scene-codegen
- `src/services/scene/` + `src/ui/viewport/ThreeViewport.tsx` — 集成点
- 已合并 PR 描述（特别是 #11、#15、#17、#19、#20）

---

## 6. 产物 §3：`README.md` 更新

### 6.1 改动清单

| 区域                                                    | 改动                                                                                                                                            |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Status badge                                            | `pre-MVP_scaffold` → `pre-v0.1` (颜色由 plan 阶段定，建议 yellow/amber 表示"接近发布")                                                          |
| "Status" 段落                                           | "You are here: v0.0.1-scaffold..." → 重写为"Phase 0-2 + behaviors framework shipped; Phase 3 in progress towards v0.1.0"                        |
| Milestone 表                                            | 5 行换成完整版（Phase 0/1/2/3 sub-stages + v0.2-v1.x），表尾链向 `docs/roadmap.md`                                                              |
| 新增 "What works today" 段（架构图前）                  | 一段 4-5 行清单：创建 / 编辑 / 行为 / 导入 / 导出                                                                                               |
| 架构图段                                                | 原 SVG 保留 + 加 3 个链接 (scene-graph-spec / adapter-guide / roadmap)                                                                          |
| 截图策略                                                | 头图保留 `design/prototype/img.png` (设计意图); 新增小节 "Current implementation" 放 `design/screenshots/img.png` (实际状态, 行为系统 Tab 可见) |
| Stack / Development / Releases / Contributing / License | 不动 (内容仍准确)                                                                                                                               |

### 6.2 截图策略

- **头图**（首屏）：保持 `design/prototype/img.png`（高保真原型，design 意图）—— 给视觉冲击，告诉读者"产品长这样"。
- **新增 "Current implementation"** 段（位置：架构图之后、Prototype 之前）：放 `design/screenshots/img.png`（实际行为系统 UI）—— 告诉读者"实际已经实现到这里"。文案：

  > Below is the current editor state — behaviors framework + auto-rotate + Play/Pause toggle shipped in PR #20–#21:
  >
  > ![Current editor state](design/screenshots/img.png)

### 6.3 i18n 与术语

- README 全文英文（与现状一致；非中文受众占主）。
- 术语：保持 `Scene Graph` / `runtime adapter` / `behaviors` / `prefab_instance` 等首字母约定与 spec、adapter-guide 一致。

---

## 7. 产物 §4：`docs/roadmap.md` 新增

### 7.1 文件结构

```markdown
# lowcode-3d Roadmap

> Project status and release planning. Architecture direction lives in
> [`design/framework/architecture.md`](../design/framework/architecture.md);
> this file tracks where we actually are.

## Where we are

(One-paragraph current status: Phase 0-2 shipped + v0.5 behaviors framework
ahead of schedule; Phase 3 (v0.1 polish & release) in progress.)

## Architecture vs implementation map

| Architecture stage               | Content                | PR #     | Status         |
| -------------------------------- | ---------------------- | -------- | -------------- |
| Phase 0 地基                     | ...                    | #1-#11   | ✅             |
| Phase 1 渲染编辑                 | ...                    | #1-#11   | ✅             |
| Phase 2 导入导出                 | ...                    | #12-#19  | ✅             |
| Phase 3 打磨发布                 | 3.1-3.5 sub-stages     | —        | 🟡 in progress |
| v0.5 行为系统 (提前)             | framework + 1 behavior | #20, #21 | 🟡 partial     |
| v0.2 / v0.3 / v0.4 / v1.0 / v1.x | ...                    | —        | ⏳             |

## Naming reclamation

历史命名 "Phase 3 Stage A/B"（PR #20, #21）实际是架构定义的 v0.5
行为系统的提前实现。本文档以及后续 spec / plan 统一改称：

- "Phase 3 Stage A" → **"v0.5 Stage A"**（framework + auto-rotate runtime + codegen）
- "Phase 3 Stage B" → **"v0.5 Stage B"**（UI + commands + Play/Pause）

PR 标题与 commit message 不改，但所有未来文档引用以新名为准。

## Releases

### v0.1.0 (MVP) — In progress

- **Goals**: 完成架构 §6 定义的 Phase 0-3，发布第一个可用的 MVP。
- **Target user**: Three.js 开发者，想用图形编辑器组场景并导出 Three.js 代码。
- **Success criteria**:
  - 安装包能在 macOS / Windows / Linux 安装
  - 用户完整故事：New → 编辑 → 添加行为 → Play 预览 → 导出 Vite 工程 → 跑通
  - docs/scene-graph-spec.md + docs/adapter-guide.md 完整
  - 有 demo 视频或 GIF 在 README

- **Sub-stages**:
  - [x] Phase 0 地基 (PR #1-#11)
  - [x] Phase 1 渲染编辑 (PR #1-#11)
  - [x] Phase 2 导入导出 (PR #12-#19)
  - [ ] Phase 3 打磨发布
    - [ ] 3.1 快捷键完整化
    - [ ] 3.2 项目模板系统
    - [ ] 3.3 错误处理 polish
    - [ ] 3.4 文档补完 ← **本 PR**
    - [ ] 3.5 发布流程 (CHANGELOG + tag + GitHub Release)

### v0.5 — Partially shipped ahead of schedule

- **Goals**: 行为系统（架构 §7 v0.5）
- **Target user**: 同 v0.1，需要无代码定义"自动旋转/悬停高亮/点击触发"等语义动作。
- **Success criteria**: 至少 3 个内置 behavior 可用 + UI 能添加/编辑/删除 + Play 模式预览 + 导出代码内嵌行为。
- **Sub-stages**:
  - [x] v0.5 Stage A: framework + auto-rotate runtime + codegen (PR #20)
  - [x] v0.5 Stage B: UI Tab + 4 commands + Play/Pause toggle (PR #21)
  - [ ] v0.5 Stage C: 多 behavior 补完 (hover-highlight / click-trigger / event-emit)

### v0.2 — Planned

- **Goals**: 资源库 + 材质编辑（架构 §7 v0.2）
- **Target user**: ...
- **Success criteria**: ...
- **Depends on**: v0.1 release

### v0.3 / v0.4 / v1.0 / v1.x — Planned

(Each: Goals · Target user · Success criteria · Depends on, high-level only)

## Tracking conventions

- 每个 release 一节，sub-stage checkbox 跟踪进度
- 每个 sub-stage 完成后勾选 + 在 sub-stage 行末加 PR 链接
- 进度滚动到 release 收口时归档到 CHANGELOG，roadmap 这一节标记 "Released YYYY-MM-DD"
- 命名重制只追加，不删除（保留历史决策）
```

### 7.2 命名重制说明

写一段独立小节解释为什么改名 + 历史索引。目的是让 git blame / PR 搜索还能找到，但文档读者不困惑。

### 7.3 跟踪约定

- 每个 sub-stage 完成时更新 checkbox + PR 链接
- release 收口时把整节归档到 CHANGELOG
- roadmap.md 维护：当前 release + 下一个 release 详细；更远 release high-level

### 7.4 中英文策略

roadmap.md 用 **中英混合**（与 architecture.md 一致，章节标题英文 + 中文术语保留）—— 它是项目内部 + 中文团队主用文档。区别于 spec/adapter-guide.md（生态权威，英文）。

---

## 8. 文档之间的链接关系图

```
                            architecture.md
                          (项目方向, 五层架构)
                                  ↓
                ┌──────────────────┬──────────────────┐
                ↓                  ↓                  ↓
       scene-graph-spec.md   adapter-guide.md     roadmap.md
       (JSON 数据格式权威)    (适配器接口 + 教程)    (进度 + 命名)
                ↑                  ↑                  ↑
                └──────────────────┼──────────────────┘
                                   ↓
                              README.md
                          (首屏入口, 链向所有)
                                   ↓
                              CHANGELOG.md
                          (每次 release tag)
```

**链接约定**：

- README 链向 4 份文档作为深入入口
- scene-graph-spec ↔ adapter-guide 互相引用 (spec §6 BehaviorBinding 引用 guide §5 Mapping Behaviors)
- roadmap 引用 architecture 与 spec 作为权威
- spec / adapter-guide 引用 architecture 作为高层背景

---

## 9. 风格与排版约定

### 9.1 语言

| 文档                              | 语言                                            |
| --------------------------------- | ----------------------------------------------- |
| `docs/scene-graph-spec.md`        | English (生态权威, 未来抽 packages/scene-spec/) |
| `docs/adapter-guide.md`           | English (同上)                                  |
| `README.md`                       | English (与现状一致)                            |
| `docs/roadmap.md`                 | 中英混合 (项目内部, 与 architecture.md 一致)    |
| 本 spec (docs/superpowers/specs/) | 中文 (项目内部 brainstorming 产物)              |

### 9.2 排版

- 字段表：Markdown 表格（字段 / 类型 / 必填 / 说明）
- JSON 示例：fenced code block 标 `json`
- TypeScript 接口：fenced code block 标 `ts`
- 内部链接：相对路径（`../design/framework/architecture.md`、`../src/core/scene/schemas.ts:120`）
- 外部链接：完整 URL
- PR 引用：`[PR #20](https://github.com/longyi-xw/lowcode-3d/pull/20)` 形式
- 标题层级：H1 一个（文档标题）；章节用 H2；子章节 H3+

### 9.3 术语

| 术语                                | 使用                                                                |
| ----------------------------------- | ------------------------------------------------------------------- |
| Scene Graph                         | 首字母大写                                                          |
| runtime adapter                     | 全小写                                                              |
| behavior / Behavior                 | 数据层小写 (binding/parameter)；类层大写 (Behavior class)           |
| Node / NodeKind                     | spec 用 architecture 原始大写命名；src/ 内是 `SceneNode`/`NodeKind` |
| Phase / Stage / release / sub-stage | 区分严格 (Phase = 架构阶段, release = vX.Y, sub-stage = 单 PR)      |

---

## 10. 测试 / 验证矩阵

| 验证项                                          | 方法                                                  |
| ----------------------------------------------- | ----------------------------------------------------- |
| spec JSON 示例能通过 zod schema                 | 手动 (拷贝示例到 vitest, 跑 SceneProjectSchema.parse) |
| 文档内部链接不死                                | 手动点 (或 markdown link 检查脚本, 可选)              |
| README 截图正常显示                             | GitHub PR preview                                     |
| roadmap.md checkbox 数对得上当前 sub-stage 状态 | 自查                                                  |
| 与 architecture.md 无矛盾                       | 自查 (两份对照读一遍)                                 |
| 与现有 PR # 引用准确                            | git log 核对                                          |
| 不引入 lint/type/test 退化                      | `pnpm lint && pnpm typecheck && pnpm test`            |
| 视觉验证                                        | 不适用 (本 sub-stage 不改代码)                        |

---

## 11. 实施粒度建议

按以下顺序写，每步独立可暂停：

1. **roadmap.md 先写**（基础框架，其他文档引用）
2. **scene-graph-spec.md** 写实
3. **adapter-guide.md** 写实（引用 spec）
4. **README.md** 更新（最后写，因为引用前 3 份）

每步骤可独立 commit。如果体量太大可拆 2 个 PR（spec/guide 一个、README/roadmap 一个）。

写 plan 时按这个顺序拆 task。

---

## 12. Out of scope reminders

防止 scope creep：

- **不动 architecture.md**：架构文档是项目方向，本 spec 不修订主体。
- **不写 skill-guide.md**：留给 v0.3。
- **不生成 JSON Schema 文件**：留给方案 C 时机。
- **不写 conformance test**：adapter-guide §9 只描述未来计划。
- **不出 demo 视频**：那是 3.5 发布流程的产物。
- **不改 CHANGELOG**：3.5 sub-stage 集中处理。
- **不动 examples/ 内容**：除非示例 JSON 与 spec 不一致需要小修。
- **不写自动生成文档工具链**（typedoc / tsdoc）：现阶段手写。

---

## Open questions for plan stage

写 plan 时需进一步确认：

1. roadmap.md 里 v0.2 / v0.3 / v0.4 / v1.0 / v1.x 每个 release 的"Goals / Target user / Success criteria"用什么粒度？建议：当前 release（v0.1）详细，下一个（v0.2）中等，再之后只列 Goals 一行。
2. README 的 milestone 表是否完全展开 sub-stage（10+ 行）还是只到 phase 级（5 行）？建议：表里只到 release 级（v0.1 / v0.2 / ...），sub-stage 在 roadmap.md。
3. adapter-guide §7 的 Babylon 示例代码用什么 API 版本？建议：Babylon.js 8.x 文档最新，但标注 "hypothetical"。
4. scene-graph-spec §4 的"ThreeAdapter 支持矩阵"列出哪些维度？建议：是否实现 / 是否进 codegen / 当前限制。
5. 截图更新策略：`design/screenshots/img.png` 是用户在本会话中改过的（视觉验证记录），是否 commit 进本 PR 让 README 引用？建议：commit，作为"current implementation"佐证。
