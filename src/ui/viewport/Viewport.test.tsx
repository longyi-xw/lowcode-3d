import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUIStore } from "@/services/ui/store";

import { Viewport } from "./Viewport";

vi.mock("./ThreeViewport", () => ({
  ThreeViewport: () => <div data-testid="three-viewport" />,
}));
vi.mock("./BabylonViewport", () => ({
  BabylonViewport: () => <div data-testid="babylon-viewport" />,
}));

describe("Viewport", () => {
  beforeEach(() => useUIStore.setState({ viewportEngine: "three.js" }));

  it("renders ThreeViewport by default", () => {
    render(<Viewport />);
    expect(screen.getByTestId("three-viewport")).toBeInTheDocument();
    expect(screen.queryByTestId("babylon-viewport")).toBeNull();
  });

  it("renders BabylonViewport when viewportEngine is babylon.js", () => {
    useUIStore.setState({ viewportEngine: "babylon.js" });
    render(<Viewport />);
    expect(screen.getByTestId("babylon-viewport")).toBeInTheDocument();
    expect(screen.queryByTestId("three-viewport")).toBeNull();
  });
});
