/**
 * Shared visual constants for the host-owned socket-marker overlay (v1.0 B4b),
 * so ThreeRenderHost and BabylonRenderHost render pixel-identical markers. Each
 * host converts the hex string to its engine colour type (THREE.Color /
 * Babylon Color3) — the values live here so they can never drift apart.
 */
export const SOCKET_MARKER = {
  /** Marker sphere radius in world units (matches the original ThreeViewport marker). */
  radius: 0.06,
  /** Sockets on non-selected nodes (cyan). */
  color: "#22d3ee",
  /** Sockets on the selected node (amber). */
  colorSelected: "#f59e0b",
} as const;
