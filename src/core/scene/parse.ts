import { ZodError } from "zod";
import { SceneProjectSchema, SPEC_VERSION } from "./schemas";
import type { SceneProject } from "./types";

export type ParseResult =
  | { ok: true; project: SceneProject }
  | { ok: false; error: ParseError };

export type ParseError =
  | {
      code: "json_syntax";
      message: string;
    }
  | {
      code: "schema_version_mismatch";
      message: string;
      expected_version: string;
      found_version: string;
    }
  | {
      code: "invalid_shape";
      message: string;
      zodError: ZodError;
    };

/**
 * Validate a raw object as a SceneProject. We probe spec_version first so the
 * common upgrade-path failure produces a clearly-actionable error rather than
 * a sea of zod issues.
 */
export function parseSceneProject(input: unknown): ParseResult {
  if (typeof input !== "object" || input === null) {
    return {
      ok: false,
      error: {
        code: "invalid_shape",
        message: "project root must be an object",
        zodError: new ZodError([
          {
            code: "invalid_type",
            expected: "object",
            received: typeof input,
            path: [],
            message: "expected an object at the project root",
          } as never,
        ]),
      },
    };
  }

  const probe = (input as { spec_version?: unknown }).spec_version;
  if (typeof probe === "string" && probe !== SPEC_VERSION) {
    return {
      ok: false,
      error: {
        code: "schema_version_mismatch",
        message: `expected spec_version ${SPEC_VERSION}, found ${probe}`,
        expected_version: SPEC_VERSION,
        found_version: probe,
      },
    };
  }

  const result = SceneProjectSchema.safeParse(input);
  if (!result.success) {
    return {
      ok: false,
      error: {
        code: "invalid_shape",
        message: "scene project failed schema validation",
        zodError: result.error,
      },
    };
  }

  return { ok: true, project: result.data };
}

/** Convenience wrapper that JSON-parses first and reports syntax errors distinctly. */
export function parseSceneProjectFromJson(json: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return {
      ok: false,
      error: {
        code: "json_syntax",
        message: e instanceof Error ? e.message : "invalid JSON",
      },
    };
  }
  return parseSceneProject(parsed);
}
