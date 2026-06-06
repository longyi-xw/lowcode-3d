import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/ai/proxy", () => ({
  hasAiKey: vi.fn().mockResolvedValue(false),
  setAiKey: vi.fn().mockResolvedValue(undefined),
  clearAiKey: vi.fn().mockResolvedValue(undefined),
  testConnection: vi.fn().mockResolvedValue(undefined),
}));

import { hasAiKey, setAiKey } from "@/services/ai/proxy";

import { AiProvidersSection } from "./AiProvidersSection";

describe("AiProvidersSection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a card per provider (Anthropic + DeepSeek) + BYOK note", async () => {
    render(<AiProvidersSection />);
    expect(screen.getByText("Anthropic")).toBeInTheDocument();
    expect(screen.getByText("DeepSeek")).toBeInTheDocument();
    expect(screen.getByText(/renderer never sees the key/i)).toBeInTheDocument();
    await waitFor(() => expect(hasAiKey).toHaveBeenCalledWith("anthropic"));
    expect(hasAiKey).toHaveBeenCalledWith("deepseek");
  });

  it("saving a key on the Anthropic card calls setAiKey('anthropic', key)", async () => {
    render(<AiProvidersSection />);
    fireEvent.change(screen.getByLabelText("Anthropic API key"), {
      target: { value: "sk-ant-xyz" },
    });
    fireEvent.click(screen.getAllByText("Save")[0]!);
    await waitFor(() =>
      expect(setAiKey).toHaveBeenCalledWith("anthropic", "sk-ant-xyz"),
    );
  });
});
