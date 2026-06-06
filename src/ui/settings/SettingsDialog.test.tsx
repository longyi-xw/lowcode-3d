import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useUIStore } from "@/services/ui/store";

import { SettingsDialog } from "./SettingsDialog";

describe("SettingsDialog", () => {
  beforeEach(() => useUIStore.setState({ settingsOpen: false }));

  it("does not render content when settingsOpen is false", () => {
    render(<SettingsDialog />);
    expect(screen.queryByText("AI providers")).not.toBeInTheDocument();
  });

  it("shows the AI providers nav when open", () => {
    useUIStore.setState({ settingsOpen: true });
    render(<SettingsDialog />);
    expect(screen.getAllByText("AI providers").length).toBeGreaterThan(0);
  });
});
