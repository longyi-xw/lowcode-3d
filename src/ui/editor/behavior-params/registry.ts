import type { ComponentType } from "react";

import { AutoRotateForm } from "./AutoRotateForm";

export interface BehaviorFormProps {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled: boolean;
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
};
