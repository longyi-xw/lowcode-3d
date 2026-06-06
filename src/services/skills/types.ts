import type { Command } from "@/core/command/types";

/** 本期唯一 op。position：灯的世界坐标（方向光从此处朝原点照）。 */
export interface AddLightOperation {
  op: "add_light";
  light_kind: "directional" | "point" | "spot" | "ambient";
  color: string; // hex #rrggbb
  intensity: number;
  position: [number, number, number];
  cast_shadow?: boolean;
}
export type Operation = AddLightOperation;

/** 精简自架构 §4.3（省略 memory/call_tool — 单轮模型不需要）。 */
export interface Skill {
  id: string;
  name: string;
  systemPrompt: string;
  /** 发给 LLM 的 JSON Schema（aiComplete 的 jsonSchema）。 */
  outputSchema: Record<string, unknown>;
  /** zod 校验 LLM 返回的 JSON → operations（非法抛错）。 */
  parse(json: unknown): Operation[];
  /** operations → 可撤销 Command。 */
  buildCommands(ops: Operation[]): Command[];
}

export interface SkillResult {
  count: number;
}

/** Skill 侧失败（区别于 proxy 的 AiError）。 */
export class SkillError extends Error {
  constructor(public code: "no_output" | "parse") {
    super(code);
    this.name = "SkillError";
  }
}
