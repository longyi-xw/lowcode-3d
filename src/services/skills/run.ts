import { aiComplete } from "@/services/ai/proxy";
import { executeCommand } from "@/services/command-history";
import { useUIStore } from "@/services/ui/store";

import { SKILLS } from "./registry";
import { SkillError, type SkillResult } from "./types";

/**
 * Single-shot skill execution: NL input → structured LLM output → zod-validated
 * operations → undoable Commands. The active provider (settings) is used by
 * aiComplete. Throws SkillError (no_output/parse/no_target) or the proxy's
 * AiError. On a parse failure the raw LLM output is logged for diagnosis.
 */
export async function runSkill(skillId: string, input: string): Promise<SkillResult> {
  const skill = SKILLS[skillId];
  if (!skill) throw new Error(`unknown skill: ${skillId}`);

  const res = await aiComplete({
    system: skill.systemPrompt,
    user: input,
    jsonSchema: skill.outputSchema,
  });
  if (!res.json) {
    console.warn("[skill] LLM returned no structured output:", res.text);
    throw new SkillError("no_output");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(res.json);
  } catch (e) {
    console.warn("[skill] LLM output is not valid JSON:", res.json, e);
    throw new SkillError("parse");
  }

  let ops;
  try {
    ops = skill.parse(raw);
  } catch (e) {
    console.warn("[skill] LLM output failed schema validation:", res.json, e);
    throw new SkillError("parse");
  }

  const ctx = { selectedNodeId: useUIStore.getState().selectedNodeId };
  const cmds = skill.buildCommands(ops, ctx);
  for (const cmd of cmds) executeCommand(cmd);
  return { count: cmds.length };
}
