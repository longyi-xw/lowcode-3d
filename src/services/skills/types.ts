import type { Command } from "@/core/command/types";

/** position：灯的世界坐标（方向光从此处朝原点照）。 */
export interface AddLightOperation {
  op: "add_light";
  light_kind: "directional" | "point" | "spot" | "ambient";
  color: string; // hex 或颜色名（normalizeColor 归一化）
  intensity: number;
  position: [number, number, number];
  cast_shadow?: boolean;
}

/** 给当前选中节点加一个行为。parameters 缺省时用该行为的默认参数。 */
export interface AddBehaviorOperation {
  op: "add_behavior";
  behavior_type: "auto-rotate" | "bob" | "hover-highlight";
  parameters?: Record<string, unknown>;
}

export type Operation = AddLightOperation | AddBehaviorOperation;

/** 最小运行上下文（替代架构 §4.3 完整 SkillContext）。add_behavior 作用于
 *  当前选中节点。 */
export interface SkillRunContext {
  selectedNodeId: string | null;
}

/** 精简自架构 §4.3（省略 memory/call_tool — 单轮模型不需要）。 */
export interface Skill {
  id: string;
  name: string;
  systemPrompt: string;
  /** 发给 LLM 的 JSON Schema（aiComplete 的 jsonSchema）。 */
  outputSchema: Record<string, unknown>;
  /** zod 校验 LLM 返回的 JSON → operations（非法抛错）。 */
  parse(json: unknown): Operation[];
  /** operations → 可撤销 Command（ctx 提供选中节点等）。 */
  buildCommands(ops: Operation[], ctx: SkillRunContext): Command[];
}

export interface SkillResult {
  count: number;
}

/** Skill 侧失败（区别于 proxy 的 AiError）。no_target：操作需要选中节点但没有。 */
export class SkillError extends Error {
  constructor(public code: "no_output" | "parse" | "no_target") {
    super(code);
    this.name = "SkillError";
  }
}
