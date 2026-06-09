import { describe, expect, it } from "vitest";
import { z } from "zod";

import type {
  BehaviorDefinition,
  CodegenContext,
  ExportOptions,
  ExportResult,
  IRuntimeAdapter,
  RuntimeNodeInfo,
  SyncOp,
} from "./adapter";
import type {
  AssetReference,
  BehaviorBinding,
  RuntimeTarget,
  SceneNode,
  SceneProject,
} from "@/core/scene/types";

/**
 * Minimal conformance fake. Its main purpose is to prove the IRuntimeAdapter
 * interface compiles into a real implementable shape — concrete adapters
 * (ThreeAdapter, BabylonAdapter, …) lean on the same surface.
 */
class NoopAdapter implements IRuntimeAdapter {
  readonly target: RuntimeTarget = {
    kind: "three.js",
    version: "0.164.0",
    module_format: "esm",
  };

  syncNode(_node: SceneNode, _op: SyncOp): void {}
  async syncAsset(_asset: AssetReference): Promise<void> {}
  getRuntimeObject(_node_id: string): unknown {
    return null;
  }
  describeNode(_node_id: string): RuntimeNodeInfo | null {
    return null;
  }
  pickAt(_screen_x: number, _screen_y: number): string | null {
    return null;
  }

  async exportProject(
    _project: SceneProject,
    _options: ExportOptions,
  ): Promise<ExportResult> {
    return { files: new Map(), warnings: [] };
  }

  getSupportedBehaviors(): BehaviorDefinition[] {
    return [
      {
        type: "auto-rotate",
        name: "Auto-Rotate",
        description: "Spin around the up axis at a given speed",
        parameters_schema: z.object({
          speed: z.number().default(1),
          axis: z.enum(["x", "y", "z"]).default("y"),
        }),
      },
    ];
  }

  generateBehaviorCode(_binding: BehaviorBinding, _context: CodegenContext): string {
    return "";
  }
}

describe("IRuntimeAdapter", () => {
  it("a noop implementation satisfies the interface and exposes target metadata", () => {
    const adapter: IRuntimeAdapter = new NoopAdapter();
    expect(adapter.target.kind).toBe("three.js");
  });

  it("exportProject resolves to a Map<string, …> + warnings[] shape", async () => {
    const adapter = new NoopAdapter();
    const result = await adapter.exportProject({} as SceneProject, {
      target: "vite",
    });
    expect(result.files).toBeInstanceOf(Map);
    expect(result.warnings).toEqual([]);
  });

  it("BehaviorDefinition.parameters_schema validates and applies defaults", () => {
    const adapter = new NoopAdapter();
    const [autoRotate] = adapter.getSupportedBehaviors();
    expect(autoRotate?.type).toBe("auto-rotate");
    const parsed = autoRotate?.parameters_schema.parse({});
    expect(parsed).toEqual({ speed: 1, axis: "y" });
  });

  it("pickAt returns null when the runtime can't find anything", () => {
    const adapter = new NoopAdapter();
    expect(adapter.pickAt(0, 0)).toBeNull();
  });
});
