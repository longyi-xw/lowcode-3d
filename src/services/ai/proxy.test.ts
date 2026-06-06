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

import { aiComplete, hasAiKey, setAiKey, testConnection } from "./proxy";

describe("ai proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      aiProvider: "deepseek",
      aiModels: { anthropic: "claude-x", deepseek: "deepseek-chat" },
    });
  });

  it("aiComplete uses the active provider + its model", async () => {
    vi.mocked(commands.aiComplete).mockResolvedValue({
      status: "ok",
      data: { text: "hi", json: null },
    });
    const res = await aiComplete({ system: "s", user: "u" });
    expect(commands.aiComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "deepseek",
        model: "deepseek-chat",
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

  it("setAiKey + hasAiKey operate on the given provider", async () => {
    vi.mocked(commands.setAiKey).mockResolvedValue({ status: "ok", data: null });
    await setAiKey("anthropic", "sk-test");
    expect(commands.setAiKey).toHaveBeenCalledWith("anthropic", "sk-test");

    vi.mocked(commands.hasAiKey).mockResolvedValue({ status: "ok", data: true });
    expect(await hasAiKey("deepseek")).toBe(true);
    expect(commands.hasAiKey).toHaveBeenCalledWith("deepseek");
  });

  it("testConnection sends the provider + its configured model", async () => {
    vi.mocked(commands.testAiProvider).mockResolvedValue({ status: "ok", data: null });
    await testConnection("anthropic");
    expect(commands.testAiProvider).toHaveBeenCalledWith("anthropic", "claude-x");
  });
});
