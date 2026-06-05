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

  it("renders the Anthropic card + BYOK note", async () => {
    render(<AiProvidersSection />);
    expect(screen.getByText("Anthropic")).toBeInTheDocument();
    expect(screen.getByText(/renderer never sees the key/i)).toBeInTheDocument();
    await waitFor(() => expect(hasAiKey).toHaveBeenCalled());
  });

  it("saving a key calls setAiKey then re-checks hasAiKey", async () => {
    render(<AiProvidersSection />);
    fireEvent.change(screen.getByLabelText("API key"), {
      target: { value: "sk-ant-xyz" },
    });
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(setAiKey).toHaveBeenCalledWith("sk-ant-xyz"));
  });
});
