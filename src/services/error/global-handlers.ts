import { toast } from "sonner";

import i18n from "@/i18n";

let installed = false;

/**
 * Registers window-level handlers for errors that escape React's render tree
 * (async throws, rejected promises). Non-fatal: logs + shows an error toast.
 * Render-tree crashes are handled by ErrorBoundary instead. Idempotent.
 */
export function installGlobalErrorHandlers(): void {
  if (installed) return;
  installed = true;
  window.addEventListener("error", (e) => {
    console.error("[global error]", e.error ?? e.message);
    toast.error(i18n.t("errors:uncaught"), { duration: Infinity });
  });
  window.addEventListener("unhandledrejection", (e) => {
    console.error("[unhandledrejection]", e.reason);
    toast.error(i18n.t("errors:uncaught"), { duration: Infinity });
  });
}

installGlobalErrorHandlers();
