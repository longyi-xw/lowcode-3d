# AI Web 3D 低代码平台 · 架构设计 v0.1

> 本文档基于五层架构原则，定义项目地基。重点在"接口规范"与"数据格式"，而非具体实现。MVP 阶段只实现部分模块，但所有跨层接口都按完整版设计。

---

## 一、技术选型

| 维度 | 选型 | 理由 |
|---|---|---|
| 应用框架 | Tauri 2.x | 包体小、性能好、Rust 后端、对开源友好 |
| 前端框架 | React 18 + TypeScript | 生态成熟、AI 辅助开发资料充足 |
| 渲染层 | Three.js (MVP 唯一) | 用户最大、文档最全、生态最好 |
| 状态管理 | Zustand + Immer | 轻量、可序列化、对 Command 模式友好 |
| 持久化 | SQLite (via tauri-plugin-sql) | 资源索引、Memory、用户配置 |
| 文件格式 | 自定义 JSON + glTF 几何 | 见 Scene Graph 规范 |
| AI 接入 | 用户自带 key，支持 OpenAI / Anthropic / 本地 Ollama | 开源项目成本可控 |

---

## 二、目录结构

```
project-root/
├── src-tauri/                      # Rust 后端
│   ├── src/
│   │   ├── main.rs
│   │   ├── fs/                     # 文件 I/O（读写本地工程、glb 资源）
│   │   ├── asset/                  # 资源管线（glb 解析、缩略图生成）
│   │   ├── export/                 # 代码导出引擎（模板编译）
│   │   ├── ai/                     # AI 调用代理（防止 key 泄漏到前端）
│   │   └── db/                     # SQLite 操作
│   └── Cargo.toml
│
├── src/                            # 前端
│   ├── core/                       # 第 2 层 · 核心数据模型（纯 TS，无依赖）
│   │   ├── scene/                  # Scene Graph 类型定义、校验、序列化
│   │   ├── command/                # Command 接口与基础实现
│   │   └── id/                     # UUID 与 content-hash 工具
│   │
│   ├── runtime/                    # 第 3 层 · 运行时适配器
│   │   ├── adapter.ts              # IRuntimeAdapter 接口（地基）
│   │   ├── three/                  # Three.js 适配器实现（MVP）
│   │   │   ├── adapter.ts
│   │   │   ├── node-builders/      # 各类 Node 的构建器
│   │   │   └── exporter/           # Three.js 代码模板
│   │   ├── babylon/                # 预留（不实现）
│   │   └── unity/                  # 预留（不实现）
│   │
│   ├── editor/                     # 第 4 层 · 编辑器引擎
│   │   ├── store.ts                # Zustand store（持有 Scene Graph）
│   │   ├── commands/               # 具体 Command 实现
│   │   ├── controllers/            # 选中、变换、相机、键盘
│   │   ├── snap/                   # 空间吸附（v0.3+，先留空接口）
│   │   └── history.ts              # 撤销重做栈
│   │
│   ├── services/                   # 第 1 层 · 服务（前端部分）
│   │   ├── asset-library/          # 资源库前端逻辑
│   │   ├── ai/                     # AI Skills 管理（前端调度，调用走 Rust）
│   │   ├── project/                # 项目读写
│   │   └── ipc/                    # Tauri 调用封装
│   │
│   ├── ui/                         # 第 5 层 · React 组件
│   │   ├── viewport/               # 3D 视口
│   │   ├── panels/                 # 属性面板、层级面板
│   │   ├── browser/                # 资源浏览器
│   │   └── menu/                   # 菜单栏
│   │
│   ├── App.tsx
│   └── main.tsx
│
├── packages/                       # 未来抽离成独立 npm 包的部分
│   └── scene-spec/                 # Scene Graph 规范（可独立发布，方便他人写适配器）
│
├── examples/                       # 示例工程（验证导出代码能跑）
│   └── three-vite-starter/
│
└── docs/
    ├── scene-graph-spec.md         # 数据格式规范
    ├── adapter-guide.md            # 如何写新适配器
    └── skill-guide.md              # 如何写 AI Skill
```

**关键设计原则**：
- `src/core/` 是地基，不依赖任何其他目录
- `src/runtime/` 只依赖 `src/core/`
- `src/editor/` 依赖 `core/` 和 `runtime/`
- `src/ui/` 是最外层，可以依赖任何内层
- `packages/scene-spec/` 是未来开源生态的入口，让第三方可以基于规范写自己的适配器

---

## 三、Scene Graph 规范（最重要的地基）

### 3.1 顶层结构

```typescript
interface SceneProject {
  // 规范版本，升级时用于迁移
  spec_version: "0.1.0";

  // 项目元数据
  metadata: {
    id: string;                    // UUID
    name: string;
    created_at: string;            // ISO 8601
    updated_at: string;
    target_runtime: RuntimeTarget; // 用户创建项目时选定，不再变更
  };

  // 场景节点树
  scene: SceneGraph;

  // 项目引用的所有资源（去重）
  assets: AssetReference[];

  // 用户自定义配置
  settings: {
    units: "meters" | "centimeters";
    up_axis: "y" | "z";
    background: ColorOrHDRI;
  };
}

type RuntimeTarget =
  | { kind: "three.js"; version: string; module_format: "esm" | "cjs" }
  | { kind: "babylon.js"; version: string }
  | { kind: "unity"; version: string; render_pipeline: "urp" | "hdrp" | "builtin" }
  | { kind: "react-three-fiber"; version: string };
```

### 3.2 节点结构

```typescript
interface Node {
  id: string;                      // UUID, 节点全局唯一 ID
  name: string;                    // 用户可见的名字
  type: NodeType;                  // 类型决定它有什么字段

  transform: Transform;            // 所有节点都有变换
  parent_id: string | null;        // 父节点 ID，null 表示根节点子节点
  children_ids: string[];          // 子节点 ID 列表

  visible: boolean;
  locked: boolean;                 // 锁定后编辑器无法选中

  // 类型相关的具体数据
  data: NodeData;

  // 行为绑定（行为是跨技术栈的能力，绑定时按 target_runtime 选具体实现）
  behaviors: BehaviorBinding[];

  // 用户自定义元数据（AI 标注、tag 等）
  user_data: Record<string, unknown>;
}

type NodeType =
  | "group"          // 仅作为组织节点，无渲染
  | "mesh"           // 引用一个几何资源
  | "light"          // 灯光
  | "camera"         // 相机
  | "helper"         // 辅助显示（grid、axis、ruler，仅编辑器可见）
  | "custom";        // 第三方扩展类型

interface Transform {
  position: [number, number, number];
  rotation: [number, number, number, number];  // 四元数 [x,y,z,w]
  scale: [number, number, number];
}

// data 字段根据 type 不同有不同 schema
type NodeData =
  | { type: "group" }
  | { type: "mesh"; asset_id: string; material_overrides?: MaterialOverride[] }
  | { type: "light"; light_kind: "directional" | "point" | "spot" | "ambient"; color: string; intensity: number; /* ... */ }
  | { type: "camera"; camera_kind: "perspective" | "orthographic"; fov?: number; /* ... */ }
  | { type: "helper"; helper_kind: string }
  | { type: "custom"; custom_type: string; payload: unknown };
```

### 3.3 资源引用

```typescript
interface AssetReference {
  id: string;                      // UUID
  content_hash: string;            // 内容哈希，用于去重和缓存
  kind: "geometry" | "texture" | "hdri" | "audio" | "video";

  // 相对路径，相对于项目文件夹
  // 资源实体存在 project/assets/{content_hash}.{ext}
  relative_path: string;

  // AI 自动标注或用户手动填的标签
  tags: string[];
  description: string;

  // 来源（默认库 / 用户上传 / 在线导入 / AI 生成）
  source: AssetSource;
}

type AssetSource =
  | { kind: "builtin"; library_id: string }
  | { kind: "user_upload"; original_filename: string }
  | { kind: "online"; provider: string; url: string; license: string }
  | { kind: "ai_generated"; model: string; prompt: string };
```

### 3.4 行为绑定

```typescript
// 行为是"语义动作"，比如"自动旋转"、"鼠标悬停高亮"、"点击触发动画"
// 它跨技术栈定义，由各适配器具体实现
interface BehaviorBinding {
  id: string;
  behavior_type: string;           // 例如 "auto-rotate"
  enabled: boolean;
  parameters: Record<string, unknown>;  // 参数 schema 由具体 behavior 定义
}
```

### 3.5 序列化与持久化

项目以**文件夹**形式保存，对 git 友好：

```
my-project/
├── project.json                # SceneProject 顶层（不含 scene 的 nodes）
├── scene/
│   ├── nodes/
│   │   ├── {node_id}.json      # 每个 Node 一个文件，方便 git diff
│   │   └── ...
│   └── hierarchy.json          # 节点树结构（仅父子关系）
├── assets/
│   ├── {hash}.glb
│   ├── {hash}.png
│   └── ...
└── .lowcode/                   # 工具内部缓存（缩略图、索引等）
```

为什么每个 Node 一个文件：协作时 merge 冲突最小，单个节点改动 diff 清晰。

---

## 四、核心接口定义

### 4.1 运行时适配器（最关键的扩展点）

```typescript
// 所有新增技术栈支持，都通过实现这个接口
interface IRuntimeAdapter {
  readonly target: RuntimeTarget;

  // === 编辑器内实时渲染 ===
  // 把 Scene Graph 同步到运行时（增量更新）
  syncNode(node: Node, op: "add" | "update" | "remove"): void;
  syncAsset(asset: AssetReference): Promise<void>;

  // 获取运行时对象（供编辑器选中、变换控制器使用）
  getRuntimeObject(node_id: string): unknown;

  // 屏幕坐标 → 拾取节点
  pickAt(screen_x: number, screen_y: number): string | null;

  // === 代码导出 ===
  // 把整个项目导出为目标技术栈的工程代码
  exportProject(project: SceneProject, options: ExportOptions): Promise<ExportResult>;

  // 注册支持的行为类型
  getSupportedBehaviors(): BehaviorDefinition[];

  // 把行为参数翻译成目标技术栈的代码片段
  generateBehaviorCode(binding: BehaviorBinding, context: CodegenContext): string;
}

interface ExportResult {
  files: Map<string, string | Uint8Array>;  // 相对路径 → 内容
  warnings: string[];
}
```

### 4.2 Command 接口（撤销重做地基）

```typescript
interface Command {
  readonly id: string;
  readonly type: string;             // 例如 "node.transform.set"
  readonly timestamp: number;

  // 必须可序列化，所有参数都是纯数据
  readonly payload: Record<string, unknown>;

  apply(store: EditorStore): void;
  revert(store: EditorStore): void;

  // 用于合并（连续拖动只产生一个 undo 记录）
  canMergeWith(other: Command): boolean;
  mergeWith(other: Command): Command;
}
```

**为什么 Command 必须可序列化**：未来要支持 AI 调用（"AI，把灯往左移一点"）、宏录制、协作同步，全靠这一点。

### 4.3 AI Skill 接口

```typescript
interface Skill {
  readonly id: string;
  readonly name: string;
  readonly description: string;     // 给 LLM 看的：什么时候用这个 Skill

  // 这个 Skill 能调用哪些工具（限制 LLM 的能力边界）
  readonly allowed_tools: ToolName[];

  // 系统提示
  readonly system_prompt: string;

  // 输出 schema（让 LLM 返回结构化数据）
  readonly output_schema?: JSONSchema;

  // 少样本示例
  readonly examples?: Example[];

  // 执行
  execute(input: string, context: SkillContext): Promise<SkillResult>;
}

interface SkillContext {
  scene: SceneProject;
  memory: MemoryStore;
  call_tool: (name: ToolName, args: unknown) => Promise<unknown>;
}
```

---

## 五、四个地基级决策（已确认）

| 决策 | 选择 | 理由 |
|---|---|---|
| Scene Graph 格式 | 自定义 JSON，几何用 glTF | 灵活、可扩展，几何复用行业标准 |
| ID 体系 | Node 用 UUID v4，Asset 用 content-hash | 节点身份稳定，资源可去重缓存 |
| 行为脚本 | 预编译模板 | 导出代码干净，符合"二次开发"理念 |
| 项目持久化 | 文件夹 + 每个 Node 独立文件 | git 友好，协作冲突小 |

---

## 六、MVP 开发路线（建议 12-16 周）

### Phase 0：地基（3-4 周）
- [ ] Scene Graph 规范 + 类型定义 + 校验
- [ ] Command 系统 + 撤销重做
- [ ] IRuntimeAdapter 接口定义
- [ ] Tauri 项目初始化 + Rust 文件 I/O
- [ ] React 主界面骨架

**Phase 0 结束标志**：能创建空项目、加载/保存项目文件、UI 框架就位。

### Phase 1：Three.js 渲染与编辑（4-5 周）
- [ ] ThreeAdapter 完整实现（Scene Graph ↔ THREE.Scene）
- [ ] 视口渲染 + OrbitControls
- [ ] 节点拾取与选中
- [ ] TransformControls 集成（移动、旋转、缩放）
- [ ] 属性面板（编辑 transform、material 基本参数）
- [ ] 层级面板（树形 Node 结构）

**Phase 1 结束标志**：能在视口里看到模型、能选中、能用 gizmo 改变位置旋转缩放。

### Phase 2：资源导入与代码导出（3-4 周）
- [ ] 拖拽 .glb 文件到视口添加 Node
- [ ] 资源管线（Rust 端解析 glb、生成缩略图、存到 assets/）
- [ ] Three.js 代码模板（Vite 工程 + scene-setup.ts）
- [ ] 导出对话框（选目标路径、选模板）

**Phase 2 结束标志**：完成 MVP 的核心故事：开发者能加载模型、摆位置、导出 Three.js 工程并运行。

### Phase 3：打磨与发布（2-3 周）
- [ ] 快捷键完整支持
- [ ] 项目模板（new project from preset）
- [ ] 错误处理与用户提示
- [ ] 文档与示例工程
- [ ] GitHub 发布、README、demo 视频

**Phase 3 结束标志**：v0.1.0 可以发布到 GitHub，开发者能下载、安装、跑通完整流程。

---

## 七、后续版本路线（不在 MVP）

- **v0.2**：资源库（内置 + 用户上传），属性面板增强（材质编辑）
- **v0.3**：AI Skill 框架 + 自然语言操作（"添加一盏从右上方照射的灯"）
- **v0.4**：空间吸附（socket 系统，几何约束求解）
- **v0.5**：行为系统（auto-rotate、hover-highlight 等内置行为）
- **v1.0**：Babylon.js 适配器（验证多适配器架构）
- **v1.x**：R3F 适配器、Unity 导出

---

## 八、风险与缓解

| 风险 | 影响 | 缓解策略 |
|---|---|---|
| Scene Graph 规范设计错，后期改不动 | 高 | Phase 0 充分时间论证；参考 glTF / USD 设计 |
| 导出代码质量差，开发者用一次就走 | 高 | 早期就找 5 个真实 Three.js 开发者试用反馈 |
| Tauri 学习曲线 | 中 | 配合 AI 辅助；Rust 部分只做文件 I/O，能力边界清晰 |
| 性能：大场景下编辑器卡 | 中 | Scene Graph 同步用增量、不做全量重建；视口虚拟化 |
| 生态：没人写新适配器 | 中 | 把 scene-spec 抽成独立包；写完整的 adapter-guide 文档 |

---

## 九、下一步建议

1. **本周完成**：用 Tauri + React 起一个空项目，跑起来 "Hello World"，验证开发环境
2. **本月完成**：把 Scene Graph TypeScript 类型 + 校验函数写完整，连同一份完整的 JSON 示例项目
3. **2 个月内**：MVP Phase 0 + Phase 1（能看到模型、能选中、能变换）

这个文档本身是 v0.1，建议你边实现边迭代，发现哪些字段不够用、哪些接口设计错了，就回来修这份文档。文档先于代码、规范先于实现，是这种长期项目最重要的纪律。
