import { create } from "zustand";

import type { SceneNodeSnapshot } from "@/core/scene/snapshot";
import type {
  AssetReference,
  BehaviorBinding,
  SceneGraph,
  SceneNode,
  SceneProject,
  Transform,
} from "@/core/scene/types";
import type { SceneEditorStore } from "@/core/command/types";

/**
 * Scene store — holds the live SceneProject the editor is operating on.
 *
 * Mutators always replace `project` with a structurally-new object (and a new
 * `scene.nodes` map, and a new SceneNode for the changed id) so React + zustand
 * subscribers can diff by identity. `updated_at` is bumped on every mutation.
 */
interface SceneState {
  project: SceneProject | null;
  setProject: (project: SceneProject | null) => void;
  /** Read a SceneNode by id, or undefined when there is no live project / no
   *  such node. Implements the `getNode` half of {@link SceneEditorStore}. */
  getNode: (id: string) => SceneNode | undefined;
  /** Replace a single node's transform. Mutates project / scene / node by
   *  identity so observers can diff. Implements the `setNodeTransform` half
   *  of {@link SceneEditorStore}. */
  setNodeTransform: (id: string, transform: Transform) => void;
  /** Append a SceneNode to the project. If `node.parent_id` is null, the node
   *  becomes a new root; otherwise it's appended to the parent's
   *  children_ids. The caller is responsible for ensuring node.id is unique
   *  and that any referenced parent already exists. */
  addNode: (node: SceneNode) => void;
  /** Add an AssetReference to project.assets[]. Deduplicates by content_hash
   *  — re-importing identical bytes returns silently without growing the
   *  manifest. Returns the canonical asset reference (existing or new). */
  addAsset: (asset: AssetReference) => AssetReference;
  /** Append a BehaviorBinding to the node. Throws on duplicate binding.id —
   *  callers (Commands) own id generation. */
  addBehavior: (nodeId: string, binding: BehaviorBinding) => void;
  /** Remove a BehaviorBinding by id. Silent no-op when the bindingId is not
   *  on the node — same shape as the Three.js adapter side. */
  removeBehavior: (nodeId: string, bindingId: string) => void;
  setBehaviorEnabled: (nodeId: string, bindingId: string, enabled: boolean) => void;
  setBehaviorParameters: (
    nodeId: string,
    bindingId: string,
    parameters: Record<string, unknown>,
  ) => void;
  /** Remove a node and every descendant; also drops the id from the parent's
   *  children_ids (or from scene.root_node_ids when the node is a root).
   *  Silent no-op when nodeId does not exist. Used by DeleteNodeCommand. */
  removeNodeSubtree: (nodeId: string) => void;
  /** Re-insert a previously captured subtree at snapshot.insert_index inside
   *  its parent's children_ids (or scene.root_node_ids). The caller owns the
   *  snapshot (typically taken just before removeNodeSubtree) so this is the
   *  symmetric revert path of DeleteNodeCommand. */
  restoreNodeSubtree: (snapshot: SceneNodeSnapshot) => void;
  /** Append a precomputed new-id subtree to the source node's parent's
   *  children_ids (or to scene.root_node_ids when source is a root). The
   *  caller is responsible for generating the new ids + copy name so the
   *  store stays a pure mutator. Used by DuplicateNodeCommand. */
  duplicateNode: (sourceNodeId: string, newSubtree: SceneNodeSnapshot) => void;
}

/**
 * Shared "replace one node + bump updated_at" reducer used by every per-node
 * mutator. Keeping this in one place means the structural-sharing contract
 * (new project, new scene, new nodes map, new SceneNode for the changed id)
 * can't drift between mutators.
 */
function mutateNode(
  s: SceneState,
  nodeId: string,
  nextNode: SceneNode,
): Partial<SceneState> | SceneState {
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

/**
 * Like mutateNode but lets the caller rewrite the whole nodes map +
 * root_node_ids atomically. Used by removeNodeSubtree / restoreNodeSubtree /
 * duplicateNode where one logical operation touches multiple nodes.
 */
function mutateScene(
  s: SceneState,
  patch: (scene: SceneGraph) => SceneGraph,
): Partial<SceneState> | SceneState {
  if (!s.project) return s;
  return {
    project: {
      ...s.project,
      metadata: {
        ...s.project.metadata,
        updated_at: new Date().toISOString(),
      },
      scene: patch(s.project.scene),
    },
  };
}

export const useSceneStore = create<SceneState>((set, get) => ({
  project: null,
  setProject: (project) => set({ project }),
  getNode: (id) => get().project?.scene.nodes[id],
  setNodeTransform: (id, transform) =>
    set((s) => {
      if (!s.project) return s;
      const node = s.project.scene.nodes[id];
      if (!node) return s;
      const nextNode: SceneNode = { ...node, transform };
      return mutateNode(s, id, nextNode);
    }),
  addNode: (node) =>
    set((s) => {
      if (!s.project) return s;
      if (s.project.scene.nodes[node.id]) {
        throw new Error(`addNode: node ${node.id} already exists`);
      }
      const parentId = node.parent_id;
      let nextNodes = { ...s.project.scene.nodes, [node.id]: node };
      let nextRootIds = s.project.scene.root_node_ids;
      if (parentId === null) {
        nextRootIds = [...nextRootIds, node.id];
      } else {
        const parent = nextNodes[parentId];
        if (!parent) {
          throw new Error(`addNode: parent ${parentId} not found for ${node.id}`);
        }
        nextNodes = {
          ...nextNodes,
          [parentId]: { ...parent, children_ids: [...parent.children_ids, node.id] },
        };
      }
      return {
        project: {
          ...s.project,
          metadata: {
            ...s.project.metadata,
            updated_at: new Date().toISOString(),
          },
          scene: {
            ...s.project.scene,
            nodes: nextNodes,
            root_node_ids: nextRootIds,
          },
        },
      };
    }),
  addAsset: (asset) => {
    const s = get();
    if (!s.project) return asset;
    const existing = s.project.assets.find(
      (a) => a.content_hash === asset.content_hash,
    );
    if (existing) return existing;
    set((cur) => {
      if (!cur.project) return cur;
      return {
        project: {
          ...cur.project,
          metadata: {
            ...cur.project.metadata,
            updated_at: new Date().toISOString(),
          },
          assets: [...cur.project.assets, asset],
        },
      };
    });
    return asset;
  },
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
      if (next.length === node.behaviors.length) return s;
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
  removeNodeSubtree: (nodeId) =>
    set((s) => {
      if (!s.project) return s;
      const root = s.project.scene.nodes[nodeId];
      if (!root) return s;
      // collect ids to remove via BFS
      const idsToRemove = new Set<string>();
      const queue: string[] = [nodeId];
      while (queue.length) {
        const id = queue.shift()!;
        if (idsToRemove.has(id)) continue;
        const n = s.project.scene.nodes[id];
        if (!n) continue;
        idsToRemove.add(id);
        queue.push(...n.children_ids);
      }
      return mutateScene(s, (scene) => {
        const nextNodes: Record<string, SceneNode> = {};
        for (const [id, n] of Object.entries(scene.nodes)) {
          if (idsToRemove.has(id)) continue;
          // also rewrite children_ids of the surviving parent to drop nodeId
          if (id === root.parent_id) {
            nextNodes[id] = {
              ...n,
              children_ids: n.children_ids.filter((c) => c !== nodeId),
            };
          } else {
            nextNodes[id] = n;
          }
        }
        const nextRootIds =
          root.parent_id === null
            ? scene.root_node_ids.filter((c) => c !== nodeId)
            : scene.root_node_ids;
        return { ...scene, nodes: nextNodes, root_node_ids: nextRootIds };
      });
    }),
  restoreNodeSubtree: (snapshot) =>
    set((s) => {
      if (!s.project) return s;
      return mutateScene(s, (scene) => {
        const nextNodes: Record<string, SceneNode> = { ...scene.nodes };
        nextNodes[snapshot.root.id] = snapshot.root;
        for (const d of snapshot.descendants) nextNodes[d.id] = d;
        let nextRootIds = scene.root_node_ids;
        if (snapshot.root.parent_id === null) {
          nextRootIds = [
            ...scene.root_node_ids.slice(0, snapshot.insert_index),
            snapshot.root.id,
            ...scene.root_node_ids.slice(snapshot.insert_index),
          ];
        } else {
          const parent = nextNodes[snapshot.root.parent_id];
          if (parent) {
            const nextChildren = [
              ...parent.children_ids.slice(0, snapshot.insert_index),
              snapshot.root.id,
              ...parent.children_ids.slice(snapshot.insert_index),
            ];
            nextNodes[snapshot.root.parent_id] = {
              ...parent,
              children_ids: nextChildren,
            };
          }
        }
        return { ...scene, nodes: nextNodes, root_node_ids: nextRootIds };
      });
    }),
  duplicateNode: (sourceNodeId, newSubtree) =>
    set((s) => {
      if (!s.project) return s;
      const source = s.project.scene.nodes[sourceNodeId];
      if (!source) return s;
      return mutateScene(s, (scene) => {
        const nextNodes: Record<string, SceneNode> = { ...scene.nodes };
        nextNodes[newSubtree.root.id] = newSubtree.root;
        for (const d of newSubtree.descendants) nextNodes[d.id] = d;
        let nextRootIds = scene.root_node_ids;
        if (newSubtree.root.parent_id === null) {
          nextRootIds = [...scene.root_node_ids, newSubtree.root.id];
        } else {
          const parent = nextNodes[newSubtree.root.parent_id];
          if (parent) {
            nextNodes[newSubtree.root.parent_id] = {
              ...parent,
              children_ids: [...parent.children_ids, newSubtree.root.id],
            };
          }
        }
        return { ...scene, nodes: nextNodes, root_node_ids: nextRootIds };
      });
    }),
}));

/**
 * Adapter that exposes `useSceneStore`'s current state as the narrow
 * {@link SceneEditorStore} interface Commands consume. Re-reads the latest
 * state on every call so the editor sees the freshest values even mid-merge.
 */
export function getSceneEditorStore(): SceneEditorStore {
  return {
    getNode: (id) => useSceneStore.getState().getNode(id),
    setNodeTransform: (id, transform) =>
      useSceneStore.getState().setNodeTransform(id, transform),
    addBehavior: (nodeId, binding) =>
      useSceneStore.getState().addBehavior(nodeId, binding),
    removeBehavior: (nodeId, bindingId) =>
      useSceneStore.getState().removeBehavior(nodeId, bindingId),
    setBehaviorEnabled: (nodeId, bindingId, enabled) =>
      useSceneStore.getState().setBehaviorEnabled(nodeId, bindingId, enabled),
    setBehaviorParameters: (nodeId, bindingId, parameters) =>
      useSceneStore.getState().setBehaviorParameters(nodeId, bindingId, parameters),
    removeNodeSubtree: (nodeId) => useSceneStore.getState().removeNodeSubtree(nodeId),
    restoreNodeSubtree: (snapshot) =>
      useSceneStore.getState().restoreNodeSubtree(snapshot),
    duplicateNode: (sourceNodeId, newSubtree) =>
      useSceneStore.getState().duplicateNode(sourceNodeId, newSubtree),
  };
}
