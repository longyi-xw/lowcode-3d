import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HoverHighlightForm } from "./HoverHighlightForm";

describe("HoverHighlightForm", () => {
  it("emits intensity changes", () => {
    const onChange = vi.fn();
    render(
      <HoverHighlightForm
        value={{ color: "#ffaa00", intensity: 1 }}
        onChange={onChange}
        disabled={false}
        instanceId="h1"
      />,
    );
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "2" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ intensity: 2 }));
  });

  it("emits color changes", () => {
    const onChange = vi.fn();
    render(
      <HoverHighlightForm
        value={{ color: "#ffaa00", intensity: 1 }}
        onChange={onChange}
        disabled={false}
        instanceId="h1"
      />,
    );
    fireEvent.change(screen.getByLabelText(/Color|颜色/), {
      target: { value: "#00ff00" },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ color: "#00ff00" }),
    );
  });
});
