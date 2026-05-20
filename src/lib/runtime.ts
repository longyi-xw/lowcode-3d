/**
 * Detect whether we're running inside the Tauri webview vs a plain browser.
 *
 * Tauri 2 injects `window.__TAURI_INTERNALS__` at startup; `@tauri-apps/api`
 * exports `isTauri()` from `core` but that does the same check, so we inline
 * it here to avoid pulling in `@tauri-apps/api` for code paths that only need
 * a runtime check (and which want to stay safe to call during SSR / Vite dev
 * in a browser tab).
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
