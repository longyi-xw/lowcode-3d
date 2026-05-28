import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AutoRotateForm } from "./AutoRotateForm";

describe("AutoRotateForm", () => {
  it("renders current axis + speed", () => {
    render(
      <AutoRotateForm
        value={{ axis: "y", speed: 30 }}
        onChange={() => {}}
        disabled={false}
      />,
    );
    expect(screen.getByRole("radio", { name: "y" })).toBeChecked();
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("30");
  });

  it("calls onChange when axis changes", () => {
    const onChange = vi.fn();
    render(
      <AutoRotateForm
        value={{ axis: "y", speed: 30 }}
        onChange={onChange}
        disabled={false}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "x" }));
    expect(onChange).toHaveBeenCalledWith({ axis: "x", speed: 30 });
  });

  it("calls onChange when speed changes", () => {
    const onChange = vi.fn();
    render(
      <AutoRotateForm
        value={{ axis: "y", speed: 30 }}
        onChange={onChange}
        disabled={false}
      />,
    );
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "60" },
    });
    expect(onChange).toHaveBeenCalledWith({ axis: "y", speed: 60 });
  });

  it("disables all inputs when disabled", () => {
    render(
      <AutoRotateForm
        value={{ axis: "y", speed: 30 }}
        onChange={() => {}}
        disabled={true}
      />,
    );
    expect(screen.getByRole("spinbutton")).toBeDisabled();
    expect(screen.getByRole("radio", { name: "x" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "y" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "z" })).toBeDisabled();
  });
});
