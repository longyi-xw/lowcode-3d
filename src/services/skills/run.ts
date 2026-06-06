import { aiComplete } from "@/services/ai/proxy";
import { executeCommand } from "@/services/command-history";

import { SKILLS } from "./registry";
import { SkillError, type SkillResult } from "./types";

/**
 * Single-shot skill execution: NL input → structured LLM output → zod-validated
 * operations → undoable Commands. The active provider (settings) is used by
 * aiComplete. Throws SkillError (no_output/parse) or the proxy's AiError.
 */
export async function runSkill(skillId: string, input: string): Promise<SkillResult> {
  const skill = SKILLS[skillId];
  if (!skill) throw new Error(`unknown skill: ${skillId}`);

  const res = await aiComplete({
    system: skill.systemPrompt,
    user: input,
    jsonSchema: skill.outputSchema,
  });
  if (!res.json) throw new SkillError("no_output");

  let raw: unknown;
  try {
    raw = JSON.parse(res.json);
  } catch {
    throw new SkillError("parse");
  }

  let ops;
  try {
    ops = skill.parse(raw);
  } catch {
    throw new SkillError("parse");
  }

  const cmds = skill.buildCommands(ops);
  for (const cmd of cmds) executeCommand(cmd);
  return { count: cmds.length };
}
