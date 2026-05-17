/**
 * UUID v4 generator backed by the platform `crypto.randomUUID()`.
 *
 * - Browser: standard since ~2021 (Chrome 92, Safari 15, Firefox 95)
 * - Node 19+: exposed on the global `crypto` namespace
 *
 * If we ever need to support older runtimes we'll add a polyfill here; for
 * now this stays a single line on purpose.
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUUID(value: unknown): value is string {
  return typeof value === "string" && UUID_V4_REGEX.test(value);
}
