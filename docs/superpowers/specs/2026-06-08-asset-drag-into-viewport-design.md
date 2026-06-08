# 资源拖拽入视口 + 落点 设计

**状态**: 已批准（2026-06-08）
**前置**: v0.2 资源库（#29）—— `LibraryPanel` 双击卡片 `executeCommand(new AddNodeCommand({ node: item.makeNode() }))`；`catalog.ts` 的 `BUILTIN_LIBRARY_ITEMS`（4 几何 + 4 灯光）+ `uploadLibraryItems(assets)`（从 user_upload 派生）+ `LibraryItem.makeNode()`（每次新 uuid，几何 `position:[0,0.5,0]`、灯光给固定空中位）。v0.4 sub-stage A 网格吸附（#33）+ B 节点对齐吸附（#34）已合并。
**定位**: 从 v0.2 资源库拆出的 Backlog 项，用户定的顺序：排在 v0.4 sub-stage B（#34）之后、sub-stage C（Socket）之前。
**架构依据**: 架构 §6 资源库交互 —— MVP 自定义。

---

## 1. 目标

从资源库卡片**拖拽**到视口，以 raycast 命中 **y=0 地面平面**的点作为新节点的落点（覆盖 position 的 x/z、保留库项默认 y）。现有**双击**加节点（默认位置）保留不变。

## 2. Success criteria

1. 从库卡片 `pointerdown` 拖动（移动 > 5px 激活），半透明 ghost 跟随光标；在 canvas 内 `pointerup` → 在落点新增对应节点（落点 = 地面 y=0 交点的 x/z + 库项默认 y）。
2. 全部库项（几何 / 灯光 / 上传 glb）可拖；**双击行为保留**（纯双击不移动 → 不触发拖拽 → 仍按默认位加节点）。
3. canvas 外释放 → 取消（不加节点，ghost 消失）；raycast 未命中（相机朝天 / 平行地面）→ 回退库项默认 position（仍加节点，等同双击效果）。
4. 拖入走 `AddNodeCommand` → 可撤销（与双击一致）。
5. 纯函数 `screenToNdc` / `dropPositionFor` / `findLibraryItem` 单测绿。
6. `pnpm lint && pnpm typecheck && pnpm test` 全绿 + `pnpm tauri dev` 视觉验证。

## 3. 范围

### In scope

- 纯函数 `src/lib/drop-helpers.ts`：`screenToNdc` + `dropPositionFor`。
- `src/services/library/catalog.ts`：`findLibraryItem(id, uploads)`。
- `src/runtime/three/adapter.ts`：`raycastGroundPoint(x, y)`（屏幕坐标 → y=0 平面世界交点 | null）。
- `src/state/ui-store.ts`：`assetDragItemId` + `startAssetDrag` / `endAssetDrag`。
- `src/services/library/asset-drag.ts`：拖拽发起 controller（候选 → 5px 阈值激活 → 调 `startAssetDrag`）。
- `src/ui/editor/AssetDragGhost.tsx`：拖拽中 ghost（fixed 跟随光标）。
- `src/ui/editor/LibraryPanel.tsx`：`LibraryCard` 加 `onPointerDown`（双击不动）。
- `src/ui/viewport/ThreeViewport.tsx`：`window pointerup` 落点接收（拖拽中 & canvas 内 → 加节点 + 收尾）。
- library i18n 提示文案。

### Out of scope（延后 / roadmap Backlog）

1. **命中物体表面落点**（放物体顶上）—— 本期只 y=0 地面平面；堆叠交给落地后 gizmo + #34 节点对齐吸附。
2. **落点网格吸附** —— 本期落点自由；吸附是落地后 gizmo 阶段的事（v0.4a 已覆盖）。
3. **3D 落点预览**（半透明 mesh 实时跟落点）—— 本期只 DOM ghost；3D 预览 / 落点指示圈延后（Smart Guides 类优化）。
4. **从 OS 拖文件进编辑器导入** —— 需 `dragDropEnabled`（本期用 pointer 拖拽不动该配置，保留未来该能力）。
5. glb 落点的 bbox 底部对齐（避免半埋）—— 本期统一「覆盖 x/z、保留默认 y」，glb 可能半埋，落地后 gizmo 调。

## 4. 关键约束（探索发现）

`src-tauri/tauri.conf.json` 的 `app.windows[]` **未设** `dragDropEnabled` → Tauri 2 默认 `true`，会抑制 webview 内 HTML5 `ondrop` DOM 事件。故**不走 HTML5 DnD**，改**自定义 pointer 拖拽**（不动 tauri.conf、与现有 pointer 体系一致、ghost 顺手、保留未来 OS file-drop）。

## 5. 数据模型 / 类型

### 5.1 纯函数（`src/lib/drop-helpers.ts`）

```ts
/** 相对 canvas 的屏幕像素 → NDC（[-1,1]，y 向上）。 */
export function screenToNdc(
  px: number,
  py: number,
  w: number,
  h: number,
): [number, number] {
  return [(px / w) * 2 - 1, -((py / h) * 2 - 1)];
}

/** 落点世界坐标 → 新节点 position：覆盖 x/z，保留库项默认 y
 *  （box 坐落点的地面不半埋；灯光保留空中默认高度）。 */
export function dropPositionFor(
  defaultPos: readonly [number, number, number],
  hit: readonly [number, number, number],
): [number, number, number] {
  return [hit[0], defaultPos[1], hit[2]];
}
```

### 5.2 catalog（`src/services/library/catalog.ts`）

```ts
/** 按 id 在 builtin + upload 派生项里查 LibraryItem（drop 时取回 makeNode）。 */
export function findLibraryItem(
  id: string,
  uploads: AssetReference[],
): LibraryItem | undefined {
  return [...BUILTIN_LIBRARY_ITEMS, ...uploadLibraryItems(uploads)].find(
    (i) => i.id === id,
  );
}
```

### 5.3 ui-store（`src/state/ui-store.ts`）

```ts
assetDragItemId: string | null;        // 拖拽激活中的库项 id（null = 无拖拽）
startAssetDrag: (id: string) => void;  // 设 assetDragItemId
endAssetDrag: () => void;              // 置 null
```

## 6. 架构 / 组件（职责 + 数据流）

### 6.1 拖拽发起 controller（`src/services/library/asset-drag.ts`）

module-level，把"按下卡片 → 移动超阈值才算拖拽"与双击区分开（与 canvas click-vs-drag 5px 守卫一致，避免纯双击闪 ghost）：

```ts
let candidate: { id: string; x: number; y: number } | null = null;
let onMove: ((e: PointerEvent) => void) | null = null;
let onUp: (() => void) | null = null;

/** LibraryCard pointerdown 调用：记候选 + 监听，移动 > 5px 激活拖拽。 */
export function beginAssetDrag(id: string, clientX: number, clientY: number) {
  candidate = { id, x: clientX, y: clientY };
  onMove = (e) => {
    if (!candidate) return;
    if (Math.hypot(e.clientX - candidate.x, e.clientY - candidate.y) > 5) {
      useUIStore.getState().startAssetDrag(candidate.id);
      teardown(); // 激活后撤候选监听；ghost + ThreeViewport 接管
    }
  };
  onUp = () => teardown(); // 未超阈值就松手（纯双击）→ 不激活，dblclick 正常
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function teardown() {
  if (onMove) window.removeEventListener("pointermove", onMove);
  if (onUp) window.removeEventListener("pointerup", onUp);
  candidate = null;
  onMove = null;
  onUp = null;
}
```

激活后 controller 不再持有监听；收尾（`endAssetDrag`）统一由 ThreeViewport 的 `pointerup` 负责（§6.4）——两处状态独立（controller 的 module 候选 vs store 的 `assetDragItemId`），无竞争。

### 6.2 LibraryCard（`src/ui/editor/LibraryPanel.tsx`）

```tsx
<button
  type="button"
  draggable={false}            // 防原生 DnD 干扰 pointer 拖拽
  onPointerDown={(e) => beginAssetDrag(item.id, e.clientX, e.clientY)}
  onDoubleClick={() => onActivate(item)}  // 保留
  ...
>
```

### 6.3 AssetDragGhost（`src/ui/editor/AssetDragGhost.tsx`，挂 EditorView 根）

```tsx
export function AssetDragGhost() {
  const id = useUIStore((s) => s.assetDragItemId);
  const uploads = useAssetStore((s) => s.assets);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!id) return;
    const onMove = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [id]);
  if (!id || !pos) return null;
  const item = findLibraryItem(id, uploads);
  if (!item) return null;
  return (
    <div
      className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-primary/60 bg-card/80 px-3 py-2 text-2xl opacity-80 shadow-lg"
      style={{ left: pos.x, top: pos.y }}
      aria-hidden
    >
      {item.icon}
    </div>
  );
}
```

### 6.4 ThreeViewport 落点接收（`src/ui/viewport/ThreeViewport.tsx`，mount effect 内）

```ts
const onWindowPointerUp = (e: PointerEvent) => {
  const id = useUIStore.getState().assetDragItemId;
  if (!id) return; // 非拖拽释放
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
  if (inside) {
    const item = findLibraryItem(id, useAssetStore.getState().assets);
    if (item) {
      const node = item.makeNode();
      const hit = adapter.raycastGroundPoint(x, y);
      if (hit) node.transform.position = dropPositionFor(node.transform.position, hit);
      executeCommand(new AddNodeCommand({ node }));
    }
  }
  useUIStore.getState().endAssetDrag(); // canvas 内外都收尾
};
window.addEventListener("pointerup", onWindowPointerUp);
// cleanup: window.removeEventListener("pointerup", onWindowPointerUp);
```

### 6.5 adapter（`src/runtime/three/adapter.ts`）

```ts
/** 屏幕坐标（相对 canvas）→ y=0 地面平面世界交点；未命中（相机朝天/平行）→ null。
 *  复用 pickAt 的 viewport 尺寸 + updateMatrixWorld 模式。 */
raycastGroundPoint(x: number, y: number): [number, number, number] | null {
  const [ndcX, ndcY] = screenToNdc(x, y, this.viewportWidth, this.viewportHeight);
  this.camera.updateMatrixWorld(true);
  this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
  const target = new THREE.Vector3();
  const hit = this.raycaster.ray.intersectPlane(GROUND_PLANE, target); // Plane(normal=(0,1,0), const=0)
  return hit ? [target.x, target.y, target.z] : null;
}
```

（`GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)` 模块常量；`screenToNdc` 自 `@/lib/drop-helpers`〔runtime→lib 合法方向〕；`viewportWidth/Height` + `raycaster` 字段名以 adapter 现状为准〔plan 阶段读 `pickAt` 确认〕。）

### 6.6 数据流

```
LibraryCard pointerdown
  → beginAssetDrag(id, x, y)            [asset-drag.ts: 候选 + 监听]
  → (移动 > 5px) startAssetDrag(id)     [ui-store: assetDragItemId 置位]
  → AssetDragGhost 跟随光标             [读 store + window pointermove]
  → canvas 内 pointerup                 [ThreeViewport window listener]
      → screenToNdc → raycastGroundPoint(x,y)
      → dropPositionFor(makeNode 默认 pos, hit)   (hit=null → 保留默认 pos)
      → executeCommand(AddNodeCommand{node})       [可撤销]
      → endAssetDrag()
  → canvas 外 pointerup → 仅 endAssetDrag（不加节点）
纯双击（不移动）→ asset-drag teardown，store 始终 null → ThreeViewport 跳过 → onDoubleClick 正常加默认位节点
```

## 7. 边界 / 错误处理

- canvas 外释放 → `inside=false` → 不加节点，`endAssetDrag` 清状态、ghost 消失。
- `raycastGroundPoint` 未命中 → `null` → 不改 position（保留 `makeNode` 默认）→ 仍 `AddNodeCommand`（友好回退，等同双击）。
- 灯光 / glb 同规则：落点覆盖 x/z、保留默认 y（灯保留空中高度；glb 可能半埋，落地后 gizmo+#34 调）。
- 拖拽中切到非编辑器视图（极端边界）：ThreeViewport 卸载，window pointerup 随 effect cleanup 移除。MVP **不特殊处理**——靠下次 pointerup / 视图切换重置兜底；若 ghost 残留成问题，再在 EditorView 卸载时调 `endAssetDrag`。
- `draggable={false}` 防浏览器原生图片/文本 DnD 抢 pointer。
- upload 项 id 在 `uploads` 变化时：drop 时按当前 `useAssetStore.getState().assets` 重新 `findLibraryItem`，查不到则不加（安全跳过）。

## 8. 视觉反馈

- 拖拽中：DOM ghost（库项 emoji + 卡片样式，半透明，`pointer-events:none`，fixed 跟光标）。
- 落点指示（地面圈/十字）/ 3D 预览 **延后**（Out of scope 3）。
- library 提示文案：`hint` 改「双击或拖拽到视口添加」。

## 9. 测试策略

- `drop-helpers.test.ts`：`screenToNdc`（中心→[0,0]、四角、非方形 w≠h）；`dropPositionFor`（覆盖 x/z、保留默认 y；负坐标）。
- `catalog.test.ts` 增：`findLibraryItem` 命中 builtin（如 `geo-box`）、命中 upload 派生项、未知 id → undefined。
- `raycastGroundPoint`（three raycast）/ `beginAssetDrag`（window 事件 + 阈值）/ ghost / ThreeViewport 落点（pointer + WebGL）→ `pnpm tauri dev` 视觉验证（vitest 无 WebGL/pointer，抓不到）。

## 10. 文件清单

**新增**：

- `src/lib/drop-helpers.ts` + `drop-helpers.test.ts`
- `src/services/library/asset-drag.ts`
- `src/ui/editor/AssetDragGhost.tsx`

**修改**：

- `src/services/library/catalog.ts`（`findLibraryItem` + `catalog.test.ts`）
- `src/runtime/three/adapter.ts`（`raycastGroundPoint` + `GROUND_PLANE`）
- `src/state/ui-store.ts`（`assetDragItemId` + actions）
- `src/ui/editor/LibraryPanel.tsx`（`LibraryCard` onPointerDown + draggable=false）
- `src/ui/editor/EditorView.tsx`（挂 `<AssetDragGhost />`）
- `src/ui/viewport/ThreeViewport.tsx`（window pointerup 落点）
- library i18n（en + zh `hint` 文案）

## 11. 风险 / 延后

- pointer 拖拽与 gizmo / orbit 的 pointer 事件共存：拖拽发起在库卡片（视口外），激活后只读 store + window pointerup；不与 canvas 内 gizmo/orbit 的 pointerdown 冲突（落点只在 `assetDragItemId` 非空时处理）。
- 高频 `pointermove`：ghost 用组件局部 state（不进 store，避免无关 re-render）。
- 物体表面落点 / 落点吸附 / 3D 预览 / OS file-drop / glb 底部对齐 → roadmap Backlog。

## 12. 验收

满足 §2：库卡片拖入视口、ghost 跟随、落点 = 地面 x/z + 默认 y、双击保留、canvas 外取消、未命中回退、可撤销 + 纯函数单测绿 + 视觉验证。下一步：v0.4 sub-stage C（Socket 系统）。
