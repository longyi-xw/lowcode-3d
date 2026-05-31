import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/project/actions", () => ({
  createProjectFromTemplate: vi.fn(),
}));

import { createProjectFromTemplate } from "@/services/project/actions";
import { useUIStore } from "@/services/ui/store";

import { NewProjectDialog } from "./NewProjectDialog";

describe("NewProjectDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUIStore.setState({ newProjectOpen: false });
  });

  it("renders nothing when closed", () => {
    render(<NewProjectDialog />);
    expect(screen.queryByText(/New project|新建项目/)).toBeNull();
  });

  it("renders all three template cards + recommended badge when open", () => {
    useUIStore.setState({ newProjectOpen: true });
    render(<NewProjectDialog />);
    expect(screen.getByText(/Starter scene|起步场景/)).toBeInTheDocument();
    expect(screen.getByText(/Single cube|单个立方体/)).toBeInTheDocument();
    expect(screen.getByText(/Empty project|空项目/)).toBeInTheDocument();
    expect(screen.getByText(/Recommended|推荐/)).toBeInTheDocument();
  });

  it("clicking a card calls createProjectFromTemplate with its id", () => {
    useUIStore.setState({ newProjectOpen: true });
    render(<NewProjectDialog />);
    fireEvent.click(screen.getByRole("button", { name: /Single cube|单个立方体/ }));
    expect(createProjectFromTemplate).toHaveBeenCalledWith("single-cube");
  });
});
