# 资源拖拽入视口 + 落点 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 从资源库卡片拖拽到 3D 视口，以 y=0 地面平面的 raycast 命中点作为新节点落点（覆盖 x/z、保留库项默认 y）；双击加节点行为不变；走 `AddNodeCommand` 可撤销。

**架构：** 自定义 pointer 拖拽（不用 HTML5 DnD —— Tauri 2 默认 `dragDropEnabled=true` 抑制 webview 内 `ondrop`）。三段状态独立、无竞争：(1) module 级 controller `asset-drag.ts` 记录候选并在移动 > 5px 时把 UI store 翻成 active drag；(2) `AssetDragGhost` 读 store + 本地 pointermove 渲染跟随光标的 DOM ghost；(3) `ThreeViewport` 的 window `pointerup` 在 canvas 内落点 raycast 地面、加节点、收尾。纯几何 (`screenToNdc`/`dropPositionFor`)、catalog 查找 (`findLibraryItem`)、adapter 地面 raycast (`raycastGroundPoint`) 全部 headless 单测。

**技术栈：** React 19 + zustand + Three.js（headless adapter 单测，无 WebGL）+ vitest/jsdom + react-i18next。

---

## 关键约束与 spec 偏差（实施前必读）

实施前已通读真实代码。spec（`docs/superpowers/specs/2026-06-08-asset-drag-into-viewport-design.md`）多处用「架构命名」而非真实路径/符号，**以下以本计划为准**：

1. **路径映射**（spec → 实际）：
   - `src/state/ui-store.ts` → **`src/services/ui/store.ts`**（导出 `useUIStore`）
   - `src/ui/editor/LibraryPanel.tsx` → **`src/ui/library/LibraryPanel.tsx`**
   - `src/ui/editor/EditorView.tsx` → **`src/ui/views/EditorView.tsx`**
   - `src/ui/editor/AssetDragGhost.tsx` → **`src/ui/library/AssetDragGhost.tsx`**（与 LibraryPanel 同目录，内聚于资源库 UI；偏离 spec 的 editor/ 目录，刻意为之）
   - `src/runtime/three/adapter.ts`、`src/services/library/catalog.ts`、`src/services/library/asset-drag.ts`、`src/lib/drop-helpers.ts` 与 spec 一致 ✓
2. **`item.icon` 是 `LucideIcon` 组件，不是 emoji**。spec §6.3 ghost 写 `{item.icon}`（当字符串渲染）是 bug。正确：`const Icon = item.icon; <Icon … />`（同 LibraryPanel `node-builders` 渲染卡片图标的写法）。
3. **没有 `useAssetStore`**。spec §6.3/§6.4 读 `useAssetStore((s)=>s.assets)` 不存在。资源列表在 scene store：**`useSceneStore.getState().project?.assets ?? []`**（LibraryPanel 也是这么取的）。
4. **`raycastGroundPoint` 可 headless 单测**，不止视觉验证。`adapter.test.ts` 已证明 `new ThreeAdapter()` 无 WebGL 即可构造相机/场景；地面 raycast 只用 camera + raycaster + `Plane.intersectPlane`，本计划补 2 个单测（spec §9 把它划到「视觉 only」偏保守）。
5. **`beginAssetDrag` 可 headless 单测**：jsdom 环境（`vite.config.ts` `environment:"jsdom"`），用 `window.dispatchEvent(new MouseEvent("pointermove",{clientX,clientY}))` 触发 window 监听（`PointerEvent extends MouseEvent`，`e.clientX` 可读）。
6. **落点后选中新节点**：双击路径 `addItem` 会 `setSelectedNodeId(node.id)`；drop 路径同样选中以保持一致（spec §6.4 漏了）。
7. 真实符号确认：adapter 私有字段 `viewportWidth`/`viewportHeight`/`raycaster`/`ndc` 都在；`camera` 公有可读；`pickAt` 的 NDC 写法 = `(x/w)*2-1, -((y/h)*2-1)`，`raycastGroundPoint` 复刻它（含 `camera.updateMatrixWorld(true)`）。runtime→`@/lib` import 合法（`asset-cache.ts` 已 `import {isTauri} from "@/lib/runtime"`，无 eslint 边界规则）。

---

## 文件结构

**新增**

| 文件                                      | 职责                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| `src/lib/drop-helpers.ts`                 | 纯函数 `screenToNdc` + `dropPositionFor`（无 DOM/Three 依赖）                |
| `src/lib/drop-helpers.test.ts`            | 上两者单测                                                                   |
| `src/services/library/asset-drag.ts`      | module 级拖拽发起 controller `beginAssetDrag`（5px 阈值 → `startAssetDrag`） |
| `src/services/library/asset-drag.test.ts` | controller 阈值/激活/取消单测                                                |
| `src/ui/library/AssetDragGhost.tsx`       | 拖拽中跟随光标的 DOM ghost（视觉验证，无单测）                               |

**修改**

| 文件                                   | 改动                                                                                         |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/services/library/catalog.ts`      | 加 `findLibraryItem(id, uploads)`                                                            |
| `src/services/library/catalog.test.ts` | `findLibraryItem` 单测（builtin / upload / 未知）                                            |
| `src/runtime/three/adapter.ts`         | 加 `GROUND_PLANE` 常量 + `groundHit` 字段 + `raycastGroundPoint` 方法 + import `screenToNdc` |
| `src/runtime/three/adapter.test.ts`    | `raycastGroundPoint` 命中 / 朝天回 null 单测                                                 |
| `src/services/ui/store.ts`             | 加 `assetDragItemId` + `startAssetDrag` / `endAssetDrag`                                     |
| `src/services/ui/store.test.ts`        | asset drag 状态 round-trip 单测                                                              |
| `src/ui/library/LibraryPanel.tsx`      | 卡片 `onPointerDown={beginAssetDrag}` + `draggable={false}`                                  |
| `src/ui/library/LibraryPanel.test.tsx` | pointerdown 触发 beginAssetDrag（mock）单测                                                  |
| `src/ui/views/EditorView.tsx`          | 挂 `<AssetDragGhost />`                                                                      |
| `src/ui/viewport/ThreeViewport.tsx`    | mount effect 内 window `pointerup` 落点处理 + cleanup                                        |
| `src/i18n/locales/en-US/editor.json`   | `library.add_hint` 文案加「drag」                                                            |
| `src/i18n/locales/zh-CN/editor.json`   | `library.add_hint` 文案加「拖入视口」                                                        |

**执行前提**：当前已在分支 `feat/asset-drag-into-viewport`（spec commit `75bdfd2` 已在）。无需新建 worktree/branch。任务 1→8 有依赖顺序（见各任务），任务 9 收口。

---

### 任务 1：纯函数 drop-helpers（screenToNdc + dropPositionFor）

无依赖。最先做，adapter（任务 4）与 ThreeViewport（任务 8）都引用。

**文件：**

- 创建：`src/lib/drop-helpers.ts`
- 测试：`src/lib/drop-helpers.test.ts`

- [ ] **步骤 1：编写失败的测试**

创建 `src/lib/drop-helpers.test.ts`：

```ts
import { describe, expect, it } from "vitest";

import { dropPositionFor, screenToNdc } from "./drop-helpers";

describe("screenToNdc", () => {
  it("maps the canvas center to the NDC origin", () => {
    expect(screenToNdc(50, 50, 100, 100)).toEqual([0, 0]);
  });
  it("maps the top-left corner to (-1, 1)", () => {
    expect(screenToNdc(0, 0, 100, 100)).toEqual([-1, 1]);
  });
  it("maps the bottom-right corner to (1, -1)", () => {
    expect(screenToNdc(100, 100, 100, 100)).toEqual([1, -1]);
  });
  it("maps each axis independently for a non-square viewport", () => {
    expect(screenToNdc(100, 75, 200, 100)).toEqual([0, -0.5]);
  });
});

describe("dropPositionFor", () => {
  it("takes x/z from the hit and keeps the default y", () => {
    expect(dropPositionFor([0, 0.5, 0], [3, 0, -2])).toEqual([3, 0.5, -2]);
  });
  it("keeps a light's authored height", () => {
    expect(dropPositionFor([0, 3, 0], [-1.5, 0, 4.2])).toEqual([-1.5, 3, 4.2]);
  });
  it("preserves negative hit coordinates", () => {
    expect(dropPositionFor([0, 1, 0], [-5, 0, -7])).toEqual([-5, 1, -7]);
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pnpm vitest run src/lib/drop-helpers.test.ts`
预期：FAIL —— 报 `Failed to resolve import "./drop-helpers"` / `screenToNdc is not a function`。

- [ ] **步骤 3：编写最少实现代码**

创建 `src/lib/drop-helpers.ts`：

```ts
/**
 * Pure geometry helpers for asset drag-and-drop placement. No Three.js / DOM
 * deps so they unit-test headlessly; the ThreeAdapter and ThreeViewport
 * consume them at drop time.
 */

/** Canvas-relative screen pixels → normalized device coords ([-1, 1], y up). */
export function screenToNdc(
  px: number,
  py: number,
  w: number,
  h: number,
): [number, number] {
  // y is `1 - …` rather than `-( … - 1)` so the canvas center maps to a clean
  // +0 instead of -0 — vitest's toEqual uses Object.is, where -0 !== 0.
  return [(px / w) * 2 - 1, 1 - (py / h) * 2];
}

/**
 * New node position from a ground-plane hit: take the hit's x/z, keep the
 * library item's default y. So a box lifted to y=0.5 still rests on the floor
 * (not half-buried) and a light keeps its authored height.
 */
export function dropPositionFor(
  defaultPos: readonly [number, number, number],
  hit: readonly [number, number, number],
): [number, number, number] {
  return [hit[0], defaultPos[1], hit[2]];
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`pnpm vitest run src/lib/drop-helpers.test.ts`
预期：PASS（7 个用例全绿）。

- [ ] **步骤 5：Commit**

```bash
git add src/lib/drop-helpers.ts src/lib/drop-helpers.test.ts
git commit -m "feat(drop): pure screenToNdc + dropPositionFor helpers (tested)"
```

---

### 任务 2：catalog.findLibraryItem

无依赖（用现有 `BUILTIN_LIBRARY_ITEMS` + `uploadLibraryItems`）。drop 时按 id 取回 `LibraryItem.makeNode`。

**文件：**

- 修改：`src/services/library/catalog.ts`（文件末尾追加导出函数）
- 测试：`src/services/library/catalog.test.ts`（追加 describe + 补 import）

- [ ] **步骤 1：编写失败的测试**

在 `src/services/library/catalog.test.ts`：把第 3 行的 import 改为带上 `findLibraryItem`，并在文件顶部 import 区加 `AssetReference` 类型：

```ts
import { BUILTIN_LIBRARY_ITEMS, findLibraryItem, uploadLibraryItems } from "./catalog";
import type { AssetReference } from "@/core/scene/types";
```

在 `describe("library catalog", () => { … })` 之后追加：

```ts
describe("findLibraryItem", () => {
  it("finds a builtin item by id", () => {
    const item = findLibraryItem("geo-box", []);
    expect(item?.id).toBe("geo-box");
    expect(item?.makeNode().data).toMatchObject({
      type: "mesh",
      geometry: { kind: "box" },
    });
  });

  it("finds an upload-derived item by its upload-* id", () => {
    const uploads: AssetReference[] = [
      {
        id: "a1",
        content_hash: "h",
        kind: "geometry",
        relative_path: "assets/h.glb",
        tags: [],
        description: "",
        source: { kind: "user_upload", original_filename: "chair.glb" },
      },
    ];
    const item = findLibraryItem("upload-a1", uploads);
    expect(item?.name).toBe("chair.glb");
    expect(item?.makeNode().data).toMatchObject({
      type: "prefab_instance",
      asset_id: "a1",
    });
  });

  it("returns undefined for an unknown id", () => {
    expect(findLibraryItem("nope", [])).toBeUndefined();
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pnpm vitest run src/services/library/catalog.test.ts`
预期：FAIL —— `findLibraryItem is not exported` / `is not a function`。

- [ ] **步骤 3：编写最少实现代码**

在 `src/services/library/catalog.ts` 文件末尾（`uploadLibraryItems` 之后）追加：

```ts
/**
 * Look up a library item by id across builtins + upload-derived items. Used by
 * drag-drop to recover the item (and its makeNode) at drop time, after only the
 * id was carried through the drag.
 */
export function findLibraryItem(
  id: string,
  uploads: AssetReference[],
): LibraryItem | undefined {
  return [...BUILTIN_LIBRARY_ITEMS, ...uploadLibraryItems(uploads)].find(
    (item) => item.id === id,
  );
}
```

（`AssetReference` 已在 catalog.ts 第 14 行 import，无需新增。）

- [ ] **步骤 4：运行测试验证通过**

运行：`pnpm vitest run src/services/library/catalog.test.ts`
预期：PASS（原有 + 新增 3 个用例全绿）。

- [ ] **步骤 5：Commit**

```bash
git add src/services/library/catalog.ts src/services/library/catalog.test.ts
git commit -m "feat(library): findLibraryItem lookup across builtins + uploads"
```

---

### 任务 3：UI store —— assetDragItemId + start/endAssetDrag

无依赖。controller（任务 5）、ghost（任务 6）、drop（任务 8）都读写它。

**文件：**

- 修改：`src/services/ui/store.ts`（接口 + 实现各加 3 项）
- 测试：`src/services/ui/store.test.ts`（追加 describe）

- [ ] **步骤 1：编写失败的测试**

在 `src/services/ui/store.test.ts` 末尾追加：

```ts
describe("useUIStore — asset drag (asset-drag-into-viewport)", () => {
  beforeEach(() => useUIStore.setState({ assetDragItemId: null }));

  it("defaults to null (no drag active)", () => {
    expect(useUIStore.getState().assetDragItemId).toBeNull();
  });

  it("startAssetDrag sets the id and endAssetDrag clears it", () => {
    useUIStore.getState().startAssetDrag("geo-box");
    expect(useUIStore.getState().assetDragItemId).toBe("geo-box");
    useUIStore.getState().endAssetDrag();
    expect(useUIStore.getState().assetDragItemId).toBeNull();
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pnpm vitest run src/services/ui/store.test.ts`
预期：FAIL —— `startAssetDrag is not a function`（且 TS 报缺字段）。

- [ ] **步骤 3：编写最少实现代码**

在 `src/services/ui/store.ts` 的 `interface UIState` 内（`consumeFocusRequest` 之后、`}` 之前）加：

```ts
  /** Library item id currently being drag-dropped into the viewport; null when
   *  no asset drag is active. Set once the pointer passes the drag threshold
   *  (services/library/asset-drag.ts), cleared on drop / cancel by the
   *  viewport's window pointerup. */
  assetDragItemId: string | null;
  startAssetDrag: (id: string) => void;
  endAssetDrag: () => void;
```

在 `create<UIState>((set) => ({ … }))` 实现里（`consumeFocusRequest: …` 之后）加：

```ts
  assetDragItemId: null,
  startAssetDrag: (assetDragItemId) => set({ assetDragItemId }),
  endAssetDrag: () => set({ assetDragItemId: null }),
```

- [ ] **步骤 4：运行测试验证通过**

运行：`pnpm vitest run src/services/ui/store.test.ts && pnpm typecheck`
预期：PASS + typecheck 0 error。

- [ ] **步骤 5：Commit**

```bash
git add src/services/ui/store.ts src/services/ui/store.test.ts
git commit -m "feat(ui-store): assetDragItemId + start/endAssetDrag"
```

---

### 任务 4：adapter.raycastGroundPoint + GROUND_PLANE

依赖任务 1（`screenToNdc`）。headless 单测。

**文件：**

- 修改：`src/runtime/three/adapter.ts`
- 测试：`src/runtime/three/adapter.test.ts`（追加 describe）

- [ ] **步骤 1：编写失败的测试**

在 `src/runtime/three/adapter.test.ts` 末尾追加（`target` 变量该文件已有）：

```ts
describe("ThreeAdapter.raycastGroundPoint", () => {
  it("hits the ground plane near the origin for a centered ray", () => {
    // Default camera sits at [4,3,4] looking at the origin, so the center ray
    // (NDC 0,0) crosses y=0 exactly at the origin.
    const adapter = new ThreeAdapter(target);
    adapter.setViewportSize(100, 100);
    const hit = adapter.raycastGroundPoint(50, 50);
    expect(hit).not.toBeNull();
    expect(hit![1]).toBeCloseTo(0, 5);
    expect(Math.hypot(hit![0], hit![2])).toBeLessThan(1e-4);
  });

  it("returns null when the camera faces away from the ground", () => {
    // Tilt up (above the horizon) but NOT straight up — a forward parallel to
    // the up vector makes lookAt degenerate (NaN basis). [0,5,3] tilts up
    // around x, so the center ray points above y=0 and never crosses it.
    const adapter = new ThreeAdapter(target, {
      defaultCamera: { position: [0, 1, 0], lookAt: [0, 5, 3] },
    });
    adapter.setViewportSize(100, 100);
    expect(adapter.raycastGroundPoint(50, 50)).toBeNull();
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pnpm vitest run src/runtime/three/adapter.test.ts -t raycastGroundPoint`
预期：FAIL —— `adapter.raycastGroundPoint is not a function`。

- [ ] **步骤 3：编写最少实现代码**

在 `src/runtime/three/adapter.ts`：

(a) import 区（顶部 `import * as THREE from "three";` 之后）加：

```ts
import { screenToNdc } from "@/lib/drop-helpers";
```

(b) 模块常量（放在 `const EXPORTERS … };` 之后、`export class ThreeAdapter` 之前）加：

```ts
/** Shared y=0 ground plane (normal +y) for drop raycasts. Module-level to
 *  avoid per-pick allocation. */
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
```

(c) 字段：在 `private readonly ndc = new THREE.Vector2();` 之后加：

```ts
  /** Reused target for raycastGroundPoint's plane intersection. */
  private readonly groundHit = new THREE.Vector3();
```

(d) 方法：在 `pickAt(...)` 方法结束的 `}` 之后、`// ───── Export ─────` 注释之前加：

```ts
  /**
   * Raycast the screen point `(screen_x, screen_y)` (viewport-pixel space)
   * against the y=0 ground plane. Returns the world-space hit `[x, y, z]`, or
   * null when the ray is parallel to / points away from the plane (camera
   * facing the sky). Mirrors pickAt's NDC + matrix-refresh setup so a drop
   * handled synchronously (before the next animation frame) still uses the
   * current camera pose.
   */
  raycastGroundPoint(
    screen_x: number,
    screen_y: number,
  ): [number, number, number] | null {
    if (this.viewportWidth <= 0 || this.viewportHeight <= 0) return null;
    this.camera.updateMatrixWorld(true);
    const [ndcX, ndcY] = screenToNdc(
      screen_x,
      screen_y,
      this.viewportWidth,
      this.viewportHeight,
    );
    this.ndc.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(GROUND_PLANE, this.groundHit);
    return hit ? [hit.x, hit.y, hit.z] : null;
  }
```

- [ ] **步骤 4：运行测试验证通过**

运行：`pnpm vitest run src/runtime/three/adapter.test.ts -t raycastGroundPoint && pnpm typecheck`
预期：PASS + typecheck 0 error。

- [ ] **步骤 5：Commit**

```bash
git add src/runtime/three/adapter.ts src/runtime/three/adapter.test.ts
git commit -m "feat(adapter): raycastGroundPoint — screen → y=0 world hit (tested)"
```

---

### 任务 5：asset-drag controller（beginAssetDrag）

依赖任务 3（store）。headless 单测（jsdom window 事件）。

**文件：**

- 创建：`src/services/library/asset-drag.ts`
- 测试：`src/services/library/asset-drag.test.ts`

- [ ] **步骤 1：编写失败的测试**

创建 `src/services/library/asset-drag.test.ts`：

```ts
import { beforeEach, describe, expect, it } from "vitest";

import { useUIStore } from "@/services/ui/store";

import { beginAssetDrag } from "./asset-drag";

function move(clientX: number, clientY: number) {
  window.dispatchEvent(new MouseEvent("pointermove", { clientX, clientY }));
}
function up() {
  window.dispatchEvent(new MouseEvent("pointerup", {}));
}

describe("beginAssetDrag", () => {
  beforeEach(() => useUIStore.setState({ assetDragItemId: null }));

  it("does not activate the drag below the 5px threshold", () => {
    beginAssetDrag("geo-box", 100, 100);
    move(103, 101); // ~3.2px
    expect(useUIStore.getState().assetDragItemId).toBeNull();
    up(); // cleanup
  });

  it("activates the drag once the pointer passes 5px", () => {
    beginAssetDrag("geo-box", 100, 100);
    move(110, 100); // 10px
    expect(useUIStore.getState().assetDragItemId).toBe("geo-box");
  });

  it("a release before the threshold tears down without activating", () => {
    beginAssetDrag("geo-box", 100, 100);
    up(); // plain click/double-click — no drag
    move(200, 200); // listeners removed → no late activation
    expect(useUIStore.getState().assetDragItemId).toBeNull();
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pnpm vitest run src/services/library/asset-drag.test.ts`
预期：FAIL —— `Failed to resolve import "./asset-drag"`。

- [ ] **步骤 3：编写最少实现代码**

创建 `src/services/library/asset-drag.ts`：

```ts
import { useUIStore } from "@/services/ui/store";

/**
 * Module-level drag-from-library controller. A library card calls
 * beginAssetDrag on pointerdown; we record a candidate and watch the pointer.
 * Only once it moves past DRAG_THRESHOLD_PX do we flip the UI store into a live
 * asset drag — so a plain click / double-click never flashes a ghost. After
 * activation this controller drops its own listeners; the drag is then owned by
 * AssetDragGhost (visual) + ThreeViewport (drop), which clear it via
 * endAssetDrag. Releasing before the threshold tears down quietly.
 */
const DRAG_THRESHOLD_PX = 5;

let candidate: { id: string; x: number; y: number } | null = null;
let onMove: ((e: PointerEvent) => void) | null = null;
let onUp: (() => void) | null = null;

export function beginAssetDrag(id: string, clientX: number, clientY: number): void {
  teardown(); // drop any stale candidate before starting a new one
  candidate = { id, x: clientX, y: clientY };
  onMove = (e) => {
    if (!candidate) return;
    const moved = Math.hypot(e.clientX - candidate.x, e.clientY - candidate.y);
    if (moved > DRAG_THRESHOLD_PX) {
      useUIStore.getState().startAssetDrag(candidate.id);
      teardown();
    }
  };
  onUp = () => teardown();
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function teardown(): void {
  if (onMove) window.removeEventListener("pointermove", onMove);
  if (onUp) window.removeEventListener("pointerup", onUp);
  candidate = null;
  onMove = null;
  onUp = null;
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`pnpm vitest run src/services/library/asset-drag.test.ts`
预期：PASS（3 个用例全绿）。

- [ ] **步骤 5：Commit**

```bash
git add src/services/library/asset-drag.ts src/services/library/asset-drag.test.ts
git commit -m "feat(library): asset-drag controller — 5px threshold activates drag"
```

---

### 任务 6：AssetDragGhost + 挂载到 EditorView

依赖任务 2（findLibraryItem）、任务 3（store）。无单测（DOM 位置/视觉 —— 任务 9 `pnpm tauri dev` 验证）。

**文件：**

- 创建：`src/ui/library/AssetDragGhost.tsx`
- 修改：`src/ui/views/EditorView.tsx`

- [ ] **步骤 1：编写组件**

创建 `src/ui/library/AssetDragGhost.tsx`：

```tsx
import { useEffect, useState } from "react";

import { findLibraryItem } from "@/services/library/catalog";
import { useSceneStore } from "@/services/scene/store";
import { useUIStore } from "@/services/ui/store";

/**
 * Cursor-following ghost shown while a library item is dragged into the
 * viewport. Reads the active drag id from the UI store and tracks the live
 * pointer in LOCAL state (not the store — pointermove is high-frequency and we
 * don't want to re-render unrelated subscribers). Renders nothing until the
 * pointer has moved at least once after activation, or if the id can't be
 * resolved (e.g. an upload removed mid-drag).
 */
export function AssetDragGhost() {
  const id = useUIStore((s) => s.assetDragItemId);
  const uploads = useSceneStore((s) => s.project?.assets);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!id) return;
    const onMove = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", onMove);
    // Reset position in cleanup (runs on drag end AND target switch) — not in
    // the effect body, which trips eslint react-hooks/set-state-in-effect.
    return () => {
      window.removeEventListener("pointermove", onMove);
      setPos(null);
    };
  }, [id]);

  if (!id || !pos) return null;
  const item = findLibraryItem(id, uploads ?? []);
  if (!item) return null;
  const Icon = item.icon;

  return (
    <div
      className="pointer-events-none fixed z-50 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border border-primary/60 bg-card/80 opacity-80 shadow-lg backdrop-blur-sm"
      style={{ left: pos.x, top: pos.y }}
      aria-hidden="true"
    >
      <Icon className="h-6 w-6 text-foreground/90" />
    </div>
  );
}
```

- [ ] **步骤 2：挂载到 EditorView**

在 `src/ui/views/EditorView.tsx`：import 区（`import { LibraryPanel } from "@/ui/library/LibraryPanel";` 旁）加：

```tsx
import { AssetDragGhost } from "@/ui/library/AssetDragGhost";
```

在 return 的根 `<div>` 末尾，把 `<ShortcutsHelpDialog />` 那行改为：

```tsx
      <ShortcutsHelpDialog />
      <AssetDragGhost />
    </div>
```

- [ ] **步骤 3：验证 typecheck + 既有测试不退化**

运行：`pnpm typecheck && pnpm vitest run src/ui`
预期：typecheck 0 error；UI 测试全绿（ghost 默认 `assetDragItemId=null` → 渲染 null，不影响任何现有用例）。

- [ ] **步骤 4：Commit**

```bash
git add src/ui/library/AssetDragGhost.tsx src/ui/views/EditorView.tsx
git commit -m "feat(library): AssetDragGhost cursor-following drag preview"
```

---

### 任务 7：LibraryPanel 卡片 pointerdown 接线 + i18n 文案

依赖任务 5（beginAssetDrag）。

**文件：**

- 修改：`src/ui/library/LibraryPanel.tsx`
- 修改：`src/ui/library/LibraryPanel.test.tsx`
- 修改：`src/i18n/locales/en-US/editor.json`、`src/i18n/locales/zh-CN/editor.json`

- [ ] **步骤 1：编写失败的测试**

在 `src/ui/library/LibraryPanel.test.tsx`：把新 import 与其他 import 放一起（顶部），再在**所有 import 之后**（`function seed` 之前）写 `vi.mock`。vitest 会把 `vi.mock` 提升到 import 之上，这样既能 mock 成功，又不违反 eslint `import/first`（import 必须在语句之前）：

```tsx
// 与现有 import 同组（顶部）：
import { beginAssetDrag } from "@/services/library/asset-drag";

// 所有 import 之后、function seed 之前：
vi.mock("@/services/library/asset-drag", () => ({
  beginAssetDrag: vi.fn(),
}));
```

在 `describe("LibraryPanel", …)` 的 `beforeEach` 里追加一行清 mock：

```tsx
vi.mocked(beginAssetDrag).mockClear();
```

在该 describe 内追加用例：

```tsx
it("pointer-down on a card begins an asset drag with the item id", () => {
  render(<LibraryPanel />);
  fireEvent.pointerDown(screen.getByText("Sphere"), { clientX: 12, clientY: 34 });
  expect(beginAssetDrag).toHaveBeenCalledTimes(1);
  expect(vi.mocked(beginAssetDrag).mock.calls[0]?.[0]).toBe("geo-sphere");
});
```

（只断言第一个实参 = id，避开 jsdom 对 pointer 事件 clientX 的差异。）

- [ ] **步骤 2：运行测试验证失败**

运行：`pnpm vitest run src/ui/library/LibraryPanel.test.tsx`
预期：FAIL —— `expected beginAssetDrag to be called` / `import "./asset-drag"`（卡片还没接 onPointerDown）。

- [ ] **步骤 3：接线 LibraryPanel**

在 `src/ui/library/LibraryPanel.tsx`：import 区（`import { ... } from "@/services/library/catalog";` 旁）加：

```tsx
import { beginAssetDrag } from "@/services/library/asset-drag";
```

找到卡片 `<button>`（`key={item.id}` `type="button"` `onDoubleClick={() => addItem(item)}` 那个），加两个属性（与 `onDoubleClick` 并列）：

```tsx
                      draggable={false}
                      onPointerDown={(e) => beginAssetDrag(item.id, e.clientX, e.clientY)}
```

- [ ] **步骤 4：更新 i18n 文案**

`src/i18n/locales/en-US/editor.json` —— `library.add_hint`：

```json
    "add_hint": "Double-click or drag into the viewport to add",
```

`src/i18n/locales/zh-CN/editor.json` —— `library.add_hint`：

```json
    "add_hint": "双击或拖入视口添加",
```

- [ ] **步骤 5：运行测试验证通过**

运行：`pnpm vitest run src/ui/library/LibraryPanel.test.tsx && pnpm typecheck`
预期：PASS（新增用例 + 既有「double-click 加节点」回归用例全绿）+ typecheck 0 error。

- [ ] **步骤 6：Commit**

```bash
git add src/ui/library/LibraryPanel.tsx src/ui/library/LibraryPanel.test.tsx src/i18n/locales/en-US/editor.json src/i18n/locales/zh-CN/editor.json
git commit -m "feat(library): card pointerdown starts drag; hint mentions drag"
```

---

### 任务 8：ThreeViewport 落点接收（window pointerup）

依赖任务 1（dropPositionFor）、2（findLibraryItem）、3（store）、4（raycastGroundPoint）。集成 capstone，无单测（WebGL + pointer）→ 任务 9 视觉验证。

**文件：**

- 修改：`src/ui/viewport/ThreeViewport.tsx`

- [ ] **步骤 1：补 import**

在 `src/ui/viewport/ThreeViewport.tsx` 顶部 import 区加：

```tsx
import { AddNodeCommand } from "@/core/command/commands/add-node";
import { dropPositionFor } from "@/lib/drop-helpers";
import { findLibraryItem } from "@/services/library/catalog";
```

（`executeCommand`、`useSceneStore`、`useUIStore` 已 import；`setSelectedNodeId` 已是 mount effect 闭包内变量。）

- [ ] **步骤 2：注册 window pointerup 落点处理**

在 mount effect 内，紧接 `canvas.addEventListener("click", onClick);`（约第 299 行）之后加：

```tsx
// Asset drag-drop: a library-card drag activates assetDragItemId (see
// services/library/asset-drag.ts). On release inside the canvas, raycast
// the y=0 ground plane and add the item there (falling back to the item's
// default position when the ray misses — camera facing the sky). Released
// outside the canvas or on a miss-with-no-item we still clear the drag.
// Bound on window (not canvas) so a release a few px past the canvas edge
// is still caught.
const onAssetDrop = (event: PointerEvent) => {
  const id = useUIStore.getState().assetDragItemId;
  if (!id) return; // not an asset drag
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
  if (inside) {
    const uploads = useSceneStore.getState().project?.assets ?? [];
    const item = findLibraryItem(id, uploads);
    if (item) {
      const node = item.makeNode();
      const hit = adapter.raycastGroundPoint(x, y);
      if (hit) {
        node.transform.position = dropPositionFor(node.transform.position, hit);
      }
      executeCommand(new AddNodeCommand({ node }));
      setSelectedNodeId(node.id);
    }
  }
  useUIStore.getState().endAssetDrag(); // clear whether dropped in/out
};
window.addEventListener("pointerup", onAssetDrop);
```

- [ ] **步骤 3：cleanup 注销**

在 mount effect 的 `return () => { … }` 里，紧接 `canvas.removeEventListener("pointerdown", onPointerDown);` 之后加：

```tsx
window.removeEventListener("pointerup", onAssetDrop);
```

- [ ] **步骤 4：验证 typecheck + 全量测试**

运行：`pnpm typecheck && pnpm vitest run`
预期：typecheck 0 error；全部测试绿（ThreeViewport 无新单测，但不得引入退化）。

- [ ] **步骤 5：Commit**

```bash
git add src/ui/viewport/ThreeViewport.tsx
git commit -m "feat(viewport): drop library item at ground raycast hit (undoable)"
```

---

### 任务 9：全量验证 + 视觉冒烟（不可跳过）

vitest 绿 ≠ 功能正确：拖拽全链路是 pointer + WebGL，jsdom 抓不到，必须真跑。

- [ ] **步骤 1：静态 + 单测全绿**

运行：`pnpm lint && pnpm typecheck && pnpm test`
预期：三者 0 error / 全绿。若 prettier 报 `editor.json` 格式，按 `pnpm lint` 提示修（或 `pnpm prettier -w` 仅对改动文件）后重跑。

- [ ] **步骤 2：`pnpm tauri dev` 视觉冒烟（对照 spec §2 Success criteria）**

运行：`pnpm tauri dev`，逐项确认：

1. 几何卡片（如 Box）按住拖动 > 5px → 出现半透明 ghost 跟随光标；canvas 内松手 → 落点处新增 Box，落点 = 地面交点 x/z、y 保持 0.5（坐落地面不半埋）。
2. 灯光卡片、上传 glb 同样可拖入；glb 落点 x/z 对、y 保留默认。
3. **纯双击**某卡片（不移动）→ 不闪 ghost、按默认位加节点（回归不破）。
4. 卡片拖到 **canvas 外** 松手 → 不加节点、ghost 消失。
5. 相机转到**朝天/与地面平行**再拖入 → raycast 未命中 → 仍加节点但用库项默认 position（等同双击）。
6. 拖入后 **Cmd/Ctrl+Z** → 撤销该节点（`AddNodeCommand` 生效）。
7. 落点后该节点**被选中**（properties 面板显示它）。

- [ ] **步骤 3：（可选）截图留档**

如需为 PR 留证据，截 ghost 跟随 + 落点结果各一张。

- [ ] **步骤 4：收尾**

全部通过后用 superpowers:finishing-a-development-branch 决定合并 / PR / 清理。PR 描述链接本 plan 与 spec，并在 `docs/roadmap.md` 把 v0.4「资源拖拽」对应 sub-stage 勾选 + 补 PR 链接（该勾选放 PR 内一并提交）。

---

## 自检

**1. 规格覆盖度（spec §2 / §3 / §10 逐条）：**

- `screenToNdc` / `dropPositionFor` 纯函数 + 单测 → 任务 1 ✓（spec §5.1、§9、success #5）
- `findLibraryItem` + 单测 → 任务 2 ✓（spec §5.2、§9、success #5）
- `assetDragItemId` + start/end → 任务 3 ✓（spec §5.3）
- `raycastGroundPoint` + GROUND_PLANE → 任务 4 ✓（spec §6.5；额外补单测）
- `beginAssetDrag` controller（5px 阈值、双击不触发）→ 任务 5 ✓（spec §6.1、success #2/#3；额外补单测）
- `AssetDragGhost`（跟随光标、pointer-events-none）→ 任务 6 ✓（spec §6.3、§8）
- LibraryCard `onPointerDown` + `draggable={false}` → 任务 7 ✓（spec §6.2）
- EditorView 挂 ghost → 任务 6 ✓（spec §10 修改清单）
- ThreeViewport window pointerup 落点（inside 判定、hit 回退、AddNodeCommand、endAssetDrag）→ 任务 8 ✓（spec §6.4、§7、success #1/#3/#4/#6）
- i18n `add_hint` 文案 → 任务 7 ✓（spec §8、§10）
- 全绿 + 视觉验证 → 任务 9 ✓（spec §2 success #6、§12）
- **Out of scope 守界**（spec §3）：不做物体表面落点 / 落点网格吸附 / 3D 预览 / OS file-drop / glb 底部对齐 —— 本计划均未触碰 ✓

**2. 占位符扫描：** 全任务每步均含完整可粘贴代码 + 精确命令 + 预期输出；无 TODO/待定/「类似任务 N」。✓

**3. 类型一致性：**

- `LibraryItem.icon: LucideIcon` → ghost 用 `const Icon = item.icon; <Icon/>`（非字符串）✓
- 资源列表统一 `useSceneStore…project?.assets`（无 `useAssetStore`）✓
- `findLibraryItem(id: string, uploads: AssetReference[])` 在任务 2 定义，任务 6/8 同签名调用 ✓
- `raycastGroundPoint(screen_x, screen_y): [number,number,number] | null` 任务 4 定义，任务 8 同形 ✓
- `startAssetDrag(id)/endAssetDrag()/assetDragItemId` 任务 3 定义，任务 5/6/8 一致 ✓
- `AddNodeCommand({ node })` 与现有构造签名一致（`AddNodeInput.node`）✓
- runtime→`@/lib` import 合法（已有先例）✓

发现即修，无遗留。

---

## 执行交接

计划已保存到 `docs/superpowers/plans/2026-06-08-asset-drag-into-viewport-plan.md`。两种执行方式：

1. **子代理驱动（推荐）** —— 每个任务调度一个新子代理，任务间两阶段审查，快速迭代。
2. **内联执行** —— 当前会话用 executing-plans 批量执行并设检查点。

任务 1–5、7 为机械 TDD（可并行度高、风险低）；任务 6、8 是 UI/集成（需任务 9 视觉验证兜底）。选哪种？
