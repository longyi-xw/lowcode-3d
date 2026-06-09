import { BabylonAdapter } from "@/runtime/babylon/adapter";
import { ThreeAdapter } from "@/runtime/three/adapter";

import { describeAdapterConformance } from "./conformance-suite";

describeAdapterConformance(() => new ThreeAdapter(), "ThreeAdapter");
describeAdapterConformance(() => new BabylonAdapter(), "BabylonAdapter");
