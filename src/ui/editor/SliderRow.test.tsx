import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SliderRow } from "./SliderRow";

describe("SliderRow", () => {
  it("renders the label and current value", () => {
    render(
      <SliderRow
        label="Metalness"
        value={0.3}
        min={0}
        max={1}
        step={0.01}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Metalness")).toBeInTheDocument();
    expect(screen.getByRole("slider")).toHaveValue("0.3");
  });

  it("fires onChange when the range moves", () => {
    const onChange = vi.fn();
    render(
      <SliderRow
        label="Roughness"
        value={0.5}
        min={0}
        max={1}
        step={0.01}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByRole("slider"), { target: { value: "0.8" } });
    expect(onChange).toHaveBeenCalledWith(0.8);
  });

  it("disables both inputs when disabled", () => {
    const onChange = vi.fn();
    render(
      <SliderRow
        label="Opacity"
        value={1}
        min={0}
        max={1}
        step={0.01}
        disabled
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("slider")).toBeDisabled();
  });
});
