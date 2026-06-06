import { sceneEditSkill } from "./scene-edit";
import type { Skill } from "./types";

export const SKILLS: Record<string, Skill> = {
  "scene-edit": sceneEditSkill,
};
