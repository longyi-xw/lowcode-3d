import { describe, expect, it } from "vitest";

import type { AssetReference } from "@/core/scene/types";

import { BUILTIN_LIBRARY_ITEMS, findLibraryItem, uploadLibraryItems } from "./catalog";

describe("library catalog", () => {
  it("has the 4 geometry primitives + 4 light presets as builtins", () => {
    const ids = BUILTIN_LIBRARY_ITEMS.map((i) => i.id);
    for (const g of ["geo-box", "geo-sphere", "geo-plane", "geo-cylinder"])
      expect(ids).toContain(g);
    for (const l of ["light-directional", "light-point", "light-spot", "light-ambient"])
      expect(ids).toContain(l);
  });

  it("geometry makeNode produces a mesh node with the right kind + fresh id", () => {
    const item = BUILTIN_LIBRARY_ITEMS.find((i) => i.id === "geo-sphere")!;
    const n1 = item.makeNode();
    const n2 = item.makeNode();
    expect(n1.id).not.toBe(n2.id);
    expect(n1.type).toBe("mesh");
    expect(n1.data).toMatchObject({ type: "mesh", geometry: { kind: "sphere" } });
    // Lifted half a unit so the primitive sits *on* the ground grid (y=0)
    // instead of being half-buried under it.
    expect(n1.transform.position).toEqual([0, 0.5, 0]);
  });

  it("light makeNode produces a light node with the right light_kind", () => {
    const item = BUILTIN_LIBRARY_ITEMS.find((i) => i.id === "light-point")!;
    const node = item.makeNode();
    expect(node.type).toBe("light");
    expect(node.data).toMatchObject({ type: "light", light_kind: "point" });
  });

  it("uploadLibraryItems derives items only from user_upload assets", () => {
    const items = uploadLibraryItems([
      {
        id: "a1",
        content_hash: "h",
        kind: "geometry",
        relative_path: "assets/h.glb",
        tags: [],
        description: "",
        source: { kind: "user_upload", original_filename: "chair.glb" },
      },
      {
        id: "b1",
        content_hash: "h2",
        kind: "geometry",
        relative_path: "assets/h2.glb",
        tags: [],
        description: "",
        source: { kind: "builtin", library_id: "x" },
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]!.name).toBe("chair.glb");
    expect(items[0]!.makeNode().data).toMatchObject({
      type: "prefab_instance",
      asset_id: "a1",
    });
  });
});

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
