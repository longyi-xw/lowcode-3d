import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BobForm } from "./BobForm";

describe("BobForm", () => {
  it("renders axis radios + amplitude/frequency and emits changes", () => {
    const onChange = vi.fn();
    render(
      <BobForm
        value={{ axis: "y", amplitude: 1, frequency: 1 }}
        onChange={onChange}
        disabled={false}
        instanceId="b1"
      />,
    );
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    const spinners = screen.getAllByRole("spinbutton");
    expect(spinners).toHaveLength(2); // amplitude + frequency
    fireEvent.change(spinners[0]!, { target: { value: "2.5" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ amplitude: 2.5 }));
  });
});
