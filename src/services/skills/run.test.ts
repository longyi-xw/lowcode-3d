import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/ai/proxy", () => ({ aiComplete: vi.fn() }));
vi.mock("@/services/command-history", () => ({ executeCommand: vi.fn() }));

import { aiComplete } from "@/services/ai/proxy";
import { executeCommand } from "@/services/command-history";

import { runSkill } from "./run";
import { SkillError } from "./types";

const opJson = JSON.stringify({
  operations: [
    {
      op: "add_light",
      light_kind: "directional",
      color: "#ffe8c0",
      intensity: 1.2,
      position: [5, 6, 4],
      cast_shadow: true,
    },
  ],
});

describe("runSkill", () => {
  beforeEach(() => vi.clearAllMocks());

  it("executes one command per operation + returns count", async () => {
    vi.mocked(aiComplete).mockResolvedValue({ text: null, json: opJson });
    const res = await runSkill("scene-edit", "add a warm light");
    expect(res.count).toBe(1);
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(vi.mocked(executeCommand).mock.calls[0]![0]).toMatchObject({
      type: "node.add",
    });
  });

  it("throws SkillError(no_output) when the LLM returns no structured json", async () => {
    vi.mocked(aiComplete).mockResolvedValue({ text: "sorry", json: null });
    await expect(runSkill("scene-edit", "hi")).rejects.toMatchObject({
      code: "no_output",
    });
  });

  it("throws SkillError(parse) on invalid schema", async () => {
    vi.mocked(aiComplete).mockResolvedValue({
      text: null,
      json: '{"operations":[{"op":"x"}]}',
    });
    await expect(runSkill("scene-edit", "hi")).rejects.toBeInstanceOf(SkillError);
  });

  it("propagates AiError from aiComplete", async () => {
    vi.mocked(aiComplete).mockRejectedValue({ code: "no_key" });
    await expect(runSkill("scene-edit", "hi")).rejects.toMatchObject({
      code: "no_key",
    });
  });
});
