import { describe, expect, it } from "vitest";
import {
  NullEngine,
  Scene,
  ArcRotateCamera,
  Vector3,
  MeshBuilder,
  TransformNode,
} from "@babylonjs/core";
import {
  bboxFeatures,
  toScreen,
  socketPoints,
  featureSnapPoints,
} from "./snap-features";

function makeScene() {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const cam = new ArcRotateCamera("c", 0, 1, 8, Vector3.Zero(), scene);
  cam.setPosition(new Vector3(4, 3, 4));
  scene.activeCamera = cam;
  cam.getViewMatrix();
  scene.updateTransformMatrix();
  return { engine, scene };
}

describe("babylon bboxFeatures (OBB)", () => {
  it("returns 15 world features for a unit box, center first at origin", () => {
    const { scene, engine } = makeScene();
    const box = MeshBuilder.CreateBox("b", { size: 2 }, scene);
    box.computeWorldMatrix(true);
    const pts = bboxFeatures(box);
    expect(pts).toHaveLength(15);
    expect(pts[0]!.x).toBeCloseTo(0);
    expect(pts[0]!.y).toBeCloseTo(0);
    expect(pts[0]!.z).toBeCloseTo(0);
    engine.dispose();
  });

  it("rotates +X face center with the object (OBB not AABB)", () => {
    const { scene, engine } = makeScene();
    const box = MeshBuilder.CreateBox("b", { size: 2 }, scene);
    box.rotation.y = Math.PI / 4;
    box.computeWorldMatrix(true);
    const pts = bboxFeatures(box);
    const fc = pts[9]!; // +X face center (same index as Three)
    expect(Math.hypot(fc.x, fc.z)).toBeCloseTo(1, 4);
    engine.dispose();
  });

  it("returns [] for a transform node with no mesh", () => {
    const { scene, engine } = makeScene();
    const tn = new TransformNode("t", scene);
    expect(bboxFeatures(tn)).toEqual([]);
    engine.dispose();
  });
});

describe("babylon toScreen", () => {
  it("projects world origin to viewport center", () => {
    const { scene, engine } = makeScene();
    const [x, y] = toScreen(Vector3.Zero(), scene, 800, 600);
    expect(x).toBeCloseTo(400, 0);
    expect(y).toBeCloseTo(300, 0);
    engine.dispose();
  });
});

describe("babylon socketPoints", () => {
  it("maps socket local position through the node world matrix", () => {
    const { scene, engine } = makeScene();
    const box = MeshBuilder.CreateBox("b", { size: 2 }, scene);
    box.position.set(5, 0, 0);
    box.computeWorldMatrix(true);
    const pts = socketPoints(
      box,
      [{ id: "s", name: "s", position: [0, 1, 0], tag: "t" }],
      scene,
      800,
      600,
    );
    expect(pts).toHaveLength(1);
    expect(pts[0]!.world[0]).toBeCloseTo(5);
    expect(pts[0]!.world[1]).toBeCloseTo(1);
    engine.dispose();
  });
});

describe("babylon featureSnapPoints", () => {
  it("pairs each bbox feature's world point with its screen projection", () => {
    const { scene, engine } = makeScene();
    const box = MeshBuilder.CreateBox("b", { size: 2 }, scene);
    box.computeWorldMatrix(true);
    const pts = featureSnapPoints(box, scene, 800, 600);
    expect(pts).toHaveLength(15);
    // center (index 0) is the world origin → projects to viewport center.
    expect(pts[0]!.world).toEqual([0, 0, 0]);
    expect(pts[0]!.screen[0]).toBeCloseTo(400, 0);
    expect(pts[0]!.screen[1]).toBeCloseTo(300, 0);
    engine.dispose();
  });
});
