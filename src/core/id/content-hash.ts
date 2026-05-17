/**
 * Content-addressable hash for asset deduplication.
 *
 * Format: `"sha256-<64 lowercase hex chars>"` — the prefix lets us evolve
 * the algorithm later (e.g., adding `"blake3-..."`) without retroactively
 * rewriting stored hashes. The hex encoding is easier to grep and diff
 * than base64 at the cost of 20 extra characters; for an editor that's
 * the right trade.
 */

const ALGO = "SHA-256";
const PREFIX = "sha256-";

export type ContentHash = `sha256-${string}`;

const HEX_LOOKUP = Array.from({ length: 256 }, (_, i) =>
  i.toString(16).padStart(2, "0"),
);

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += HEX_LOOKUP[bytes[i]!];
  }
  return out;
}

/**
 * Hash bytes (or a UTF-8 string) into a deterministic content hash.
 *
 * Backed by `crypto.subtle.digest`, which is async by spec; callers should
 * await or batch where the latency matters.
 */
export async function contentHash(input: BufferSource | string): Promise<ContentHash> {
  const data = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest(ALGO, data);
  return `${PREFIX}${bufferToHex(digest)}` as ContentHash;
}

const CONTENT_HASH_REGEX = /^sha256-[0-9a-f]{64}$/;

export function isContentHash(value: unknown): value is ContentHash {
  return typeof value === "string" && CONTENT_HASH_REGEX.test(value);
}
