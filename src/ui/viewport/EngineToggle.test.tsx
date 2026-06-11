import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useUIStore } from "@/services/ui/store";

import { EngineToggle } from "./EngineToggle";

describe("EngineToggle", () => {
  beforeEach(() =>
    useUIStore.setState({ viewportEngine: "three.js", playState: "edit" }),
  );

  it("switches the engine on click", () => {
    render(<EngineToggle />);
    fireEvent.click(screen.getByText("Babylon"));
    expect(useUIStore.getState().viewportEngine).toBe("babylon.js");
  });

  it("forces play state back to edit when switching", () => {
    useUIStore.setState({ playState: "play" });
    render(<EngineToggle />);
    fireEvent.click(screen.getByText("Babylon"));
    expect(useUIStore.getState().playState).toBe("edit");
  });

  it("clicking the active engine is a no-op", () => {
    useUIStore.setState({ playState: "play" });
    render(<EngineToggle />);
    fireEvent.click(screen.getByText("Three"));
    expect(useUIStore.getState().viewportEngine).toBe("three.js");
    expect(useUIStore.getState().playState).toBe("play");
  });
});
