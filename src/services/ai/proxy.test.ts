import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/bindings/tauri", () => ({
  commands: {
    aiComplete: vi.fn(),
    setAiKey: vi.fn(),
    hasAiKey: vi.fn(),
    clearAiKey: vi.fn(),
    testAiProvider: vi.fn(),
  },
}));

import { commands } from "@/bindings/tauri";
import { useSettingsStore } from "@/services/settings/store";

import { aiComplete, hasAiKey, setAiKey } from "./proxy";

describe("ai proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({ aiProvider: "anthropic", aiModel: "claude-x" });
  });

  it("aiComplete reads provider/model from settings + returns data on ok", async () => {
    vi.mocked(commands.aiComplete).mockResolvedValue({
      status: "ok",
      data: { text: "hi", json: null },
    });
    const res = await aiComplete({ system: "s", user: "u" });
    expect(commands.aiComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "anthropic",
        model: "claude-x",
        system: "s",
        user: "u",
        json_schema: null,
      }),
    );
    expect(res.text).toBe("hi");
  });

  it("aiComplete stringifies a json schema", async () => {
    vi.mocked(commands.aiComplete).mockResolvedValue({
      status: "ok",
      data: { text: null, json: "{}" },
    });
    await aiComplete({ system: "", user: "u", jsonSchema: { type: "object" } });
    expect(commands.aiComplete).toHaveBeenCalledWith(
      expect.objectContaining({ json_schema: JSON.stringify({ type: "object" }) }),
    );
  });

  it("aiComplete throws the AiError on error status", async () => {
    vi.mocked(commands.aiComplete).mockResolvedValue({
      status: "error",
      error: { code: "no_key" },
    });
    await expect(aiComplete({ system: "", user: "u" })).rejects.toMatchObject({
      code: "no_key",
    });
  });

  it("setAiKey + hasAiKey delegate to commands for the current provider", async () => {
    vi.mocked(commands.setAiKey).mockResolvedValue({ status: "ok", data: null });
    await setAiKey("sk-test");
    expect(commands.setAiKey).toHaveBeenCalledWith("anthropic", "sk-test");

    vi.mocked(commands.hasAiKey).mockResolvedValue({ status: "ok", data: true });
    expect(await hasAiKey()).toBe(true);
  });
});
