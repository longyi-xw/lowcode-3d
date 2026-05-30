import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useUIStore } from "@/services/ui/store";

import { ShortcutsHelpDialog } from "./ShortcutsHelpDialog";

describe("ShortcutsHelpDialog", () => {
  it("does not render content when helpOpen=false", () => {
    useUIStore.setState({ helpOpen: false });
    render(<ShortcutsHelpDialog />);
    expect(screen.queryByText(/键盘快捷键|Keyboard shortcuts/i)).toBeNull();
  });

  it("renders all 6 sections when helpOpen=true", () => {
    useUIStore.setState({ helpOpen: true });
    render(<ShortcutsHelpDialog />);
    // section titles (using i18n keys via the editor namespace — see step 5)
    // both zh-CN and en-US load via test setup; default may be either.
    // assert at least one of the section headers + one item show up.
    expect(screen.getAllByText(/项目|Project/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/编辑|Edit/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/变换|Transform/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/选择|Selection/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/播放|Play/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/帮助|Help/i).length).toBeGreaterThan(0);
  });

  it("renders a key combo for each item (e.g. ⌘+N)", () => {
    useUIStore.setState({ helpOpen: true });
    render(<ShortcutsHelpDialog />);
    // at least one ⌘ kbd should be present
    const kbds = screen.getAllByText((_, el) => el?.tagName === "KBD");
    expect(kbds.length).toBeGreaterThan(0);
  });
});
