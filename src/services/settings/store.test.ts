import { describe, expect, it } from "vitest";

import { useSettingsStore } from "./store";

describe("useSettingsStore AI config", () => {
  it("defaults aiProvider=anthropic + per-provider models", () => {
    const s = useSettingsStore.getState();
    expect(s.aiProvider).toBe("anthropic");
    expect(s.aiModels.anthropic.length).toBeGreaterThan(0);
    expect(s.aiModels.deepseek).toBe("deepseek-chat");
  });

  it("setAiModel updates one provider's model, leaving others", () => {
    useSettingsStore.getState().setAiModel("deepseek", "deepseek-reasoner");
    expect(useSettingsStore.getState().aiModels.deepseek).toBe("deepseek-reasoner");
    expect(useSettingsStore.getState().aiModels.anthropic.length).toBeGreaterThan(0);
  });

  it("setAiProvider switches the active provider", () => {
    useSettingsStore.getState().setAiProvider("deepseek");
    expect(useSettingsStore.getState().aiProvider).toBe("deepseek");
  });
});
