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
| v0.2 资源库 + 材质编辑    | 内置库 + 用户上传 + 材质参数                               | #29, #30      | ✅         |
| v0.3 AI Skill 框架        | Skill 接口 + AI proxy + 自然语言操作                       | #31, #32      | ✅         |
| v0.4 空间吸附             | Socket 系统 + 几何约束                                     | #33–#36       | ✅         |
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
  - [x] Phase 3 打磨发布
    - [x] 3.1 快捷键完整化（Delete / Cmd+D / F / Space / Esc + 帮助）（[#23](https://github.com/longyi-xw/lowcode-3d/pull/23)）
    - [x] 3.2 项目模板系统（接 `examples/empty-project` + `examples/single-cube` 到 New 流程的 picker）（[#24](https://github.com/longyi-xw/lowcode-3d/pull/24)）
    - [x] 3.3 错误处理 polish（全局 ErrorBoundary + IO toast + 未捕获 Promise 兜底）（[#25](https://github.com/longyi-xw/lowcode-3d/pull/25)）
    - [x] 3.4 文档补完（[#22](https://github.com/longyi-xw/lowcode-3d/pull/22)）
    - [x] 3.5 发布流程（CHANGELOG + tag v0.1.0 + GitHub Release）（[#26](https://github.com/longyi-xw/lowcode-3d/pull/26)）

### v0.5 — Shipped (behaviors framework + 3 behaviors)

- **Goals**: 行为系统（架构 §7 v0.5），让用户在不写代码的情况下为节点添加 "自动旋转 / 悬停高亮 / 点击触发动画" 等语义动作；行为既在编辑器 Play 模式可预览，也作为 `// behavior(<binding-id>)` 嵌入导出的运行时代码。
- **Target user**: 同 v0.1，重点是无代码定义运行时交互的设计师与原型师。
- **Success criteria**:
  - 至少 3 个内置 behavior 可用（✅ auto-rotate + bob + hover-highlight）
  - UI 能添加 / 编辑 / 删除 binding，所有改动可撤销
  - Play 模式按 binding 顺序 tick；Stop 恢复 transform
  - 导出代码（Vite / Standalone）内嵌 behaviors，外部可运行
- **Sub-stages**:
  - [x] v0.5 Stage A: framework + auto-rotate runtime + scene-codegen ([#20](https://github.com/longyi-xw/lowcode-3d/pull/20))
  - [x] v0.5 Stage B: UI Tab + 4 commands + Play/Pause toggle ([#21](https://github.com/longyi-xw/lowcode-3d/pull/21))
  - [x] v0.5 Stage C: 事件驱动框架 + hover-highlight + bob（达成 ≥3 内置 behavior；click-trigger / event-emit 延后）（[#28](https://github.com/longyi-xw/lowcode-3d/pull/28)）

### v0.2 — Shipped（资源库 #29 + 材质编辑 #30）

- **Goals**: 资源库与材质编辑（架构 §7 v0.2）。内置基础几何 / 灯光 / HDRI 资源库 + 用户上传管理（取代当前 "拖 .glb 进视口" 单一入口）+ 属性面板加 PBR 材质参数（baseColor / metalness / roughness / emissive / normalMap）。
- **Target user**: 不想从头建几何或找模型的设计师；想精修 PBR 材质的开发者。
- **Sub-stages**:
  - [x] **资源库**（#29）：`MeshData.geometry` 描述符（box/sphere/plane/cylinder）+ builder/codegen 按 kind 建几何；底部可收缩抽屉（Cmd/Ctrl+J + chevron）、分类 tab（几何/灯光/上传）、搜索、卡片双击加节点（`AddNodeCommand` 可撤销）；`uploadGlbToLibrary` 上传入库（来源无关 catalog）；灯光视口标记。
  - [x] **材质编辑**（#30）：属性面板 PBR 参数（baseColor / metalness / roughness / emissive / emissive_intensity / opacity，slot 0）编辑 mesh 节点 + `SetMaterialOverrideCommand` 可撤销（拖动合并）+ `emitMesh` 经 `resolveMaterial` 导出材质字段。normalMap / 材质贴图见 [Backlog](#backlog显式延后项--记录避免遗忘--后期幻觉)。
- **Success criteria**:
  - [x] 资源库面板能浏览 / 搜索 / 加入视口（双击加节点）
  - [x] 上传后的资源出现在库里且 save/open 后保留
  - [x] 属性面板的材质参数能编辑 mesh 节点，撤销/重做有效
  - [x] 导出代码包含正确的材质字段
- **Depends on**: v0.1 release（Phase 3 全部 5 个 sub-stage 完成）

### v0.3 — Shipped（AI proxy #31 + Skill 框架 #32）

- **Goals**: AI Skill 框架（架构 §4.3 + §7 v0.3）。Skill 接口 + Rust 端 AI proxy（防止 API key 漏到前端）+ 首个自然语言操作（"添加一盏从右上方照射的暖白色定向光"）。
- **Sub-stages**:
  - [x] **A · AI proxy + BYO-key + provider 配置**（#31）：Rust `ai.rs` proxy（**Anthropic + DeepSeek**，OpenAI 兼容抽象）+ OS keychain（keyring）存 key + Settings Dialog「AI providers」多卡 UI（per-provider key/model/测试连接，radio 选 active）。`ai_complete`（text + 结构化 via tool-use/function-calling）为 B 铺路；key 不进 renderer。
  - [x] **B · Skill 框架 + scene-edit + 自然语言 UI**（#32）：精简 `Skill` 接口 + `SKILLS` 注册表 + 单轮 `runSkill`（input→proxy 结构化输出→zod 校验→Command）+ `scene-edit` skill（`add_light` 加灯 / `add_behavior` 给选中节点加行为如 auto-rotate）+ 常驻 `AiCommandBar` + 填 `docs/skill-guide.md`。color 名→hex 归一化。用 DeepSeek 验证。
- **Success criteria**:
  - [x] AI proxy 能调通 LLM（Anthropic / DeepSeek），key 安全存 keychain 不泄漏到前端
  - [x] 自然语言指令（"加一盏右上暖白定向光" / "给选中节点加绕 Y 轴旋转"）实际在场景生成对应节点/行为，可撤销
- **Depends on**: v0.2 release

### v0.4 — In progress（拆为 3 个 sub-stage）

- **Goals**: 空间吸附 / Socket 系统（架构 §7 v0.4）。节点之间几何关系约束求解，类似 Unity 的 Snap 或 Blender 的 Snap to。
- **Sub-stages**:
  - [x] **A · 网格吸附 + 吸附框架**（#33）：gizmo 平移拖拽时按住 Ctrl/Cmd 吸附到 0.5 网格；`snapTranslation` 纯函数引擎（`src/core/snap/`，供 B/C 扩展）+ ThreeViewport `objectChange` hook（pointer 读即时修饰键，不卡）。仅平移。
  - [x] **B · 节点对齐吸附**（#34）：gizmo 平移拖拽 + 按住 Ctrl/Cmd 时，被拖节点包围盒 15 特征（中心 + 8 角 + 6 面中心，**OBB** 跟随旋转）吸附到附近节点对应特征——屏幕像素（12px）做门槛、**3D 世界距离**选最近对齐对象（避免平行视角吸到深度更远的目标）；无命中回退 A 的网格吸附。`snapToNodes` 纯函数（`src/core/snap/nodes.ts`）+ ThreeViewport 投影/OBB 特征提取。仅平移。
  - [x] **资源拖拽入视口 + 落点**（[#35](https://github.com/longyi-xw/lowcode-3d/pull/35)）：从资源库卡片拖拽到视口，以 raycast y=0 地面命中点为落点（覆盖 x/z、保留库项默认 y）；双击加节点保留；走 `AddNodeCommand` 可撤销。纯函数 `screenToNdc`/`dropPositionFor`（`src/lib/drop-helpers.ts`）+ `findLibraryItem` + adapter `raycastGroundPoint` + 自定义 pointer 拖拽（Tauri 2 默认抑制 HTML5 DnD）+ DOM ghost。仅 y=0 地面（物体表面落点 / 落点吸附 / 3D 预览 / OS file-drop 见 Backlog）。
  - [x] **C · Socket 系统（地基）**（[#36](https://github.com/longyi-xw/lowcode-3d/pull/36)）：节点命名连接点 `Socket {id,name,position,tag}`（schema `.optional()`，老项目兼容）+ 纯函数 `snapToSockets`（tag 兼容、屏幕门槛、世界最近）+ `SetNodeSocketsCommand`（可撤销、合并）+ Properties「插槽」面板 + 视口标记（解耦 overlay、排除拾取）。**有 socket 的节点只走 socket 吸附**（未匹配落网格 A，不回退 B——否则 B 面吸会掩盖 tag 过滤）；无 socket 节点 B→A 不变。仅位置对齐（朝向咬合 / 规则引擎 / glb 内嵌识别见 Backlog）。
- **Depends on**: v0.3 release
- **后续**：A 网格（#33）+ B 节点对齐（#34）+ 资源拖拽（#35）+ C Socket 系统地基（#36）均已完成，v0.4 收口。Socket 后续阶段（朝向咬合 / 规则引擎 / glb 内嵌识别 / 点选放置 / 类型库）见 Backlog。

### v1.0 — In progress（多适配器；拆为 A1/A2/A3 + B）

- **Goals**: 多运行时适配器（架构 §7 v1.0）。把 `IRuntimeAdapter` 确立为引擎中立接缝，用第二个引擎（Babylon.js）+ conformance 套件验证抽象成立；最终支持实时切换渲染引擎、新引擎最小改动接入（项目本质：多框架低代码 3D 平台）。
- **Sub-stages**:
  - [x] **A1 · 契约 + Babylon headless + conformance**（[#37](https://github.com/longyi-xw/lowcode-3d/pull/37)）：契约加引擎中立 `describeNode(): RuntimeNodeInfo`（读引擎对象）+ `dispose()`；`BabylonAdapter`（`@babylonjs/core` `NullEngine`，headless）实现 `syncNode` 核心 kind（group/mesh/light/camera）；conformance 套件让 ThreeAdapter + BabylonAdapter 跑同一批断言全绿 = 契约对第二引擎成立。纯 headless，不接实时视口。
  - [x] **A2 · behaviors 跨引擎运行时**（[#38](https://github.com/longyi-xw/lowcode-3d/pull/38)）：`installBehaviors`/`tickBehaviors`/`uninstallBehaviors` 纳入 `IRuntimeAdapter`；Babylon behavior 框架（registry + auto-rotate + bob，操作 Babylon 节点，共享引擎中立 `BehaviorDefinition`）；conformance 验运行时对等——**bob 跨引擎精确对等**（位置突变同公式）、auto-rotate ran/累积/卸载、enabled/unknown 隔离。纯 headless。hover-highlight（事件型）+ behavior codegen 留后续。
  - [ ] **A3 · glTF + 导出**：prefab_instance/glTF 加载 + `babylon` 导出 target（含 behavior codegen 跨引擎）。
  - [ ] **B · 实时视口切引擎**：抽 `IRenderHost`（渲染循环/相机控制/gizmo/拾取/outline），ThreeViewport 改为面向它，Babylon 渲染宿主落地，用户可把实时编辑器切到 Babylon。spec §8 已备边界清单。
- **Depends on**: v0.5 行为系统全部完成（v0.5 Stage C）

### v1.x — Planned

- **Goals**: 更多运行时（react-three-fiber、Unity）。
- **Depends on**: v1.0 release

## Backlog（显式延后项 — 记录避免遗忘 / 后期幻觉）

从已完成 sub-stage 中刻意拆出的功能点，尚未排期到具体 release：

- **材质贴图 pipeline**（从 v0.2 材质编辑拆出）：normalMap / map / roughnessMap / metalnessMap / aoMap 等。需 `MaterialOverrideSchema` 加贴图字段（引用 `kind:"texture"` 的 `AssetReference`）+ texture 资源上传入库 + runtime `TextureLoader`（`mesh.ts applyOverrides` 加贴图通道）+ codegen emit `TextureLoader().load("./assets/…")` + UI 贴图选择器。独立子系统，单独 spec→plan→实现。
- **Socket 系统后续阶段**（从 v0.4 sub-stage C 地基拆出）：本期只做位置对齐 + tag 兼容 + 面板手填。延后（各自独立 spec→plan→实现）：**朝向咬合**（socket 带 normal/up，转动节点让两 socket 面对面「插上」）、**模型特性驱动的对齐规则引擎**（超越 tag 精确匹配）、**glb 内嵌 socket 自动识别**（importer 读 glTF 命名空节点）、**视口点选放置 socket**（raycast 模型表面落点）、**socket 类型库 / male-female 配对 / 批量拼装**、**socket 标记 LOD / 合批**（本期每次拖拽全量重建标记，大场景需按节点索引只刷被拖节点——视觉验证审查记录的次要优化项）。
- **Babylon 适配器跨引擎差异（A1/A2 记录，待 in-scope 时对齐）**：conformance 已断言的部分两引擎对等；已知未对齐/未处理项——(a) **camera 朝向**：Babylon `UniversalCamera` 用 Euler `.rotation`（无 `rotationQuaternion`），`applyBabylonTransform` 当前跳过其旋转（并入 B）；(b) **ambient light**：映射为 `HemisphericLight`，无 `position`，落点被丢（并入 B）；(c) **prefab_instance kind**：ThreeAdapter 占位报 `mesh`、BabylonAdapter 报 `unknown`（A3 加 glTF 时统一）；(d) **BabylonAdapter.dispose() 的 behavior handle 释放**：当前 `behaviorRuntime.clear()` 不遍历调 `handle.dispose?.()`（A2 的 auto-rotate/bob handle 无 dispose，故当前无副作用）；将来加有状态 Babylon behavior（绑监听器等）时，dispose 应改为遍历 `uninstallBehaviors` 释放 handle。
- **多源资源上传**（从 v0.2 资源库拆出）：`AssetSourceSchema` 已含 `builtin/user_upload/online/ai_generated` 且 catalog 来源无关；目前只实装 `builtin`（几何/灯光预设）+ `user_upload`（.glb）。延后：`online`（在线模型/材质库浏览+下载入库）、`ai_generated`（AI 生成模型/贴图）。
- **多材质槽**（从 v0.2 材质编辑拆出）：本期材质编辑只支持 slot 0；prefab/glTF 多材质对象的 slot 1+ 延后。
- **agentic 多轮 Skill 执行**（从 v0.3 sub-stage B 拆出）：本期 Skill 是**单轮结构化输出**（NL→LLM 一次返回 operations→Command）。延后：架构 §4.3 的 `call_tool` / `allowed_tools` 多轮 agent 循环（LLM 多轮调工具、读场景、迭代纠错）+ `SkillContext.memory`（`MemoryStore` 项目暂无实现）。用户明确「多轮后续肯定要完善」。
- **更多 Skill + skill routing**（从 v0.3 sub-stage B 拆出）：本期只 `scene-edit`（op 仅 `add_light`）。延后：scene-edit 更多 op（加几何/改材质/移动等）、asset-tagging / code-explain / local-fast skill、skill→provider+model 路由（prototype `img_5` 的 skill routing；本期 `runSkill` 用 settings 的 active provider）。

## Tracking conventions

- **Sub-stage 完成时**：在对应 release 的 sub-stages checkbox 勾选，行末加 PR 链接（`([#NN](...))`）。
- **Release tag 时**：把当前 release 节归档到 `CHANGELOG.md`，本文该节标记 `Released YYYY-MM-DD`。
- **命名重制**：只追加，不删除。引入新别名时在 [Naming reclamation](#naming-reclamation) 表加一行，旧名保留以便 git blame 检索。
- **更新节奏**：每个 sub-stage merge 时同步更新本文件（PR 内含 roadmap diff）；架构方向变化时同步 architecture.md 而非本文件。
