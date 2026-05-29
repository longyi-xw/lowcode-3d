# Phase 3 · 3.4 文档补完 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 把 `docs/scene-graph-spec.md` 与 `docs/adapter-guide.md` 从 TBD 占位写到中型独立可读版（含 JSON 示例 / 字段表 / "如何写新 adapter" step-by-step），更新 `README.md` 让首屏跟上实际进度，新增 `docs/roadmap.md` 作为项目内部进度跟踪文档与命名重制权威。4 份产物一个 PR 内交付。

**架构：** 4 份独立 markdown 文档 + 1 个截图，无代码改动。按引用关系顺序写：roadmap → spec → guide → README。每份文档独立 commit；spec / guide 内部按章节再分 commit 保留可逆性。

**技术栈：** Markdown（CommonMark + Github extensions）+ prettier（husky 自动跑）+ 现有 lint/typecheck/test 全绿验证。

**前置：**

- spec 见 `docs/superpowers/specs/2026-05-28-phase3-docs-polish-design.md`（commit 969268e）
- PR #21 (`feat/phase3-behaviors-ui` → main, v0.5 Stage B + spec commit) 当前 OPEN, MERGEABLE, CLEAN
- **推荐：** 等 PR #21 merge 后从更新的 main 拉新分支 `docs/phase3-docs-polish`；若 PR #21 评审延迟可从 `feat/phase3-behaviors-ui` 拉新分支（PR 需在 #21 merge 后 rebase）

**所有 git/pnpm 命令前缀（git hook 需 Node 20）：**

```sh
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
```

下文步骤里的 `pnpm` / `git` 命令默认假设此 PATH 已导出。

**起手：**

```sh
# 推荐路径 (PR #21 已 merge)
git checkout main && git pull
git checkout -b docs/phase3-docs-polish

# 或备选 (PR #21 仍 OPEN)
git checkout feat/phase3-behaviors-ui && git pull
git checkout -b docs/phase3-docs-polish
```

---

## Open questions 决议（spec §Open questions 在 plan 阶段定案）

实施前已就 spec 留下的 5 个 open question 给出明确答案：

| #   | 问题                                               | plan 决议                                                                                                                                                                                                                    |
| --- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `roadmap.md` v0.2-v1.x 各 release 节粒度           | **v0.1 详细**（Goals · Target user · Success criteria · Sub-stages checkbox）；**v0.5 + v0.2 中等**（Goals + Target + Success criteria，不展开 sub-stage）；**v0.3 / v0.4 / v1.0 / v1.x 简略**（仅 Goals 一行 + Depends on） |
| 2   | `README` milestone 表展开到 phase 还是 sub-stage   | **只到 release 级**（v0.1 / v0.2 / v0.3 / v0.4 / v0.5 / v1.0 / v1.x，7 行），sub-stage 在 `roadmap.md`                                                                                                                       |
| 3   | `adapter-guide.md` §7 Babylon 示例 API 版本        | **Babylon.js 8.x**，章节开头明确标注 `> Hypothetical code, not tested. Babylon.js 8.x API as of 2026-05.`                                                                                                                    |
| 4   | `scene-graph-spec.md` §4 ThreeAdapter 支持矩阵维度 | 三列：**Implemented**（builder 是否存在）/ **Codegen**（scene-codegen 是否 emit）/ **Limitations**（当前限制简述）                                                                                                           |
| 5   | `design/screenshots/img.png` 是否 commit 进本 PR   | **是**——作为 "current implementation" 佐证；README 引用；单独 commit（task D5）                                                                                                                                              |

---

## 文件结构

**新增：**

- `docs/roadmap.md`

**重写（从 TBD 到完整）：**

- `docs/scene-graph-spec.md`
- `docs/adapter-guide.md`

**修改：**

- `README.md`

**Commit 进 PR（已 modified）：**

- `design/screenshots/img.png`

**不动：**

- `design/framework/architecture.md`（项目方向稳定）
- `docs/skill-guide.md`（v0.3 才落地，本 sub-stage 不写）
- `CHANGELOG.md`（3.5 sub-stage 处理）
- `CONTRIBUTING.md`、`examples/**`、`src/**`、`src-tauri/**`

---

## 任务 D0：起手 + 基线验证

**文件：** 无修改

- [ ] **步骤 1：开新分支**

按"起手"段落选推荐路径或备选路径执行 `git checkout -b docs/phase3-docs-polish`。

- [ ] **步骤 2：验证当前分支干净 + 基线测试**

```sh
git status                # 应只见 untracked CLAUDE.md / tests/ (个人不进 git)
pnpm install              # 同步依赖
pnpm lint                 # 基线
pnpm typecheck            # 基线
pnpm test                 # 基线: 255 tests should pass
pnpm format:check         # 基线: 期望全过；如有遗留可先 `pnpm format`
```

预期：lint / typecheck / test / format 全绿（不改代码理论 zero 退化）。

- [ ] **步骤 3：通读 spec 一遍作为执行参考**

```sh
cat docs/superpowers/specs/2026-05-28-phase3-docs-polish-design.md
```

特别记住：

- §2.2 命名重制
- §9.1 中英文策略
- §11 实施顺序
- 上面"Open questions 决议"五条

---

## 任务 D1：`docs/roadmap.md` 新增

**文件：**

- 创建：`docs/roadmap.md`

> 第一个写：其他 3 份文档会引用它的 "Naming reclamation" 与 "Architecture vs implementation map"。

- [ ] **步骤 1：创建文件 + 写头部 + Where we are + 映射表**

```sh
mkdir -p docs && touch docs/roadmap.md
```

内容：

```markdown
# lowcode-3d Roadmap

> Project status and release planning. Architecture direction lives in
> [`design/framework/architecture.md`](../design/framework/architecture.md);
> this file tracks where we actually are.
>
> 项目当前进度与发布计划。架构方向请见
> [`design/framework/architecture.md`](../design/framework/architecture.md);
> 本文记录实际进度。

## Where we are

截至 2026-05-29，本项目已完成架构定义的 **Phase 0**（地基）+ **Phase 1**（Three.js 渲染编辑）+ **Phase 2**（资源导入与代码导出），并提前实现了 **v0.5 行为系统** 的 framework 与首个 behavior（auto-rotate）。**Phase 3 打磨发布**（v0.1 收口）进行中：本 PR 是 sub-stage 3.4 文档补完。

## Architecture vs implementation map

下表把架构文档 `design/framework/architecture.md` §6-7 的阶段定义对照到实际 PR：

| Architecture stage        | Content                                                    | Tracked PR    | Status     |
| ------------------------- | ---------------------------------------------------------- | ------------- | ---------- |
| Phase 0 地基              | Scene Graph + Command + 适配器接口 + Tauri 骨架            | #1–#11        | ✅         |
| Phase 1 渲染编辑          | ThreeAdapter + 视口 + 拾取 + Gizmo + 属性/层级面板         | #1–#11        | ✅         |
| Phase 2 导入导出          | .glb 导入 + 资源管线 + Vite/Standalone 代码导出            | #12–#19       | ✅         |
| Phase 3 打磨发布          | 快捷键完整化 / 项目模板 / 错误处理 / 文档 / GitHub Release | (in progress) | 🟡         |
| v0.5 行为系统（提前部分） | Behavior framework + auto-rotate + UI + Play/Pause         | #20, #21      | 🟡 partial |
| v0.2 资源库 + 材质编辑    | 内置库 + 用户上传 + 材质参数                               | —             | ⏳         |
| v0.3 AI Skill 框架        | Skill 接口 + AI proxy + 自然语言操作                       | —             | ⏳         |
| v0.4 空间吸附             | Socket 系统 + 几何约束                                     | —             | ⏳         |
| v1.0 多适配器             | Babylon.js 适配器                                          | —             | ⏳         |
| v1.x                      | R3F、Unity                                                 | —             | ⏳         |
```

- [ ] **步骤 2：写 Naming reclamation 段**

接在上一段之后：

```markdown
## Naming reclamation

历史 PR 标题里出现的 "Phase 3 Stage A/B"（PR #20、#21）实际落地的是架构 §7 定义的 **v0.5 行为系统**，而不是架构 §6 的 Phase 3（v0.1 打磨发布）。本文档与所有未来 plan / spec 统一改称：

| 历史命名（PR 标题/commit message 不改） | 新命名（文档以此为准）                                             |
| --------------------------------------- | ------------------------------------------------------------------ |
| "Phase 3 Stage A" (PR #20)              | **v0.5 Stage A** — framework + auto-rotate runtime + scene-codegen |
| "Phase 3 Stage B" (PR #21)              | **v0.5 Stage B** — UI Tab + 4 commands + Play/Pause toggle         |

历史 plan 文件 `docs/superpowers/plans/2026-05-25-phase3-behaviors-stage-{a,b}.md` 不改名。**所有新写的 plan / spec 与文档以新名为准**，引用历史 PR 时附 "(historically called …)" 注脚以便 git blame 检索。

架构 §6 的 "Phase 3" 在本项目内保留原义 = v0.1 打磨发布；其子拆分使用 **Phase 3 · 3.1 / 3.2 / 3.3 / 3.4 / 3.5** 编号。
```

- [ ] **步骤 3：写 Releases / v0.1 节（详细）**

```markdown
## Releases

### v0.1.0 (MVP) — In progress

- **Goals**: 完成架构 §6 定义的 Phase 0-3，发布第一个可下载安装、能完整跑通"建项目 → 编辑 → 添加行为 → Play 预览 → 导出 Vite 工程并运行"故事的 MVP。
- **Target user**: Three.js 开发者，想用图形编辑器组场景并导出可二次开发的 Three.js 代码。
- **Success criteria**:
  - 安装包能在 macOS / Windows / Linux 安装
  - 完整用户故事跑通（New → 编辑 → 添加 auto-rotate → Play → Export Vite → `pnpm install && pnpm dev` 看到立方体旋转）
  - `docs/scene-graph-spec.md` + `docs/adapter-guide.md` 完整且独立可读
  - README 首屏不撒谎；有截图或 demo GIF
  - CI 全绿；可签名安装包 artifact

- **Sub-stages**:
  - [x] Phase 0 地基 ([#1](https://github.com/longyi-xw/lowcode-3d/pull/1)–[#11](https://github.com/longyi-xw/lowcode-3d/pull/11))
  - [x] Phase 1 渲染编辑 ([#1](https://github.com/longyi-xw/lowcode-3d/pull/1)–[#11](https://github.com/longyi-xw/lowcode-3d/pull/11))
  - [x] Phase 2 导入导出 ([#12](https://github.com/longyi-xw/lowcode-3d/pull/12)–[#19](https://github.com/longyi-xw/lowcode-3d/pull/19))
  - [ ] Phase 3 打磨发布
    - [ ] 3.1 快捷键完整化（Delete / Cmd+D / F / Space / Esc + 帮助）
    - [ ] 3.2 项目模板系统（接 `examples/empty-project` + `examples/single-cube` 到 New 流程的 picker）
    - [ ] 3.3 错误处理 polish（全局 ErrorBoundary + IO toast + 未捕获 Promise 兜底）
    - [ ] 3.4 文档补完（本 PR）
    - [ ] 3.5 发布流程（CHANGELOG + tag v0.1.0 + GitHub Release）
```

- [ ] **步骤 4：写 v0.5 节（中等）**

```markdown
### v0.5 — Partially shipped ahead of schedule

- **Goals**: 行为系统（架构 §7 v0.5），让用户在不写代码的情况下为节点添加 "自动旋转 / 悬停高亮 / 点击触发动画" 等语义动作；行为既在编辑器 Play 模式可预览，也作为 `// behavior(<binding-id>)` 嵌入导出的运行时代码。
- **Target user**: 同 v0.1，重点是无代码定义运行时交互的设计师与原型师。
- **Success criteria**:
  - 至少 3 个内置 behavior 可用（当前仅 1 个 auto-rotate）
  - UI 能添加 / 编辑 / 删除 binding，所有改动可撤销
  - Play 模式按 binding 顺序 tick；Stop 恢复 transform
  - 导出代码（Vite / Standalone）内嵌 behaviors，外部可运行

- **Sub-stages**:
  - [x] v0.5 Stage A: framework + auto-rotate runtime + scene-codegen ([#20](https://github.com/longyi-xw/lowcode-3d/pull/20))
  - [x] v0.5 Stage B: UI Tab + 4 commands + Play/Pause toggle ([#21](https://github.com/longyi-xw/lowcode-3d/pull/21))
  - [ ] v0.5 Stage C: 多 behavior 补完（hover-highlight / click-trigger / event-emit 等）
```

- [ ] **步骤 5：写 v0.2 节（中等）**

```markdown
### v0.2 — Planned

- **Goals**: 资源库与材质编辑（架构 §7 v0.2）。内置基础几何 / 灯光 / HDRI 资源库 + 用户上传管理（取代当前 "拖 .glb 进视口" 单一入口）+ 属性面板加 PBR 材质参数（baseColor / metalness / roughness / emissive / normalMap）。
- **Target user**: 不想从头建几何或找模型的设计师；想精修 PBR 材质的开发者。
- **Success criteria**:
  - 资源库面板能浏览 / 搜索 / 拖入视口
  - 上传后的资源出现在库里且 save/open 后保留
  - 属性面板的材质参数能编辑 mesh 节点，撤销/重做有效
  - 导出代码包含正确的材质字段
- **Depends on**: v0.1 release（Phase 3 全部 5 个 sub-stage 完成）
```

- [ ] **步骤 6：写 v0.3 / v0.4 / v1.0 / v1.x 节（简略）**

```markdown
### v0.3 — Planned

- **Goals**: AI Skill 框架（架构 §4.3 + §7 v0.3）。Skill 接口 + Rust 端 AI proxy（防止 API key 漏到前端）+ 首个自然语言操作（"添加一盏从右上方照射的暖白色定向光"）。
- **Depends on**: v0.2 release

### v0.4 — Planned

- **Goals**: 空间吸附 / Socket 系统（架构 §7 v0.4）。节点之间几何关系约束求解，类似 Unity 的 Snap 或 Blender 的 Snap to。
- **Depends on**: v0.3 release

### v1.0 — Planned

- **Goals**: 多运行时适配器（架构 §7 v1.0）。Babylon.js 适配器实现，验证 `IRuntimeAdapter` 抽象在第二个引擎下能跑；同时落地 adapter conformance test 套件。
- **Depends on**: v0.5 行为系统全部完成（v0.5 Stage C）

### v1.x — Planned

- **Goals**: 更多运行时（react-three-fiber、Unity）。
- **Depends on**: v1.0 release
```

- [ ] **步骤 7：写 Tracking conventions 段**

```markdown
## Tracking conventions

- **Sub-stage 完成时**：在对应 release 的 sub-stages checkbox 勾选，行末加 PR 链接（`([#NN](...))`）。
- **Release tag 时**：把当前 release 节归档到 `CHANGELOG.md`，本文该节标记 `Released YYYY-MM-DD`。
- **命名重制**：只追加，不删除。引入新别名时在 [Naming reclamation](#naming-reclamation) 表加一行，旧名保留以便 git blame 检索。
- **更新节奏**：每个 sub-stage merge 时同步更新本文件（PR 内含 roadmap diff）；架构方向变化时同步 architecture.md 而非本文件。
```

- [ ] **步骤 8：本地校验**

```sh
pnpm prettier --check docs/roadmap.md
# 修复缩进 / 空行如有必要:
pnpm prettier --write docs/roadmap.md
```

预期：通过（或 write 后通过）。

人工抽查：

- [ ] 7 个 release 节都有
- [ ] v0.1 详细（含 5 个 Phase 3 sub-stage）
- [ ] v0.5 / v0.2 中等
- [ ] v0.3 / v0.4 / v1.0 / v1.x 简略
- [ ] Naming reclamation 表两行
- [ ] PR # 引用准确（#1, #11, #12, #19, #20, #21）

- [ ] **步骤 9：Commit**

```sh
git add docs/roadmap.md
git commit -m "docs(roadmap): add roadmap.md tracking architecture vs implementation

新增项目进度跟踪文档：

- Architecture vs implementation map (Phase 0-3 + v0.5 提前部分)
- Naming reclamation: '项目内 Phase 3 Stage A/B' → 'v0.5 Stage A/B'
  (PR title / commit message 保留原名, 文档以新名为准)
- Releases per granularity:
  - v0.1 详细 (含 Phase 3 sub-stage 3.1-3.5 checkbox)
  - v0.5 / v0.2 中等
  - v0.3 / v0.4 / v1.0 / v1.x 简略
- Tracking conventions

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 D2a：`docs/scene-graph-spec.md` 写实 · 头部 + §1-§3 + §7

**文件：**

- 重写：`docs/scene-graph-spec.md`

> 把当前 TBD 占位文件整段替换。先写"骨架 + 易写章节"（§1 Overview / §2 SceneProject / §3 SceneGraph & Node / §7 Settings），把文档跑起来；§4 / §5 / §6 / §8-§11 在 D2b / D2c 写。

**反推源：**

- `src/core/scene/schemas.ts` — zod schema
- `src/core/scene/types.ts` — TS 类型
- `examples/single-cube/project.json` — 扁平单文件 JSON 示例（§2 引用）
- `src/services/scene/demo-project.ts` — 默认节点结构

- [ ] **步骤 1：备份当前 TBD 文件 + 整段替换**

```sh
# 不需要单独备份, git 已有历史; 直接覆盖
```

写入文件内容（全段替换）。文档语言**英文**（spec §9.1）：

````markdown
# Scene Graph Specification

> **spec_version**: `0.1.0`
> **Status**: in sync with `src/core/scene/schemas.ts` as of 2026-05-29.
> **Relation to architecture**: `design/framework/architecture.md` §3 defines
> the high-level concepts; this file is the canonical schema authority for
> third-party adapter authors. When the two disagree, this file wins.

## 1. Overview

A **Scene Graph** is a technology-stack independent JSON description of a
3D scene. It is the on-disk format produced by the lowcode-3d editor and
consumed by any compliant runtime adapter (Three.js shipped; Babylon.js,
react-three-fiber, Unity planned).

Design tenets:

- **Tech-stack independent** — no engine-specific fields leak into the
  schema. Engine concerns live in adapter implementations (`docs/adapter-guide.md`).
- **Git-friendly** — every Node is its own file on disk; deterministic
  field ordering; quaternion / float arrays kept exact.
- **Forward-compatible** — every project carries a `spec_version`; unknown
  `behavior_type` / `node.type=custom` are preserved verbatim on load.
- **Validation up front** — zod schemas in `src/core/scene/schemas.ts` are
  the runtime source of truth; this document mirrors them.

A `SceneProject` is the top-level object. It contains a `SceneGraph` (the
node tree), an array of `AssetReference`s (deduplicated geometry/texture
references), and project-wide `settings`.

## 2. SceneProject (top-level)

### 2.1 Type

```ts
interface SceneProject {
  spec_version: "0.1.0";
  metadata: {
    id: string; // UUID v4
    name: string;
    created_at: string; // ISO 8601
    updated_at: string; // ISO 8601
    target_runtime: RuntimeTarget;
  };
  scene: SceneGraph;
  assets: AssetReference[];
  settings: {
    units: "meters" | "centimeters";
    up_axis: "y" | "z";
    background: ColorOrHDRI;
  };
}

type RuntimeTarget =
  | { kind: "three.js"; version: string; module_format: "esm" | "cjs" }
  | { kind: "babylon.js"; version: string } // reserved
  | { kind: "unity"; version: string; render_pipeline: "urp" | "hdrp" | "builtin" } // reserved
  | { kind: "react-three-fiber"; version: string }; // reserved

type ColorOrHDRI = { kind: "color"; hex: string } | { kind: "hdri"; asset_id: string };
```

> **Reserved targets** (babylon.js, unity, react-three-fiber): the schema
> accepts them, but no adapter currently implements them. The editor only
> lets the user create `three.js` projects in v0.1.

### 2.2 JSON example

A minimal single-cube project (from `examples/single-cube/project.json`,
trimmed for clarity):

```json
{
  "spec_version": "0.1.0",
  "metadata": {
    "id": "00000000-0000-4000-8000-000000000002",
    "name": "single-cube",
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-01T00:00:00.000Z",
    "target_runtime": {
      "kind": "three.js",
      "version": "0.164.0",
      "module_format": "esm"
    }
  },
  "scene": {
    "root_node_ids": ["cube-1"],
    "nodes": {
      "cube-1": {
        /* …Node… */
      }
    }
  },
  "assets": [],
  "settings": {
    "units": "meters",
    "up_axis": "y",
    "background": { "kind": "color", "hex": "#1f1f1f" }
  }
}
```

For the on-disk folder layout (multiple files), see §8 Serialization.

### 2.3 Field reference

| Field                                | Type                        | Required | Notes                                                      |
| ------------------------------------ | --------------------------- | -------- | ---------------------------------------------------------- |
| `spec_version`                       | string literal `"0.1.0"`    | yes      | Bump on breaking changes; see §9.                          |
| `metadata.id`                        | UUID v4                     | yes      | Stable identity across saves.                              |
| `metadata.name`                      | string                      | yes      | Derived from folder name; do not author manually.          |
| `metadata.created_at` / `updated_at` | ISO 8601                    | yes      | Editor refreshes `updated_at` on every mutation.           |
| `metadata.target_runtime`            | `RuntimeTarget`             | yes      | Chosen at project creation; immutable thereafter.          |
| `scene`                              | `SceneGraph`                | yes      | See §3.                                                    |
| `assets`                             | `AssetReference[]`          | yes      | Deduplicated by content hash; see §5.                      |
| `settings.units`                     | `"meters" \| "centimeters"` | yes      | Editor uses for grid spacing and gizmo labels.             |
| `settings.up_axis`                   | `"y" \| "z"`                | yes      | Three.js convention is `"y"`.                              |
| `settings.background`                | `ColorOrHDRI`               | yes      | Adapter renders this; falls back to opaque black if unset. |

## 3. SceneGraph & Node

### 3.1 SceneGraph

```ts
interface SceneGraph {
  root_node_ids: string[]; // top-level nodes (order matters for render layering)
  nodes: Record<string, Node>; // flat map, keyed by node.id for O(1) lookup
}
```

The graph is **flat-with-parent-pointers** in memory (and in the unsplit
JSON example), not a recursive tree. This is intentional: random-access
lookup by id is O(1) and parent/child mutations don't have to walk a
recursive structure. The on-disk format splits `nodes` further into per-id
files (§8) but the in-memory shape is the same.

### 3.2 Node

```ts
interface Node {
  id: string; // UUID v4, globally unique
  name: string; // user-visible label
  type: NodeKind;
  transform: Transform;
  parent_id: string | null; // null = root
  children_ids: string[]; // ordered
  visible: boolean;
  locked: boolean; // helpers are always locked regardless (§4.5)
  data: NodeData; // discriminated union; see §4
  behaviors: BehaviorBinding[]; // see §6
  user_data: Record<string, unknown>; // free-form (AI annotations, tags, etc.)
}

type NodeKind =
  | "group"
  | "mesh"
  | "light"
  | "camera"
  | "helper"
  | "prefab_instance"
  | "custom";
```

> **TS naming note**: in `src/core/scene/types.ts` the TS type is
> `SceneNode` (and `NodeKind` for the enum) to avoid clashing with the
> `lib.dom` `Node` global. **On-disk field names are unchanged** — the
> JSON still says `"type": "mesh"`, etc.

### 3.3 Transform

```ts
interface Transform {
  position: [number, number, number]; // local-space, parent-relative
  rotation: [number, number, number, number]; // quaternion [x, y, z, w]
  scale: [number, number, number];
}
```

**Quaternion convention**: `[x, y, z, w]` order. This matches glTF 2.0 and
Three.js. Editors that display Euler angles (e.g. the lowcode-3d
properties panel) convert at the UI boundary only; the on-disk format
stays quaternion to avoid gimbal-lock ambiguity.

Identity transform:

```json
{ "position": [0, 0, 0], "rotation": [0, 0, 0, 1], "scale": [1, 1, 1] }
```

## 7. Settings

```ts
interface Settings {
  units: "meters" | "centimeters";
  up_axis: "y" | "z";
  background: ColorOrHDRI;
}
```

- **`units`**: affects grid spacing, gizmo numeric labels, and exported
  scene scale. Default `"meters"`.
- **`up_axis`**: world up. Default `"y"` (Three.js / glTF convention).
  Adapters must honour this when computing camera framing.
- **`background`**: color (`{ "kind": "color", "hex": "#RRGGBB" }`) or
  HDRI (`{ "kind": "hdri", "asset_id": "<uuid>" }`). HDRI requires the
  referenced asset to exist in `assets[]` and be `kind: "hdri"`.

Sections §4 NodeData per kind, §5 AssetReference, §6 BehaviorBinding,
§8 Serialization, §9 Versioning, §10 Validation, §11 Reserved are populated
in subsequent commits within this PR.
````

- [ ] **步骤 2：本地校验**

```sh
pnpm prettier --check docs/scene-graph-spec.md
# or fix:
pnpm prettier --write docs/scene-graph-spec.md
```

人工抽查：

- [ ] §2.2 JSON 示例的字段与 `examples/single-cube/project.json` 一致
- [ ] §3.3 四元数顺序 `[x,y,z,w]` 与 `src/core/scene/schemas.ts` 一致
- [ ] §7 Settings 字段与现有 demo-project 默认值一致

- [ ] **步骤 3：Commit**

```sh
git add docs/scene-graph-spec.md
git commit -m "docs(spec): scene-graph-spec § 1-3, 7 (skeleton + easy sections)

Rewrites docs/scene-graph-spec.md from TBD placeholder to a real spec.
This commit lands the document skeleton plus the sections that are
self-contained:

- § 1 Overview (design tenets + reading guide)
- § 2 SceneProject top-level (TS interface + JSON example from
  examples/single-cube/project.json + field reference table)
- § 3 SceneGraph & Node (flat-with-parent-pointers rationale +
  Transform with [x,y,z,w] quaternion convention)
- § 7 Settings (units / up_axis / background)

Sections § 4 / § 5 / § 6 / § 8-§ 11 marked as 'populated in subsequent
commits within this PR' to keep the doc internally consistent during
the staged rollout.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 D2b：`docs/scene-graph-spec.md` §4 NodeData per kind

**文件：**

- 修改：`docs/scene-graph-spec.md`（追加 §4 之后）

**反推源：**

- `src/core/scene/schemas.ts` — per-kind data schema
- `src/runtime/three/node-builders/` — ThreeAdapter 支持矩阵
- `tests/fixtures/models/Untitled project.lowcode/scene/nodes/` — per-kind JSON 示例

- [ ] **步骤 1：在 §3 与 §7 之间插入 §4，写完整 7 子节**

每个子节包含：(a) discriminator + 字段表；(b) JSON 示例；(c) ThreeAdapter 支持矩阵（三列：Implemented / Codegen / Limitations）。

§4 整段：

````markdown
## 4. NodeData per kind

`Node.data` is a discriminated union keyed by `data.type`, which must
match the parent `Node.type`. Each `NodeKind` has its own schema; below
each subsection lists the schema, a JSON example, and the current
ThreeAdapter support matrix.

> **ThreeAdapter support matrix legend**: `Implemented` = builder exists
> in `src/runtime/three/node-builders/`; `Codegen` = exported by
> `scene-codegen.ts` to standalone code; `Limitations` = known current
> gaps with file pointer where applicable.

### 4.1 `group`

```ts
type GroupData = { type: "group" };
```

A pure organizational container. No render output; its `transform` still
affects descendants.

```json
{
  "id": "models-group",
  "name": "Models",
  "type": "group",
  "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0, 1], "scale": [1, 1, 1] },
  "parent_id": null,
  "children_ids": ["cube-1"],
  "visible": true,
  "locked": false,
  "data": { "type": "group" },
  "behaviors": [],
  "user_data": {}
}
```

| Implemented                 | Codegen | Limitations |
| --------------------------- | ------- | ----------- |
| ✅ `node-builders/group.ts` | ✅      | None        |

### 4.2 `mesh`

```ts
interface MeshData {
  type: "mesh";
  asset_id: string; // references AssetReference (geometry kind)
  material_overrides?: MaterialOverride[]; // reserved (v0.2)
}
```

Renders the referenced geometry asset. `material_overrides` is the v0.2
hook for per-instance PBR parameter overrides; current adapters ignore it.

```json
{
  "id": "cube-1",
  "name": "Cube",
  "type": "mesh",
  "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0, 1], "scale": [1, 1, 1] },
  "parent_id": null,
  "children_ids": [],
  "visible": true,
  "locked": false,
  "data": { "type": "mesh", "asset_id": "asset-builtin-cube" },
  "behaviors": [],
  "user_data": {}
}
```

| Implemented                | Codegen | Limitations                              |
| -------------------------- | ------- | ---------------------------------------- |
| ✅ `node-builders/mesh.ts` | ✅      | `material_overrides` ignored (v0.2 work) |

### 4.3 `light`

```ts
interface LightData {
  type: "light";
  light_kind: "directional" | "point" | "spot" | "ambient";
  color: string; // #RRGGBB
  intensity: number; // engine-specific units; ThreeAdapter uses three.js Light intensity
  range?: number; // point / spot only
  angle?: number; // spot only, radians
  penumbra?: number; // spot only, 0..1
}
```

| Implemented                               | Codegen | Limitations                 |
| ----------------------------------------- | ------- | --------------------------- |
| ✅ `node-builders/light.ts` (all 4 kinds) | ✅      | Shadow maps not yet exposed |

### 4.4 `camera`

```ts
interface CameraData {
  type: "camera";
  camera_kind: "perspective" | "orthographic";
  fov?: number; // perspective, degrees
  zoom?: number; // orthographic
  near: number;
  far: number;
}
```

| Implemented                               | Codegen | Limitations                                                                              |
| ----------------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| ✅ `node-builders/camera.ts` (both kinds) | ✅      | Editor camera is separate; scene cameras are placeable but not yet switchable at runtime |

### 4.5 `helper`

```ts
interface HelperData {
  type: "helper";
  helper_kind: string; // current: "grid" | "axes"
}
```

Editor-only visual aids. **Helpers are always raycast-unpickable and
always `effectively locked`**, regardless of the `Node.locked` field —
see `src/core/scene/policy.ts` `isEffectivelyLocked()`. Helpers are not
emitted by `scene-codegen.ts`.

| Implemented                                   | Codegen          | Limitations                          |
| --------------------------------------------- | ---------------- | ------------------------------------ |
| ✅ `node-builders/helper.ts` (`grid`, `axes`) | ❌ (editor-only) | Custom helpers not supported in v0.1 |

### 4.6 `prefab_instance`

```ts
interface PrefabInstanceData {
  type: "prefab_instance";
  asset_id: string; // references an AssetReference with kind="geometry" (.glb)
}
```

A leaf node in the SceneGraph that materialises a cached `.glb` subtree
at runtime. The geometry subtree itself is **not** part of the
SceneGraph — only the reference and the instance transform are. The
ThreeAdapter holds a per-instance clone of the cached template
(`AssetCache`, shared geometry & materials). See
`docs/adapter-guide.md` §4.6 for the runtime cache model.

```json
{
  "id": "boombox-instance",
  "name": "BoomBox",
  "type": "prefab_instance",
  "transform": { "position": [0, 1, 0], "rotation": [0, 0, 0, 1], "scale": [1, 1, 1] },
  "parent_id": null,
  "children_ids": [],
  "visible": true,
  "locked": false,
  "data": { "type": "prefab_instance", "asset_id": "asset-boombox-sha256" },
  "behaviors": [],
  "user_data": {}
}
```

| Implemented                           | Codegen | Limitations                                                                  |
| ------------------------------------- | ------- | ---------------------------------------------------------------------------- |
| ✅ `node-builders/prefab-instance.ts` | ✅      | No per-instance material overrides yet; no Unpack Prefab command (Prefab v2) |

### 4.7 `custom`

```ts
interface CustomData {
  type: "custom";
  custom_type: string; // adapter-specific identifier
  payload: unknown; // schema is the adapter's responsibility
}
```

Extension point for adapter-specific nodes the schema doesn't model.
Editors should round-trip `custom` nodes verbatim. Adapters that don't
recognise a `custom_type` should fall back to an empty group with a
warning, not throw.

| Implemented                                            | Codegen | Limitations                                                                 |
| ------------------------------------------------------ | ------- | --------------------------------------------------------------------------- |
| 🟡 Round-trip preserved; ThreeAdapter throws on render | 🟡      | No `custom` node type registered in v0.1; reserved for third-party adapters |
````

- [ ] **步骤 2：本地校验 + Commit**

```sh
pnpm prettier --write docs/scene-graph-spec.md
git add docs/scene-graph-spec.md
git commit -m "docs(spec): scene-graph-spec § 4 NodeData per kind

All 7 NodeKind subsections with TS interface, JSON example, and
ThreeAdapter support matrix (Implemented / Codegen / Limitations):

- § 4.1 group
- § 4.2 mesh (material_overrides reserved for v0.2)
- § 4.3 light (4 kinds)
- § 4.4 camera (perspective / orthographic)
- § 4.5 helper (grid / axes; effectively locked + unpickable convention)
- § 4.6 prefab_instance (cached .glb subtree; AssetCache cross-ref to
  adapter-guide § 4.6)
- § 4.7 custom (round-trip preserved; render falls back per adapter)

Reverse-engineered from src/core/scene/schemas.ts +
src/runtime/three/node-builders/.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 D2c：`docs/scene-graph-spec.md` §5 §6 §8 §9 §10 §11

**文件：**

- 修改：`docs/scene-graph-spec.md`（追加剩余章节）

**反推源：**

- `src/core/scene/schemas.ts` — Asset/Behavior schema
- `src/core/scene/persistence.ts` — 序列化布局
- `src/runtime/three/behaviors/auto-rotate.ts` — auto-rotate 参数 schema
- `src-tauri/src/...` — content-hash + hardlink 行为（PR #17 描述）

- [ ] **步骤 1：在 §4 与 §7 之间插入 §5、§6；在 §7 之后追加 §8-§11**

§5 AssetReference：

````markdown
## 5. AssetReference

```ts
interface AssetReference {
  id: string; // UUID v4
  content_hash: string; // sha256 of the file bytes (hex, lowercase)
  kind: "geometry" | "texture" | "hdri" | "audio" | "video";
  relative_path: string; // "assets/{content_hash}.{ext}", relative to project root
  tags: string[];
  description: string;
  source: AssetSource;
}

type AssetSource =
  | { kind: "builtin"; library_id: string }
  | { kind: "user_upload"; original_filename: string }
  | { kind: "online"; provider: string; url: string; license: string }
  | { kind: "ai_generated"; model: string; prompt: string };
```

**Content-addressed storage**: the bytes for every asset live at
`{project}/assets/{content_hash}.{ext}`. The hash is computed Rust-side
during import (`src-tauri/`) and is the source of identity — re-importing
identical bytes returns the existing `AssetReference` (no duplication).
Cross-save persistence uses **hardlinks** (with byte-copy fallback) so
the atomic-swap save flow doesn't orphan assets.

**Original filename** is preserved in
`source.original_filename` for `user_upload` so the editor can render a
human-readable label even though the on-disk file is hash-named.

The runtime `AssetCache` (a per-`ThreeAdapter` in-memory `Map<asset_id, THREE.Group>`)
is not part of the spec — it belongs to adapter implementation, covered
in `docs/adapter-guide.md` §4.6.
````

§6 BehaviorBinding：

````markdown
## 6. BehaviorBinding

```ts
interface BehaviorBinding {
  id: string; // UUID v4, unique within the node
  behavior_type: string; // e.g. "auto-rotate"
  enabled: boolean;
  parameters: Record<string, unknown>; // schema is per behavior_type
}
```

Behaviors are **semantic actions** that cross technology stacks. The
spec only describes the binding shape; the parameter schema is owned by
each `behavior_type`. Adapters implement (and emit code for) each
behavior they support. Unknown `behavior_type`s on load are preserved
verbatim and marked unknown at runtime — they are not dropped.

### 6.1 Built-in behaviors (v0.1)

| `behavior_type` | Parameters                                                    | Description                                                                                    |
| --------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `auto-rotate`   | `{ axis: "x" \| "y" \| "z"; speed: number }` (speed in deg/s) | Rotates the node around a local axis at the given speed during Play mode and in exported code. |

#### `auto-rotate` example

```json
{
  "id": "b1",
  "behavior_type": "auto-rotate",
  "enabled": true,
  "parameters": { "axis": "y", "speed": 30 }
}
```

### 6.2 Adapter responsibilities

For each supported `behavior_type`, an adapter must:

1. Register a `Behavior` class with the adapter's `behaviorRegistry`
2. Implement `install(node, params)` → `tick(handle, dt)` → `uninstall(handle)`
3. Provide `generateCode(binding, ctx)` for the codegen pipeline (so
   exported projects re-run the behavior in the standalone runtime)

See `docs/adapter-guide.md` §5 for the full Behavior class contract.

### 6.3 Forward-compat: unknown behaviors

When loading a project, the editor preserves any `behavior_type` it
doesn't recognise. The runtime marks the binding with `__unknown: true`
and skips its `install`/`tick`/`generateCode` calls. Save round-trips
without loss; the binding becomes active again if a future adapter ships
support.
````

§8 Serialization：

````markdown
## 8. Serialization (on-disk)

A SceneProject is stored as a **folder**, not a single file. This makes
git diffs minimal when only one node changes.

### 8.1 Folder layout

```
my-project.lowcode/
├── project.json                 # SceneProject minus scene.nodes (kept in scene/)
├── scene/
│   ├── hierarchy.json           # parent/child pointer table; rebuilds nodes graph
│   └── nodes/
│       ├── cube-1.json          # one file per node, named by Node.id
│       └── …
├── assets/
│   ├── {content_hash}.glb       # one file per asset, content-addressed
│   └── …
└── .lowcode/                    # local-only caches (thumbnails, indexes); gitignored
```

### 8.2 `project.json` (without nodes)

The top-level `SceneProject` with `scene.nodes` **removed**. The
`scene.root_node_ids` field stays in `project.json`; the actual node
objects live in per-id files in `scene/nodes/`. Example:

```json
{
  "spec_version": "0.1.0",
  "metadata": { "id": "…", "name": "single-cube", "...": "..." },
  "scene": { "root_node_ids": ["cube-1"] },
  "assets": [],
  "settings": { "...": "..." }
}
```

### 8.3 `scene/hierarchy.json`

A flat parent → children pointer table, used to rebuild
`Node.parent_id` / `Node.children_ids` on load without having to read
every node file twice:

```json
{
  "root_node_ids": ["cube-1"],
  "edges": {
    "cube-1": { "parent_id": null, "children_ids": [] }
  }
}
```

### 8.4 `scene/nodes/{id}.json`

One file per node. The file is the `Node` object **with
`parent_id` and `children_ids` removed** — those are owned by
`hierarchy.json` to keep node-level diffs tiny when only the position
or material changes (a move shouldn't dirty the whole subtree's files).

### 8.5 Folder naming

Saving to `foo.lowcode/` (or `foo.project/`) implies project
`metadata.name = "foo"`. The editor strips the `.lowcode` / `.project`
suffix on save / open and refuses to author a different `metadata.name`
than the basename.

### 8.6 `.lowcode/` local caches

Editor-side thumbnails and indexes live under `.lowcode/`. Project
authors should `.gitignore` this folder — it's local-only and
regenerable.

### 8.7 Atomic save

The save flow writes a sibling `.{stem}.lowcode-tmp-{ts}/` directory,
then renames it onto the target. If a previous version exists it is
moved to `.{stem}.lowcode-bak-{ts}/` for rollback. Assets are preserved
across the swap by per-file hardlink (byte-copy fallback). Implementation
in `src-tauri/`.
````

§9 Versioning：

```markdown
## 9. Versioning & Migration

The `spec_version` is **semver-shaped** but its bumps follow these rules:

- **Patch bump (0.1.x)**: clarifications, new optional fields, new
  enum members (additive). Loaders for an older patch must accept newer
  patch files (forward-compat for additions).
- **Minor bump (0.x.0)**: breaking field renames, removed enum members,
  format changes that require migration. A migration function in
  `src/core/migrations/{from}-to-{to}.ts` must exist before merge.
- **Major bump (x.0.0)**: incompatible scope changes (e.g. a new
  on-disk container format). Reserved for v1.0.

Loading flow:

1. Parse `project.json`
2. Read `spec_version`
3. If `spec_version` < current, run all chained migrations in
   `src/core/migrations/`
4. Validate against the current zod schema (§10)

No migration is needed for v0.1.0 → v0.1.0; this section is the contract
for v0.2+ work.
```

§10 Validation：

```markdown
## 10. Validation

Runtime source of truth: `src/core/scene/schemas.ts` (zod schemas).

| Schema                  | Validates                                                        |
| ----------------------- | ---------------------------------------------------------------- |
| `SceneProjectSchema`    | top-level + metadata + settings                                  |
| `SceneGraphSchema`      | nodes graph + root_node_ids                                      |
| `SceneNodeSchema`       | individual Node (after `hierarchy.json` reattachment)            |
| `BehaviorBindingSchema` | each binding's `id` / `behavior_type` / `enabled` / `parameters` |
| `AssetReferenceSchema`  | per-asset entry                                                  |

Editors should validate on every save (refuse to write if the project
doesn't round-trip) and on every load (refuse to open if the file is
malformed). The loader returns a typed `PersistenceError` discriminated
by `missing_file` / `json_syntax` / `hierarchy` / `schema` so the UI can
surface actionable error messages.
```

§11 Reserved & Future：

```markdown
## 11. Reserved & Future

The schema accepts but currently does nothing with:

- `RuntimeTarget` kinds other than `three.js` (`babylon.js`, `unity`,
  `react-three-fiber` — v1.0+ work).
- `MeshData.material_overrides` (v0.2 — PBR material editor).
- `BehaviorBinding.behavior_type` values beyond the v0.1 built-ins —
  preserved round-trip (§6.3) and ready for v0.5 Stage C (hover-highlight,
  click-trigger, event-emit, etc.).
- `Node.user_data` — AI-annotation freezone; the editor does not
  introspect.

Anticipated v0.2+ fields:

- `MaterialOverride` schema (PBR parameters per instance)
- `CameraData.aperture` / `focus_distance` (depth of field)
- `Settings.shadow_quality` / `Settings.tone_mapping`

When these land, `spec_version` bumps per §9 and the section moves out
of Reserved.
```

- [ ] **步骤 2：移除文档末尾的"populated in subsequent commits"占位说明**

定位文件中 §7 末尾的 "Sections §4 / §5 / §6 / §8-§11 are populated in subsequent commits…" 整段，删除。

- [ ] **步骤 3：本地校验**

```sh
pnpm prettier --write docs/scene-graph-spec.md
```

人工抽查：

- [ ] 11 章都有
- [ ] §5.1 content-hash + hardlink 描述对应 PR #17 设计
- [ ] §6.1 auto-rotate 参数 schema 与 `src/runtime/three/behaviors/auto-rotate.ts` 一致
- [ ] §8.4 per-node 文件省略 `parent_id` / `children_ids` 与 `tests/fixtures/models/Untitled project.lowcode/scene/nodes/*.json` 一致
- [ ] 没有 "populated in subsequent commits" 占位残留

- [ ] **步骤 4：Commit**

```sh
git add docs/scene-graph-spec.md
git commit -m "docs(spec): scene-graph-spec § 5, 6, 8-11 (asset/behavior/serialize/version/validate)

Finishes scene-graph-spec.md:

- § 5 AssetReference (content-addressed, hardlink persistence; cross-ref
  to adapter-guide § 4.6 for AssetCache)
- § 6 BehaviorBinding (built-in registry: auto-rotate; adapter contract;
  forward-compat for unknown types)
- § 8 Serialization (project.json + scene/hierarchy.json +
  scene/nodes/{id}.json + assets/{hash}.ext folder layout; per-node
  parent/children removal convention)
- § 9 Versioning rules (patch/minor/major bump semantics; migration
  chain in src/core/migrations/)
- § 10 Validation (zod schema authority; PersistenceError shape)
- § 11 Reserved & Future (babylon/unity targets, material_overrides,
  Stage C behaviors)

Drops the 'populated in subsequent commits' placeholder from § 7.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 D3a：`docs/adapter-guide.md` 写实 · 头部 + §1-§3

**文件：**

- 重写：`docs/adapter-guide.md`

**反推源：**

- `src/runtime/adapter.ts` — IRuntimeAdapter 接口
- `src/runtime/three/adapter.ts` — ThreeAdapter 实现
- `src/ui/viewport/ThreeViewport.tsx` — 集成点

- [ ] **步骤 1：整段替换 TBD 文件，写头部 + §1-§3**

```markdown
# Runtime Adapter Authoring Guide

> **Status**: in sync with `src/runtime/three/adapter.ts` as of 2026-05-29.
> **Relation to other docs**:
>
> - `design/framework/architecture.md` §4.1 introduces the concept at a
>   high level.
> - `docs/scene-graph-spec.md` is the data format authority — this guide
>   does not redefine fields, only describes the engine mapping.
> - When this guide and architecture.md disagree on interface details,
>   this guide wins.

## 1. What is a runtime adapter

A **runtime adapter** is the bridge between the technology-independent
Scene Graph (`docs/scene-graph-spec.md`) and a concrete rendering /
game engine (Three.js shipped; Babylon.js, react-three-fiber, Unity
planned). It is the only place engine-specific knowledge lives.

Conceptually:
```

[SceneGraph (tech-neutral JSON)]
│
▼
IRuntimeAdapter.syncNode("add"/"update"/"remove")
│
▼
[THREE.Scene / Babylon.Scene / …]

````

The five-layer architecture places adapters in `src/runtime/`, depending
**only** on `src/core/` (Scene Graph types + Command interface) — never
on `src/editor/`, `src/services/`, or `src/ui/`. This keeps adapters
embeddable from non-editor contexts (e.g. a CLI export pipeline) and
prevents UI churn from rippling into the runtime.

The MVP ships **only the Three.js adapter** (`src/runtime/three/`).
`RuntimeTarget.kind` values other than `"three.js"` are reserved in the
spec but have no adapter implementation in v0.1.

## 2. The `IRuntimeAdapter` interface

```ts
interface IRuntimeAdapter {
  readonly target: RuntimeTarget;

  // ── lifecycle ──
  mount(container: HTMLElement): void;
  unmount(): void;
  setViewportSize(width: number, height: number): void;

  // ── scene sync (incremental) ──
  syncNode(node: SceneNode, op: "add" | "update" | "remove"): void;
  syncAsset(asset: AssetReference): Promise<void>;
  getRuntimeObject(node_id: string): unknown;

  // ── picking ──
  pickAt(screen_x: number, screen_y: number): string | null;

  // ── behaviors (added in v0.5 Stage A) ──
  installBehaviors(node: SceneNode): void;
  tickBehaviors(dt: number): void;
  uninstallBehaviors(node: SceneNode): void;

  // ── export ──
  getSupportedBehaviors(): BehaviorDefinition[];
  generateBehaviorCode(binding: BehaviorBinding, ctx: CodegenContext): string;
  exportProject(project: SceneProject, options: ExportOptions): Promise<ExportResult>;
}
````

### 2.1 Method contracts

| Method                               | Inputs                                           | Outputs / side effects                                                   | Errors                                                        |
| ------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `mount(container)`                   | A DOM element to render into                     | Creates renderer + scene + camera + controls; attaches `<canvas>`        | Throws if already mounted                                     |
| `unmount()`                          | —                                                | Disposes WebGL / engine resources; detaches DOM                          | Idempotent                                                    |
| `setViewportSize(w, h)`              | CSS pixel dimensions                             | Updates camera aspect + renderer drawing buffer                          | —                                                             |
| `syncNode(node, op)`                 | One Scene Graph Node + an op                     | Adds / updates / removes the engine object; preserves selection refs     | Throws on unknown `NodeKind` (custom builders may extend)     |
| `syncAsset(asset)`                   | One AssetReference                               | Loads bytes (or pulls from cache); stores in adapter's asset cache       | Rejects on IO or parse error                                  |
| `getRuntimeObject(id)`               | Node id                                          | The engine-specific object (e.g. `THREE.Object3D`) or `null`             | —                                                             |
| `pickAt(x, y)`                       | CSS pixel coords                                 | Hit node id or `null`                                                    | —                                                             |
| `installBehaviors(node)`             | A node with `behaviors[]`                        | Creates per-binding `BehaviorHandle`; stores against `node.id`           | Per-binding throws are isolated; surviving bindings still run |
| `tickBehaviors(dt)`                  | Seconds since last tick                          | Calls `behavior.tick(handle, dt)` for every enabled binding              | Per-binding throws are isolated                               |
| `uninstallBehaviors(node)`           | A node                                           | Disposes handles for that node and restores its transform                | Idempotent                                                    |
| `getSupportedBehaviors()`            | —                                                | List of `BehaviorDefinition` (type id + parameter schema + display name) | —                                                             |
| `generateBehaviorCode(binding, ctx)` | One binding + codegen context (imports, helpers) | JS source string to splice into exported `main.js`                       | Throws on unknown `behavior_type`                             |
| `exportProject(project, options)`    | Whole project + target options                   | `Map<path, ExportFile>` + warnings                                       | Throws on IO; `target` mismatch is a validation error         |

### 2.2 The behavior trio is recent (v0.5 Stage A)

`installBehaviors` / `tickBehaviors` / `uninstallBehaviors` were added
in PR #20. Earlier adapter drafts did not have them; they replace what
was previously a pure imperative "set object3D.rotation each tick" loop
inside the viewport. The Stage A design ensures the same `Behavior`
instance is used by editor preview and by codegen — see §5.

## 3. Lifecycle

A typical session goes:

1. **Mount** — `adapter.mount(canvasContainer)` once per editor session.
2. **Initial sync** — for each existing node, `adapter.syncNode(node, "add")`; for each asset, `await adapter.syncAsset(asset)`.
3. **Edit loop** — Scene Graph mutations (gizmo, command-history,
   property panel) trigger `adapter.syncNode(node, "update" | "remove" | "add")` via the diff-and-apply layer.
4. **Pick** — viewport click → `adapter.pickAt(x, y)` → set selection.
5. **Play** — when `useUIStore.playState` transitions to `"play"`:
   `adapter.installBehaviors(node)` for every node, then `requestAnimationFrame` calls `adapter.tickBehaviors(dt)` until Pause.
6. **Export** — `adapter.exportProject(project, options)` produces a
   `Map<path, ExportFile>`; the host writes the files via Rust.
7. **Unmount** — `adapter.unmount()` when the editor closes the project.

**Asset preloading**: assets must be `syncAsset`'d **before** any node
that references them is `syncNode("add")`'d. The `seedScene` and
`diffAndApply` helpers in `src/ui/viewport/ThreeViewport.tsx` enforce
this order; the prefab_instance builder's placeholder (magenta cube)
exists only for the race where a load fails or runs concurrently.

````

- [ ] **步骤 2：本地校验 + Commit**

```sh
pnpm prettier --write docs/adapter-guide.md
git add docs/adapter-guide.md
git commit -m "docs(adapter-guide): § 1-3 (concept + interface + lifecycle)

Rewrites docs/adapter-guide.md from TBD placeholder. This commit lands:

- § 1 What is a runtime adapter (concept + five-layer placement)
- § 2 IRuntimeAdapter interface (complete signature with the v0.5
  Stage A behavior trio + per-method contract table)
- § 3 Lifecycle (mount → sync → pick → play → export → unmount +
  asset preload ordering rule)

Sections § 4-§ 10 land in the next commits.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
````

---

## 任务 D3b：`docs/adapter-guide.md` §4 §5 §6

**文件：**

- 修改：`docs/adapter-guide.md`（追加 §4 §5 §6）

**反推源：**

- `src/runtime/three/node-builders/` — 各 NodeKind 的 builder
- `src/runtime/three/behaviors/` — Behavior framework
- `src/runtime/three/export/` — Exporter + scene-codegen

- [ ] **步骤 1：在 §3 之后追加 §4 §5 §6**

§4 Mapping Node kinds：

````markdown
## 4. Mapping Node kinds to engine objects

Adapters dispatch on `Node.type` via a `BuilderRegistry`:

```ts
interface BuilderRegistry {
  buildObject(registry: BuilderRegistry, node: SceneNode): EngineObject;
  updateObject(registry: BuilderRegistry, object: EngineObject, node: SceneNode): void;
}
```
````

The registry is **created per adapter instance** (so stateful builders
like `prefab_instance` can close over the adapter's `AssetCache`). The
ThreeAdapter's registry lives in
`src/runtime/three/node-builders/index.ts`; stateless per-kind builders
(`group.ts`, `mesh.ts`, `light.ts`, `camera.ts`, `helper.ts`) are
shared singletons.

### 4.1 group → `THREE.Group`

Pure container. The builder reads `Node.transform` + `visible` and
applies them to a `THREE.Group`.

### 4.2 mesh → `THREE.Mesh`

Reads `data.asset_id`, resolves the geometry from `AssetCache`, applies
a default `MeshStandardMaterial`. The `material_overrides` field is
spec-reserved; current adapter ignores it.

### 4.3 light → `THREE.{Directional|Point|Spot|Ambient}Light`

Maps `data.light_kind` to the corresponding Three.js light. `intensity`
passes through unchanged.

### 4.4 camera → `THREE.{Perspective|Orthographic}Camera`

Maps `data.camera_kind`. Scene cameras are placeable but do **not**
become the active editor camera — the editor uses its own OrbitControls
camera. Switching at export time is v0.2 work.

### 4.5 helper → `THREE.GridHelper` / `THREE.AxesHelper`

**Helpers override `raycast()` to a no-op on the whole subtree** so
`pickAt` never selects a grid line. They are **`effectivelyLocked`**
(see `src/core/scene/policy.ts`) regardless of `Node.locked`, and they
are **not emitted** by codegen.

### 4.6 prefab_instance → cached `THREE.Group` clone

The `.glb` template is loaded once into `AssetCache` (a
per-`ThreeAdapter` `Map<asset_id, THREE.Group>`). Each
`prefab_instance` node gets a `Group.clone(false)` whose geometry and
materials are shared with the template — 50 instances = 50 leaf nodes +
1 template (Unity/PlayCanvas Prefab model).

**Always `syncAsset` before `syncNode("add")` for a prefab_instance.**
A magenta placeholder cube is rendered if the cache lookup misses (race
or load failure).

### 4.7 custom

The default builder throws on `data.type === "custom"`. Adapters that
support custom nodes should subclass the registry and resolve via
`data.custom_type`. Spec round-trip (preserve on load + save) is still
required even for unrecognised custom types.

### 4.8 Pickability and locking

Two cross-cutting policies in `src/core/scene/policy.ts` must be
honoured by every adapter:

- **`isEffectivelyLocked(node)`** returns true for helpers regardless of
  `node.locked`; the editor uses this to skip gizmo attach and grey out
  property inputs.
- **Raycast skipping** for helper subtrees (see §4.5).

Adapters with their own picking strategy (e.g. engine-side hit testing)
must apply the same skip rules.

````

§5 Mapping Behaviors：

```markdown
## 5. Mapping Behaviors

### 5.1 The `Behavior` class

```ts
interface Behavior<TParams = unknown, THandle = BehaviorHandle> {
  readonly type: string;                      // e.g. "auto-rotate"
  readonly definition: BehaviorDefinition;    // type + parameter schema + display name

  install(node: SceneNode, params: TParams, ctx: InstallContext): THandle;
  tick(handle: THandle, dt: number): void;
  uninstall(handle: THandle, ctx: InstallContext): void;

  generateCode(binding: BehaviorBinding, ctx: CodegenContext): string;
}

interface BehaviorHandle {
  node_id: string;
  binding_id: string;
}
````

### 5.2 Registry

Adapters expose a `behaviorRegistry` (`Map<behavior_type, Behavior>`).
The ThreeAdapter's registry is in
`src/runtime/three/behaviors/registry.ts`. Registering a new behavior
is a single line in that file plus the implementation module.

### 5.3 The codegen ↔ runtime sharing rule

The same `Behavior` instance powers both:

1. **Editor Play mode**: `adapter.installBehaviors(node)` → per-binding
   `handle = behavior.install(...)`; `tickBehaviors(dt)` →
   `behavior.tick(handle, dt)`.
2. **Exported code**: `adapter.generateBehaviorCode(binding, ctx)` →
   `behavior.generateCode(binding, ctx)` returns a JS source string
   that the codegen pipeline emits.

This invariant is what guarantees the exported code behaves like the
editor preview (modulo the Live/Export Behavior class contract). Don't
fork the implementation.

### 5.4 Per-binding error isolation

If `install` / `tick` / `uninstall` throws for one binding, the adapter
must **not** abort the others. The current implementation in
`src/runtime/three/adapter.ts` wraps each call in try/catch and logs;
the test `src/runtime/three/adapter.test.ts` "tick errors on one
binding don't break others" placeholder reserves real coverage for when
a second stateful behavior lands.

### 5.5 The auto-rotate example

Reference implementation: `src/runtime/three/behaviors/auto-rotate.ts`.
Parameters:

```ts
{
  axis: "x" | "y" | "z";
  speed: number; /* deg/s */
}
```

- `install`: stores the original local rotation + axis vector in the
  handle.
- `tick(handle, dt)`: rotates `getRuntimeObject(node_id)` by
  `speed * dt` degrees around the local axis.
- `uninstall(handle)`: restores the original local rotation (so Stop
  doesn't leak rotation into edit mode).
- `generateCode(binding, ctx)`: emits a JS snippet that does the same
  rotation in the exported runtime loop.

````

§6 Code export：

```markdown
## 6. Code export

```ts
interface Exporter {
  readonly target: ExportTarget;
  emit(project: SceneProject, ctx: ExportContext): Promise<ExportResult>;
}

interface ExportResult {
  files: Map<string, ExportFile>;
  warnings: string[];
}

type ExportFile =
  | { kind: "text"; content: string }
  | { kind: "asset_copy"; source_relative_path: string };

type ExportTarget = "vite" | "standalone-esm";
````

### 6.1 Text vs asset_copy

Text files (`main.js`, `index.html`, `package.json`) carry their
content inline as a string. Binary files (.glb assets) are **references**
(`asset_copy` with a path relative to the source project) — the Rust
side resolves and hardlinks them onto the destination, avoiding a
round-trip of multi-megabyte bytes through JavaScript.

### 6.2 Built-in `Exporter`s

| Target             | Output                                                                                    | Use case                                                  |
| ------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `"vite"`           | A Vite project (`package.json`, `vite.config.js`, `src/main.js`, `index.html`, `assets/`) | Production-ready, importable into existing Vite codebases |
| `"standalone-esm"` | One `index.html` + `main.js` + `assets/` (importmap → esm.sh for three.js + controls)     | Drop-in viewer, runs from `python -m http.server`         |

Both targets emit the **same `main.js`** (plain JS with JSDoc, no TS
syntax — `scene-codegen.ts` asserts this). Adding a new target is one
entry in `EXPORTERS` (`src/runtime/three/adapter.ts`) plus one
`Exporter` implementation.

### 6.3 What is and isn't emitted

**Emitted**:

- All non-helper nodes (mesh, light, camera, group, prefab_instance, custom-if-supported)
- `OrbitControls` (unconditional — without it the export feels like a static image)
- A low-intensity (`0.3`) fallback `AmbientLight` if no authored lights exist
- All registered behaviors (`generateBehaviorCode` is invoked for every
  enabled binding); the codegen wires a `requestAnimationFrame` loop
  that calls each behavior's tick

**Not emitted**:

- Helpers (grid, axes) — editor-only
- `TransformControls` (selection gizmo) — editor-only
- Post-processing (OutlinePass) — editor-only

### 6.4 The Rust write side

`write_export_files` (in `src-tauri/`) follows the same atomic
tmp-rename + backup pattern as `save_project_folder`, plus it
**refuses to export inside the source project** via `is_inside()`
(canonicalises both paths to defeat macOS `/tmp` ↔ `/private/tmp`).
Adapters don't have to know about this — they just return the
`ExportResult`; the host wires the rest.

````

- [ ] **步骤 2：本地校验 + Commit**

```sh
pnpm prettier --write docs/adapter-guide.md
git add docs/adapter-guide.md
git commit -m "docs(adapter-guide): § 4-6 (node kinds + behaviors + export)

- § 4 Mapping Node kinds (BuilderRegistry + 7 per-kind subsections +
  pickability/locking cross-cuts)
- § 5 Mapping Behaviors (Behavior class contract + registry +
  codegen↔runtime sharing rule + per-binding error isolation +
  auto-rotate reference)
- § 6 Code export (Exporter interface + text/asset_copy split +
  built-in vite/standalone targets + emit/skip matrix + Rust
  atomic write integration)

Cross-refs scene-graph-spec.md § 5/§ 6/§ 4.6 where applicable.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
````

---

## 任务 D3c：`docs/adapter-guide.md` §7 §8 §9 §10

**文件：**

- 修改：`docs/adapter-guide.md`（追加剩余章节）

- [ ] **步骤 1：追加 §7 Writing your own adapter (Babylon walk-through) + §8-§10**

§7：

````markdown
## 7. Writing your own adapter — step by step

> Hypothetical code below targets **Babylon.js 8.x** API as of 2026-05.
> It illustrates the wiring; it is not compiled or tested against a
> real Babylon installation. Use it as a structural reference, not as
> copy-paste working code.

We build a fictitious `BabylonAdapter` from scratch. The final layout
is `src/runtime/babylon/` (currently a reserved empty folder).

### 7.1 Step 1 — `mount` + empty `syncNode`

```ts
// src/runtime/babylon/adapter.ts
import { Engine, Scene, FreeCamera, Vector3, ArcRotateCamera } from "@babylonjs/core";
import type { IRuntimeAdapter } from "@/runtime/adapter";

export class BabylonAdapter implements IRuntimeAdapter {
  readonly target = { kind: "babylon.js", version: "8.0.0" } as const;
  private engine?: Engine;
  private scene?: Scene;

  mount(container: HTMLElement) {
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "display:block;width:100%;height:100%;";
    container.appendChild(canvas);
    this.engine = new Engine(canvas, true);
    this.scene = new Scene(this.engine);
    new ArcRotateCamera(
      "editor-cam",
      -Math.PI / 2,
      Math.PI / 3,
      5,
      Vector3.Zero(),
      this.scene,
    );
    this.engine.runRenderLoop(() => this.scene!.render());
  }

  syncNode(_node: SceneNode, _op: "add" | "update" | "remove") {
    /* TODO */
  }
  // … other stubs throwing NotImplementedYet
}
```

**Acceptance for Step 1**: opening an empty project shows a Babylon
canvas with an `ArcRotateCamera`. Verify with a vitest+jsdom test that
asserts `mount(container)` appends a `<canvas>` and creates an `Engine`.

### 7.2 Step 2 — per-kind builders

Pattern: a `BuilderRegistry` analogous to the Three.js one.

```ts
// src/runtime/babylon/node-builders/index.ts
import type { SceneNode } from "@/core/scene/types";
import { buildMesh } from "./mesh";
import { buildLight } from "./light";
// …

export function buildObject(scene: Scene, node: SceneNode) {
  switch (node.type) {
    case "mesh":
      return buildMesh(scene, node);
    case "light":
      return buildLight(scene, node);
    /* … */
  }
}
```

Each per-kind file owns the mapping. For `mesh` you'd resolve the
geometry from `AssetCache` (Step 4 below) and create a Babylon
`AbstractMesh`. **Acceptance**: a project with one mesh + one light
renders in the Babylon canvas.

### 7.3 Step 3 — `pickAt`

Babylon ships hit testing out of the box:

```ts
pickAt(x: number, y: number): string | null {
  const pick = this.scene!.pick(x, y);
  if (!pick?.hit || !pick.pickedMesh) return null;
  return pick.pickedMesh.metadata?.nodeId ?? null;
}
```

You must stamp `node.id` into `mesh.metadata.nodeId` during build.
Helpers (if you add any) should be marked `mesh.isPickable = false`.
**Acceptance**: clicking a mesh sets `useUIStore.selectedNodeId`.

### 7.4 Step 4 — `AssetCache` + `syncAsset`

Babylon's `SceneLoader.LoadAssetContainerAsync` loads .glb into a
container; you clone instances on demand.

```ts
private assetCache = new Map<string, AssetContainer>();

async syncAsset(asset: AssetReference) {
  if (this.assetCache.has(asset.id)) return;
  const container = await SceneLoader.LoadAssetContainerAsync(
    "", asset.relative_path, this.scene!,
  );
  this.assetCache.set(asset.id, container);
}
```

**Acceptance**: a `prefab_instance` referencing a real .glb appears in
the viewport.

### 7.5 Step 5 — `BehaviorRegistry` + auto-rotate port

Adapter-local `behaviorRegistry`. For `auto-rotate` translate the same
parameter shape (`axis`, `speed`) to a Babylon `node.rotate(axis,
speed*dt*deg2rad)` call.

```ts
import { Behavior } from "../adapter";
import { Vector3 } from "@babylonjs/core";

export const autoRotateBabylon: Behavior = {
  type: "auto-rotate",
  definition: {
    /* … */
  },
  install(node, params, ctx) {
    return {
      node_id: node.id,
      binding_id: ctx.binding_id,
      axisVec:
        params.axis === "x"
          ? Vector3.Right()
          : params.axis === "y"
            ? Vector3.Up()
            : Vector3.Forward(),
      degPerSec: params.speed,
    };
  },
  tick(handle, dt) {
    const node = ctx.getRuntimeObject(handle.node_id) as TransformNode;
    node.rotate(handle.axisVec, (handle.degPerSec * dt * Math.PI) / 180);
  },
  uninstall(handle) {
    /* restore original rotation */
  },
  generateCode(binding, ctx) {
    /* emit Babylon-flavored snippet */ return "";
  },
};
```

**Acceptance**: clicking Play on a mesh with an auto-rotate binding
rotates it in the Babylon viewport.

### 7.6 Step 6 — Wire into `useUIStore` + `RuntimeTarget`

Edit `src/services/ui/store.ts` to allow `RuntimeTarget.kind === "babylon.js"`
when creating new projects (currently the spec reserves it but the
project factory only emits `three.js`). Wire `EXPORTERS` in the
adapter file to a new `BabylonExporter` if you also want code export.

**Acceptance**: creating a new project with `target_runtime.kind === "babylon.js"`
boots the BabylonAdapter instead of ThreeAdapter; all earlier acceptance
tests still pass.

### Closing the loop

Run the visual smoke matrix in `docs/scene-graph-spec.md` examples
against your new adapter. Differences between adapters are expected
(e.g. light intensity units); document them in a per-adapter README.
````

§8：

````markdown
## 8. ThreeAdapter reference

A tour of `src/runtime/three/`:

```
src/runtime/three/
├── adapter.ts                # ThreeAdapter implements IRuntimeAdapter
├── node-builders/
│   ├── index.ts              # BuilderRegistry per-kind dispatch
│   ├── group.ts
│   ├── mesh.ts
│   ├── light.ts
│   ├── camera.ts
│   ├── helper.ts             # GridHelper + AxesHelper; raycast no-op
│   └── prefab-instance.ts    # AssetCache lookup + magenta placeholder
├── behaviors/
│   ├── registry.ts           # behaviorRegistry: Map<type, Behavior>
│   ├── auto-rotate.ts        # reference Behavior implementation
│   └── adapter-test.ts       # placeholder for the multi-binding test (§ 9)
├── export/
│   ├── adapter.ts            # EXPORTERS dispatch (ExportTarget → Exporter)
│   ├── scene-codegen.ts      # SceneProject → main.js (TS-syntax-free)
│   ├── exporter-vite.ts      # Vite project template
│   └── exporter-standalone-esm.ts  # importmap-based single-file viewer
└── adapter.test.ts           # ThreeAdapter integration tests
```

### 8.1 Key design decisions (with PR pointers)

| Topic                                                                           | Where                                                 | PR                                                                                                             |
| ------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Bundle-chunking buckets (`vendor-three`, `vendor-three-addons`, `vendor-react`) | `vite.config.ts` `manualChunks`                       | [#9](https://github.com/longyi-xw/lowcode-3d/pull/9), [#11](https://github.com/longyi-xw/lowcode-3d/pull/11)   |
| Canvas display style + manual `setSize(width, height, false)`                   | `ThreeViewport.tsx`, `adapter.ts`                     | [#5](https://github.com/longyi-xw/lowcode-3d/pull/5)                                                           |
| `OutlinePass` selection (color, edgeStrength, dragging-changed listener)        | `ThreeViewport.tsx`                                   | [#11](https://github.com/longyi-xw/lowcode-3d/pull/11)                                                         |
| Helper raycast no-op + `isEffectivelyLocked` policy                             | `node-builders/helper.ts`, `src/core/scene/policy.ts` | [#15](https://github.com/longyi-xw/lowcode-3d/pull/15), [#16](https://github.com/longyi-xw/lowcode-3d/pull/16) |
| `AssetCache` + content-hashed assets + hardlink persistence                     | `prefab-instance.ts`, `src-tauri/`                    | [#17](https://github.com/longyi-xw/lowcode-3d/pull/17)                                                         |
| `scene-codegen.ts` plain-JS-with-JSDoc rule                                     | `scene-codegen.ts`, `scene-codegen.test.ts`           | [#19](https://github.com/longyi-xw/lowcode-3d/pull/19)                                                         |
| Behavior framework + ticker prolog/epilog in codegen                            | `behaviors/`, `scene-codegen.ts`                      | [#20](https://github.com/longyi-xw/lowcode-3d/pull/20)                                                         |
| Play mode side effects (gizmo detach, outline clear, pickAt bypass)             | `ThreeViewport.tsx`                                   | [#21](https://github.com/longyi-xw/lowcode-3d/pull/21)                                                         |
````

§9：

```markdown
## 9. Testing your adapter

### 9.1 Current coverage

`src/runtime/three/adapter.test.ts` covers:

- `mount` / `unmount` lifecycle
- `syncNode` add / update / remove for `group`, `mesh`, `light`, `camera`, `helper`
- `pickAt` ray casting (with manual `camera.updateMatrixWorld(true)` before each ray — required because `lookAt` alone doesn't refresh `matrixWorld` outside a render loop)
- `installBehaviors` / `uninstallBehaviors` paths

Limitations noted in the file:

- "tick errors on one binding don't break others" is a placeholder.
  It only exercises uninstall today because `behaviorRegistry` is
  private. A real version requires a second stateful behavior to
  inject a throwing one (`v0.5 Stage C` work).

### 9.2 Codegen syntax assertions

`src/runtime/three/export/scene-codegen.test.ts` includes a "no TS
syntax" assertion suite that rejects emit containing
`as` casts, `: Type` annotations, `interface`, `enum`, `<Generic>` at
call sites — anything the standalone target can't execute directly.
If your codegen produces TS-only syntax these tests will fail.

### 9.3 Planned: conformance suite

A cross-adapter conformance suite is planned for **v1.0** alongside the
Babylon.js adapter. It will load a fixture SceneGraph, run it through
each adapter, and compare:

- Selection / pickAt behavior on the same screen coordinates
- Render-loop tick correctness for each built-in behavior
- Exported code parity (snapshot the same scene against each adapter
  and assert byte-equal `main.js` modulo target-specific imports)

Until then, treat ThreeAdapter as the de-facto baseline.
```

§10：

```markdown
## 10. Reserved & Future

### 10.1 Reserved `RuntimeTarget` kinds

- `babylon.js` — guide §7 walk-through. v1.0 work.
- `unity` — high-level: export to a Unity project skeleton + `.scene`
  file. Pre-spec.
- `react-three-fiber` — declarative R3F project export. Pre-spec.

### 10.2 Multi-adapter scenarios

At runtime, exactly one adapter is mounted per editor session (the
`target_runtime.kind` chosen at project creation). At export time the
project is bound to its `target_runtime` — exporting cross-target is
not on the roadmap (v1.0 conformance suite is the limit).

### 10.3 AI Skill integration (v0.3)

`getRuntimeObject(node_id)` is the **single entry point** an AI Skill
will use to introspect the live engine state for "describe what's in
the scene" prompts. Adapters should keep it cheap (no full subtree
walk; just return the cached `Object3D` / `AbstractMesh`).

### 10.4 Asset preload conformance

Future addition to the `IRuntimeAdapter` contract:
`preloadAssets(assets: AssetReference[]): Promise<void>` for batch
parallel loading. Currently each `syncAsset` is serial. Reserved for
v0.2 work.
```

- [ ] **步骤 2：本地校验**

```sh
pnpm prettier --write docs/adapter-guide.md
```

人工抽查：

- [ ] §7 Babylon 章节明确标注 "hypothetical, not tested"
- [ ] §8.1 PR 链接表与 src/runtime/three/ 目录实际结构一致
- [ ] §9.2 no-TS-syntax 列表与 `scene-codegen.test.ts` 实际断言一致

- [ ] **步骤 3：Commit**

```sh
git add docs/adapter-guide.md
git commit -m "docs(adapter-guide): § 7-10 (Babylon walk-through + ThreeAdapter ref + testing + reserved)

- § 7 Writing your own adapter — six steps with hypothetical Babylon
  8.x code (not tested, marked clearly) culminating in an
  auto-rotate port
- § 8 ThreeAdapter reference (src/runtime/three/ tour + PR-pointer
  table covering bundle/canvas/outline/helper/asset cache/codegen/
  behaviors/play-mode decisions)
- § 9 Testing (current adapter.test.ts coverage + no-TS-syntax
  codegen assertions + planned v1.0 conformance suite)
- § 10 Reserved & Future (babylon/unity/r3f, multi-adapter scope, AI
  Skill entry point, asset preload conformance)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 D4：`README.md` 更新

**文件：**

- 修改：`README.md`

**反推源：**

- 已写的 `docs/roadmap.md` (D1)
- 已写的 `docs/scene-graph-spec.md` (D2a-c)
- 已写的 `docs/adapter-guide.md` (D3a-c)
- 当前 `design/screenshots/img.png` (D5 即将 commit)

- [ ] **步骤 1：替换 Status badge + Status 段 + Milestone 表**

打开 `README.md`，找到第 10 行附近的 status badge：

```html
[![Status:
scaffold](https://img.shields.io/badge/status-pre--MVP_scaffold-orange.svg)](#status)
```

替换为：

```html
[![Status: pre-v0.1](https://img.shields.io/badge/status-pre--v0.1-yellow.svg)](#status)
```

找到 "## Status" 段（约 28 行）：

```markdown
## Status

> **You are here**: `v0.0.1-scaffold` — empty-but-runnable shell.
```

替换为：

```markdown
## Status

> **You are here**: pre-`v0.1.0` — Phase 0-2 shipped (geometry / lights / cameras / .glb import / Vite + standalone code export); v0.5 行为系统 framework + auto-rotate shipped ahead of schedule. Phase 3 (polish & release) in progress towards v0.1.0.
```

找到 "| Milestone | What lands | Status |" 表，整段替换为：

```markdown
| Milestone         | What lands                                                                                           | Status                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `v0.0.1-scaffold` | Tauri + Vite + React + Tailwind + shadcn + i18n + Zustand + ESLint + CI                              | ✅ shipped                                  |
| `v0.1.0-mvp`      | Scene Graph · Three.js viewport · transform gizmos · .glb import · code export · behaviors framework | 🟡 Phase 3 polish in progress               |
| `v0.2`            | Asset browser · material editor · settings persistence                                               | ⏳ planned                                  |
| `v0.3`            | AI Skills · natural-language scene edits                                                             | ⏳ planned                                  |
| `v0.4`            | Spatial snapping (socket system)                                                                     | ⏳ planned                                  |
| `v0.5`            | Behavior library (auto-rotate ✅, hover-highlight, click-trigger, …)                                 | 🟡 partial — framework + 1 behavior shipped |
| `v1.0`            | Multi-runtime adapter (Babylon.js validation)                                                        | ⏳ planned                                  |
| `v1.x`            | react-three-fiber, Unity adapters                                                                    | ⏳ planned                                  |

Detailed sub-stage tracking lives in [`docs/roadmap.md`](docs/roadmap.md). The
five-layer architecture this scaffold is laid against lives in
[`design/framework/architecture.md`](design/framework/architecture.md), and the
canonical Scene Graph format / adapter interface live in
[`docs/scene-graph-spec.md`](docs/scene-graph-spec.md) and
[`docs/adapter-guide.md`](docs/adapter-guide.md).
```

> 注意旧版的 "The roadmap and the five-layer architecture this scaffold is laid against lives in [design/framework/architecture.md]…" 已折叠进新表后的段落，删除旧版残段。

- [ ] **步骤 2：新增 "What works today" 段**

在 "## Status" 段之后、"## Stack" 段之前插入：

```markdown
## What works today

Concrete user story coverage as of pre-v0.1:

- **Create** a new project, choose `three.js` runtime; save / open / close from disk (atomic folder swap, git-friendly per-node files).
- **Edit** transforms via gizmo or numeric panel; pick by canvas click; undo/redo with a 500ms gesture merge window.
- **Compose** a scene with meshes, lights (directional / point / spot / ambient), cameras, helpers (grid / axes), and `.glb` imports (content-addressed `assets/{sha256}.glb`).
- **Behaviors**: add auto-rotate bindings on any node; edit axis + speed; toggle Play to preview; Stop restores transform.
- **Export** to a Vite project (`pnpm install && pnpm dev`) or a standalone HTML viewer (`python -m http.server`). Exported code includes the same auto-rotate runtime.

The full release matrix and sub-stage tracking live in [`docs/roadmap.md`](docs/roadmap.md).
```

- [ ] **步骤 3：新增 "Current implementation" 截图段**

在 "## Architecture" 段（含 SVG 的）之后、"## Prototype" 段之前，插入：

```markdown
## Current implementation

The editor as of pre-v0.1 — behaviors framework + auto-rotate + Play/Pause toggle shipped in PRs [#20](https://github.com/longyi-xw/lowcode-3d/pull/20) and [#21](https://github.com/longyi-xw/lowcode-3d/pull/21):

<img src="design/screenshots/img.png" width="820" alt="lowcode-3d editor — current state with behaviors tab" />
```

- [ ] **步骤 4：本地校验**

```sh
pnpm prettier --write README.md
```

人工抽查：

- [ ] Status badge 不再说 `pre-MVP_scaffold`
- [ ] Milestone 表 8 行（v0.0.1 ✅ / v0.1.0 🟡 / v0.2-v0.5 / v1.0 / v1.x）
- [ ] What works today 段 5 条用户故事
- [ ] Current implementation 段引用 `design/screenshots/img.png`
- [ ] 4 个文档链接（roadmap / architecture / spec / guide）路径正确

- [ ] **步骤 5：Commit**

```sh
git add README.md
git commit -m "docs(readme): update milestone table, status badge, what-works, current screenshot

- Status badge: pre-MVP_scaffold → pre-v0.1 (yellow)
- Status paragraph: rewritten to reflect Phase 0-2 + v0.5 framework
  shipped state
- Milestone table: expanded to 7 release rows (v0.0.1 / v0.1.0 / v0.2
  / v0.3 / v0.4 / v0.5 / v1.0 / v1.x) per docs/roadmap.md decision;
  sub-stage detail delegated to roadmap
- New 'What works today' section: 5 concrete user-story bullets
- New 'Current implementation' section: design/screenshots/img.png
  with reference to PR #20 + #21
- Replaces inline architecture-link paragraph with a roadmap-anchored
  doc index

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 D5：commit `design/screenshots/img.png`

**文件：**

- 修改（已 modified）：`design/screenshots/img.png`

- [ ] **步骤 1：确认 README 已引用截图**

```sh
grep -n "design/screenshots/img.png" README.md
```

预期：返回一行（D4 步骤 3 加入的那行）。

- [ ] **步骤 2：Commit**

```sh
git add design/screenshots/img.png
git commit -m "docs(screenshots): update editor screenshot for behaviors UI

Captures the editor with the Behaviors tab active, used by README's
'Current implementation' section as evidence of v0.5 Stage A + B
having shipped (PR #20, #21).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 D6：一致性自检 + 全局验证 + push + 开 PR

**文件：** 无修改

- [ ] **步骤 1：交叉引用一致性自检**

```sh
# spec ↔ guide ↔ roadmap 引用是否对齐
grep -n "scene-graph-spec" docs/adapter-guide.md docs/roadmap.md README.md
grep -n "adapter-guide" docs/scene-graph-spec.md docs/roadmap.md README.md
grep -n "roadmap" docs/scene-graph-spec.md docs/adapter-guide.md README.md
grep -n "architecture.md" docs/scene-graph-spec.md docs/adapter-guide.md docs/roadmap.md README.md
```

人工核对：

- [ ] 每条引用路径都正确（`docs/...` from README, `../design/...` from docs/）
- [ ] 没有指向 TBD 章节的死链
- [ ] 无 "to be written" / "see XXX (TBD)" 残留

- [ ] **步骤 2：PR 号引用准确性**

```sh
grep -nE "PR #|pull/[0-9]+" docs/roadmap.md docs/scene-graph-spec.md docs/adapter-guide.md README.md
```

人工核对每个 PR # 与 https://github.com/longyi-xw/lowcode-3d/pull/N 实际内容一致：

- [ ] #1-#11 Phase 0/1
- [ ] #12-#19 Phase 2
- [ ] #20 v0.5 Stage A
- [ ] #21 v0.5 Stage B

- [ ] **步骤 3：跑全套验证**

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
```

预期：全绿。`format:check` 可能因 prettier 没跑过部分 markdown 文件而报错，运行 `pnpm format` 修复 + 单独 commit "chore(format): prettier sweep on new docs"。

- [ ] **步骤 4：spec JSON 示例 zod parse 抽查**

```sh
# 把 spec § 2.2 JSON 示例 copy 到一个临时文件验证
cat > /tmp/spec-example.json <<'EOF'
{
  "spec_version": "0.1.0",
  "metadata": {
    "id": "00000000-0000-4000-8000-000000000002",
    "name": "single-cube",
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-01T00:00:00.000Z",
    "target_runtime": { "kind": "three.js", "version": "0.164.0", "module_format": "esm" }
  },
  "scene": { "root_node_ids": [], "nodes": {} },
  "assets": [],
  "settings": {
    "units": "meters", "up_axis": "y",
    "background": { "kind": "color", "hex": "#1f1f1f" }
  }
}
EOF
node -e "
const { SceneProjectSchema } = require('./src/core/scene/schemas');
const fs = require('fs');
const project = JSON.parse(fs.readFileSync('/tmp/spec-example.json', 'utf8'));
SceneProjectSchema.parse(project);
console.log('OK');
" || echo "FAIL: spec example does not parse"
```

> 如果 import path 在 Node 端不通，跳过此步骤；改为人工对照 `examples/single-cube/project.json` 字段。

预期：`OK` 或人工确认字段对齐。

- [ ] **步骤 5：push + 开 PR**

```sh
git push -u origin docs/phase3-docs-polish
/opt/homebrew/bin/gh pr create \
  --base main \
  --head docs/phase3-docs-polish \
  --title "docs(phase3): scene-graph-spec + adapter-guide + README + roadmap (3.4)" \
  --body "$(cat <<'EOF'
## What

Phase 3 · 3.4 文档补完 sub-stage（架构 §6 v0.1 收口的"文档"项）。

- **`docs/roadmap.md`** 新增——架构 vs 实际 PR 映射、命名重制（项目内 "Phase 3 Stage A/B" → "v0.5 Stage A/B"）、每个 release 的 Goals / Target user / Success criteria（v0.1 详细，v0.5/v0.2 中等，v0.3-v1.x 简略），sub-stage checkbox。
- **`docs/scene-graph-spec.md`** 从 TBD 占位写到完整 v0.1.0 spec：11 章覆盖 SceneProject / Node / NodeData (7 kinds) / AssetReference / BehaviorBinding / Settings / Serialization / Versioning / Validation / Reserved，含 JSON 示例 + 字段表 + ThreeAdapter 支持矩阵。
- **`docs/adapter-guide.md`** 从 TBD 占位写到完整版：10 章覆盖 concept / IRuntimeAdapter interface / lifecycle / Node kinds mapping / Behavior class + registry / Code export / Babylon 8.x 假设示例 (hypothetical, not tested) / ThreeAdapter 参考 + PR 决策链接表 / testing / Reserved & Future。
- **`README.md`** Status badge 换成 pre-v0.1；milestone 表展开 7 行（释 release，不下钻 sub-stage）；新增 "What works today" + "Current implementation" 段（引用 design/screenshots/img.png）。
- **`design/screenshots/img.png`** commit 进 PR 作为 "current implementation" 佐证。

不动：architecture.md、skill-guide.md（v0.3）、CHANGELOG（3.5 处理）、CONTRIBUTING.md、examples/、src/。

## Why

- Architecture: \`design/framework/architecture.md\` §6 Phase 3
- Spec: \`docs/superpowers/specs/2026-05-28-phase3-docs-polish-design.md\`
- Plan: \`docs/superpowers/plans/2026-05-29-phase3-docs-polish-plan.md\`

scene-graph-spec / adapter-guide 长期是 TBD 占位，README milestone 表停在 v0.0.1-scaffold 严重落后于实际进度。本 PR 把文档对齐到 PR #20/#21 之后的实际状态，并建立未来 release 节奏的跟踪文档。

## How to test

- [ ] \`pnpm lint\`
- [ ] \`pnpm typecheck\`
- [ ] \`pnpm test\`
- [ ] \`pnpm format:check\`
- [ ] 抽查 \`docs/scene-graph-spec.md\` § 2.2 JSON 示例能 zod parse（见 plan 任务 D6 步骤 4）
- [ ] 人工核对 PR # 引用（#1-#11、#12-#19、#20、#21）与实际 PR 内容一致
- [ ] 检查 README GitHub preview 截图正常显示

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **步骤 6：等 CI + 标记 sub-stage 完成**

```sh
gh pr checks <PR-#> --watch
```

CI 全绿后人工标记 `docs/roadmap.md` 中 `3.4 文档补完` checkbox 为已完成（PR # 替换为新 PR 号），但**不在本 PR 内自我 check** —— 留给 merge 之后的小 follow-up commit / 下一个 sub-stage PR 顺手做。

---

## 收尾验收

执行完 D1-D6，应满足 spec §1 成功标准：

1. ✅ 第三方 Three.js 开发者通过 `README.md` + `docs/scene-graph-spec.md` + `docs/adapter-guide.md` 能（a）知道项目是什么（b）读懂 Scene Graph JSON 格式（c）画出 IRuntimeAdapter 接口并知道关键方法语义，无需读 `src/`
2. ✅ `docs/roadmap.md` 一屏回答"项目在哪里、下一步、什么时候发 v0.1"
3. ✅ 新文档与 `architecture.md` 无矛盾，引用关系清晰
4. ✅ `pnpm lint` / `pnpm typecheck` / `pnpm test` 全绿；无代码改动 zero 退化

下一步：merge 本 PR → 进入 Phase 3 · 3.1 / 3.2 / 3.3 / 3.5（顺序按 roadmap.md 已勾选状态再 brainstorm）。
