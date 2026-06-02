import type { ComponentType } from "react";

import { AutoRotateForm } from "./AutoRotateForm";
import { BobForm } from "./BobForm";
import { HoverHighlightForm } from "./HoverHighlightForm";

export interface BehaviorFormProps {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled: boolean;
  // Unique id of the BehaviorBinding instance — forms must scope DOM-grouped
  // controls (e.g. radio `name`) by this so multiple instances on the same
  // node don't share native browser grouping.
  instanceId: string;
}

/**
 * Map from BehaviorDefinition.type → React form component. The form is
 * responsible for rendering inputs for that behavior's parameter schema and
 * pushing changes via onChange. Components receive an opaque
 * Record<string, unknown> + opaque setter because the parent
 * (BehaviorsPanel) doesn't know individual behavior schemas — it just
 * forwards the params blob.
 */
export const BEHAVIOR_FORM_REGISTRY: Record<
  string,
  ComponentType<BehaviorFormProps>
> = {
  "auto-rotate": AutoRotateForm as unknown as ComponentType<BehaviorFormProps>,
  "hover-highlight": HoverHighlightForm as unknown as ComponentType<BehaviorFormProps>,
  bob: BobForm as unknown as ComponentType<BehaviorFormProps>,
};
