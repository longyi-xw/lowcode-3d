import { describe, expect, it } from "vitest";

import { useSettingsStore } from "./store";

describe("useSettingsStore AI config", () => {
  it("defaults aiProvider=anthropic + a non-empty aiModel", () => {
    const s = useSettingsStore.getState();
    expect(s.aiProvider).toBe("anthropic");
    expect(typeof s.aiModel).toBe("string");
    expect(s.aiModel.length).toBeGreaterThan(0);
  });

  it("setAiModel updates the model", () => {
    useSettingsStore.getState().setAiModel("claude-x");
    expect(useSettingsStore.getState().aiModel).toBe("claude-x");
  });
});
