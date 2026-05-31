import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StartupView } from "./StartupView";

describe("StartupView", () => {
  it("shows the New project action and no runtime-template placeholder", () => {
    render(<StartupView />);
    expect(
      screen.getByRole("button", { name: /New project|新建项目/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Three\.js \+ Vite/)).toBeNull();
    expect(screen.queryByText(/R3F \+ Next/)).toBeNull();
  });
});
