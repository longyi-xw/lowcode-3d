import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/skills/run", () => ({ runSkill: vi.fn() }));

import { runSkill } from "@/services/skills/run";
import { useUIStore } from "@/services/ui/store";

import { AiCommandBar } from "./AiCommandBar";

describe("AiCommandBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUIStore.setState({ playState: "edit" });
  });

  it("runs the scene-edit skill on Enter", async () => {
    vi.mocked(runSkill).mockResolvedValue({ count: 1 });
    render(<AiCommandBar />);
    const box = screen.getByLabelText(/describe/i);
    fireEvent.change(box, {
      target: { value: "add a warm light from upper right" },
    });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() =>
      expect(runSkill).toHaveBeenCalledWith(
        "scene-edit",
        "add a warm light from upper right",
      ),
    );
  });

  it("disables the input in play mode", () => {
    useUIStore.setState({ playState: "play" });
    render(<AiCommandBar />);
    expect(screen.getByLabelText(/describe/i)).toBeDisabled();
  });
});
