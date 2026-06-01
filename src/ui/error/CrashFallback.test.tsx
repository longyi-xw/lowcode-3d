import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CrashFallback } from "./CrashFallback";

describe("CrashFallback", () => {
  it("renders the error message + reload button", () => {
    render(<CrashFallback error={new Error("kaboom")} />);
    expect(screen.getByText(/kaboom/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /重载|reload/i })).toBeInTheDocument();
  });
});
