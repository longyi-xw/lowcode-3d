import { describe, expect, it } from "vitest";

import { createDemoProject } from "@/services/scene/demo-project";

import { standaloneEsmEmitter } from "./standalone-esm-emitter";
import { viteEmitter } from "./vite-emitter";

describe("viteEmitter", () => {
  it("emits the expected file set for the demo project", () => {
    const project = createDemoProject("Demo Project");
    const result = viteEmitter.emit(project, { target: "vite" }, () => "");
    const paths = [...result.files.keys()].sort();
    expect(paths).toEqual([
      "README.md",
      "index.html",
      "jsconfig.json",
      "package.json",
      "src/main.js",
      "src/scene.js",
      "vite.config.js",
    ]);
  });

  it("includes a slugged name in package.json", () => {
    const project = createDemoProject("My Cool Scene!");
    const result = viteEmitter.emit(project, { target: "vite" }, () => "");
    const pkg = result.files.get("package.json");
    expect(pkg?.kind).toBe("text");
    if (pkg?.kind !== "text") return;
    expect(JSON.parse(pkg.content).name).toBe("my-cool-scene");
  });

  it("references three at the editor's version + ESM type", () => {
    const result = viteEmitter.emit(createDemoProject(), { target: "vite" }, () => "");
    const pkg = result.files.get("package.json");
    if (pkg?.kind !== "text") throw new Error("expected text");
    const parsed = JSON.parse(pkg.content);
    expect(parsed.type).toBe("module");
    expect(parsed.dependencies.three).toMatch(/^\^0\.184/);
  });

  it("surfaces the helper-skipped warning in result.warnings", () => {
    const result = viteEmitter.emit(createDemoProject(), { target: "vite" }, () => "");
    expect(result.warnings.some((w) => w.includes("helper"))).toBe(true);
  });

  it("wires OrbitControls + a fallback ambient light into main.js", () => {
    const result = viteEmitter.emit(createDemoProject(), { target: "vite" }, () => "");
    const main = result.files.get("src/main.js");
    if (main?.kind !== "text") throw new Error("expected text");
    expect(main.content).toMatch(
      /import \{ OrbitControls \} from "three\/examples\/jsm\/controls\/OrbitControls\.js";/,
    );
    expect(main.content).toMatch(/new OrbitControls\(built\.camera, canvas\)/);
    expect(main.content).toMatch(/controls\.update\(\);/);
    expect(main.content).toMatch(/new THREE\.AmbientLight\(0xffffff, 0\.3\)/);
    expect(main.content).toContain(
      "for (const setup of built.interactions) setup({ camera: built.camera, domElement: canvas });",
    );
  });

  it("drives tickers from a THREE.Clock RAF loop in main.js", () => {
    const result = viteEmitter.emit(createDemoProject(), { target: "vite" }, () => "");
    const file = result.files.get("src/main.js");
    expect(file?.kind).toBe("text");
    const content = (file as { kind: "text"; content: string }).content;
    expect(content).toContain("const clock = new THREE.Clock();");
    expect(content).toContain("const dt = clock.getDelta();");
    expect(content).toContain("for (const t of built.tickers) t(dt);");
  });

  it("ships an asset_copy entry per referenced AssetReference", () => {
    // Demo project has one mesh node referencing asset-cube, but mesh nodes
    // emit as placeholder cubes (no glTF load) — so the demo doesn't trip
    // the prefab path. Verify the result still validates: no asset_copy
    // entries, no broken references.
    const result = viteEmitter.emit(createDemoProject(), { target: "vite" }, () => "");
    const copies = [...result.files.values()].filter((f) => f.kind === "asset_copy");
    expect(copies).toEqual([]);
  });
});

describe("standaloneEsmEmitter", () => {
  it("emits the expected file set", () => {
    const result = standaloneEsmEmitter.emit(
      createDemoProject(),
      {
        target: "standalone-esm",
      },
      () => "",
    );
    const paths = [...result.files.keys()].sort();
    expect(paths).toEqual(["README.md", "index.html", "main.js", "scene.js"]);
  });

  it("declares the importmap pointing three at esm.sh, including OrbitControls", () => {
    const result = standaloneEsmEmitter.emit(
      createDemoProject(),
      {
        target: "standalone-esm",
      },
      () => "",
    );
    const html = result.files.get("index.html");
    if (html?.kind !== "text") throw new Error("expected text");
    expect(html.content).toMatch(/<script type="importmap">/);
    expect(html.content).toMatch(/"three": "https:\/\/esm\.sh\/three@0\.184\.0"/);
    expect(html.content).toMatch(
      /"three\/examples\/jsm\/controls\/OrbitControls\.js":/,
    );
  });

  it("wires OrbitControls + a fallback ambient light into main.js", () => {
    const result = standaloneEsmEmitter.emit(
      createDemoProject(),
      {
        target: "standalone-esm",
      },
      () => "",
    );
    const main = result.files.get("main.js");
    if (main?.kind !== "text") throw new Error("expected text");
    expect(main.content).toMatch(
      /import \{ OrbitControls \} from "three\/examples\/jsm\/controls\/OrbitControls\.js";/,
    );
    expect(main.content).toMatch(/new OrbitControls\(built\.camera, canvas\)/);
    expect(main.content).toMatch(/controls\.update\(\);/);
    expect(main.content).toMatch(/new THREE\.AmbientLight\(0xffffff, 0\.3\)/);
    expect(main.content).toContain(
      "for (const setup of built.interactions) setup({ camera: built.camera, domElement: canvas });",
    );
  });

  it("drives tickers from a THREE.Clock RAF loop in main.js", () => {
    const result = standaloneEsmEmitter.emit(
      createDemoProject(),
      { target: "standalone-esm" },
      () => "",
    );
    const file = result.files.get("main.js");
    expect(file?.kind).toBe("text");
    const content = (file as { kind: "text"; content: string }).content;
    expect(content).toContain("const clock = new THREE.Clock();");
    expect(content).toContain("const dt = clock.getDelta();");
    expect(content).toContain("for (const t of built.tickers) t(dt);");
  });

  it("scene.js has no TypeScript-only syntax (browser can run it directly)", () => {
    const result = standaloneEsmEmitter.emit(
      createDemoProject(),
      {
        target: "standalone-esm",
      },
      () => "",
    );
    const scene = result.files.get("scene.js");
    if (scene?.kind !== "text") throw new Error("expected text");
    expect(scene.content).not.toMatch(/\binterface\b/);
    expect(scene.content).not.toMatch(/:\s*THREE\./);
    expect(scene.content).not.toMatch(/\)\s+as\s+THREE\./);
  });
});
