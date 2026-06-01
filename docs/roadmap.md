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

下表把架构文档 [`design/framework/architecture.md`](../design/framework/architecture.md) §6-7 的阶段定义对照到实际 PR：

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

## Naming reclamation

历史 PR 标题里出现的 "Phase 3 Stage A/B"（PR #20、#21）实际落地的是架构 §7 定义的 **v0.5 行为系统**，而不是架构 §6 的 Phase 3（v0.1 打磨发布）。本文档与所有未来 plan / spec 统一改称：

| 历史命名（PR 标题/commit message 不改） | 新命名（文档以此为准）                                             |
| --------------------------------------- | ------------------------------------------------------------------ |
| "Phase 3 Stage A" (PR #20)              | **v0.5 Stage A** — framework + auto-rotate runtime + scene-codegen |
| "Phase 3 Stage B" (PR #21)              | **v0.5 Stage B** — UI Tab + 4 commands + Play/Pause toggle         |

历史 plan 文件 `docs/superpowers/plans/2026-05-25-phase3-behaviors-stage-{a,b}.md` 不改名。**所有新写的 plan / spec 与文档以新名为准**，引用历史 PR 时附 "(historically called …)" 注脚以便 git blame 检索。

架构 §6 的 "Phase 3" 在本项目内保留原义 = v0.1 打磨发布；其子拆分使用 **Phase 3 · 3.1 / 3.2 / 3.3 / 3.4 / 3.5** 编号。

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
    - [x] 3.1 快捷键完整化（Delete / Cmd+D / F / Space / Esc + 帮助）（[#23](https://github.com/longyi-xw/lowcode-3d/pull/23)）
    - [x] 3.2 项目模板系统（接 `examples/empty-project` + `examples/single-cube` 到 New 流程的 picker）（[#24](https://github.com/longyi-xw/lowcode-3d/pull/24)）
    - [x] 3.3 错误处理 polish（全局 ErrorBoundary + IO toast + 未捕获 Promise 兜底）（[#25](https://github.com/longyi-xw/lowcode-3d/pull/25)）
    - [x] 3.4 文档补完（[#22](https://github.com/longyi-xw/lowcode-3d/pull/22)）
    - [ ] 3.5 发布流程（CHANGELOG + tag v0.1.0 + GitHub Release）

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

### v0.2 — Planned

- **Goals**: 资源库与材质编辑（架构 §7 v0.2）。内置基础几何 / 灯光 / HDRI 资源库 + 用户上传管理（取代当前 "拖 .glb 进视口" 单一入口）+ 属性面板加 PBR 材质参数（baseColor / metalness / roughness / emissive / normalMap）。
- **Target user**: 不想从头建几何或找模型的设计师；想精修 PBR 材质的开发者。
- **Success criteria**:
  - 资源库面板能浏览 / 搜索 / 拖入视口
  - 上传后的资源出现在库里且 save/open 后保留
  - 属性面板的材质参数能编辑 mesh 节点，撤销/重做有效
  - 导出代码包含正确的材质字段
- **Depends on**: v0.1 release（Phase 3 全部 5 个 sub-stage 完成）

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

## Tracking conventions

- **Sub-stage 完成时**：在对应 release 的 sub-stages checkbox 勾选，行末加 PR 链接（`([#NN](...))`）。
- **Release tag 时**：把当前 release 节归档到 `CHANGELOG.md`，本文该节标记 `Released YYYY-MM-DD`。
- **命名重制**：只追加，不删除。引入新别名时在 [Naming reclamation](#naming-reclamation) 表加一行，旧名保留以便 git blame 检索。
- **更新节奏**：每个 sub-stage merge 时同步更新本文件（PR 内含 roadmap diff）；架构方向变化时同步 architecture.md 而非本文件。
