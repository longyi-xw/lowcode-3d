import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useUIStore } from "@/services/ui/store";

import { PlayButton } from "./PlayButton";

describe("PlayButton", () => {
  beforeEach(() => useUIStore.setState({ playState: "edit" }));

  it("shows 'Play' label when in edit mode", () => {
    render(<PlayButton />);
    expect(screen.getByText(/play/i)).toBeInTheDocument();
  });

  it("clicking switches to play state", () => {
    render(<PlayButton />);
    fireEvent.click(screen.getByText(/play/i));
    expect(useUIStore.getState().playState).toBe("play");
  });

  it("shows 'Pause' label when in play mode", () => {
    useUIStore.setState({ playState: "play" });
    render(<PlayButton />);
    expect(screen.getByText(/pause/i)).toBeInTheDocument();
  });

  it("clicking again returns to edit", () => {
    useUIStore.setState({ playState: "play" });
    render(<PlayButton />);
    fireEvent.click(screen.getByText(/pause/i));
    expect(useUIStore.getState().playState).toBe("edit");
  });
});
