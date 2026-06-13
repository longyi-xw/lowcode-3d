import { NullEngine } from "@babylonjs/core";

import { BabylonAdapter } from "@/runtime/babylon/adapter";
import { ThreeAdapter } from "@/runtime/three/adapter";

import { describeAdapterConformance } from "./conformance-suite";

describeAdapterConformance(() => new ThreeAdapter(), "ThreeAdapter", {
  makePickAdapter: () => {
    const adapter = new ThreeAdapter();
    adapter.setViewportSize(800, 600);
    return adapter;
  },
});
describeAdapterConformance(() => new BabylonAdapter(), "BabylonAdapter", {
  makePickAdapter: () =>
    new BabylonAdapter({
      engine: new NullEngine({
        renderWidth: 800,
        renderHeight: 600,
        textureSize: 512,
        deterministicLockstep: false,
        lockstepMaxSteps: 4,
      }),
    }),
});
