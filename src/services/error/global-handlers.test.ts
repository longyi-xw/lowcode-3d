import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";

import { installGlobalErrorHandlers } from "./global-handlers";

describe("installGlobalErrorHandlers", () => {
  afterEach(() => vi.clearAllMocks());

  it("toasts on window error event", () => {
    installGlobalErrorHandlers(); // idempotent — listeners registered on import
    window.dispatchEvent(new ErrorEvent("error", { message: "boom" }));
    expect(toast.error).toHaveBeenCalled();
  });

  it("toasts on unhandledrejection", () => {
    installGlobalErrorHandlers();
    window.dispatchEvent(new Event("unhandledrejection"));
    expect(toast.error).toHaveBeenCalled();
  });
});
