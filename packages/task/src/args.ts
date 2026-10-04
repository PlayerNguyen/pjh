import type { z } from "zod";
import { toJSONSchema } from "zod";

/**
 * Stable, key-sorted JSON serialization used to hash delegation arguments, so
 * `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` are treated as identical.
 *
 * @param value - Any JSON-serializable value.
 * @returns A canonical JSON string with object keys sorted recursively.
 *
 * @example
 * ```ts
 * canonicalize({ b: 2, a: 1 }); // => '{"a":1,"b":2}'
 * canonicalize({ a: [2, 1] });  // => '{"a":[2,1]}'
 * ```
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

/**
 * Recursively sorts object keys so {@link canonicalize} produces a stable
 * string. Arrays keep their order.
 *
 * @param value - Value to normalize.
 * @returns A structurally cloned value with sorted object keys.
 *
 * @example
 * ```ts
 * sortValue({ b: 1, a: { d: 2, c: 3 } });
 * // => { a: { c: 3, d: 2 }, b: 1 }
 * ```
 */
function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/**
 * Order-independent hash of a strategy type + its arguments. Two delegations
 * with the same type and equivalent args share a hash and are duplicates.
 *
 * FNV-1a (32-bit) keeps this portable across runtimes (Bun, browser, SSR).
 *
 * @param type - Strategy type.
 * @param args - Delegation arguments.
 * @returns An 8-character lowercase hex hash.
 *
 * @example
 * ```ts
 * argsHash("heartbeat", { a: 1, b: 2 });
 * // => "0af76519"  (same as argsHash("heartbeat", { b: 2, a: 1 }))
 * ```
 */
export function argsHash(type: string, args: unknown): string {
  const input = `${type}\u0000${canonicalize(args)}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Outcome of validating delegation arguments against a strategy schema.
 *
 * @example
 * ```ts
 * const result: ArgsValidation = { success: true, data: { n: 1 } };
 * ```
 */
export interface ArgsValidation {
  success: boolean;
  data?: unknown;
  issues?: z.ZodIssue[];
}

/**
 * Validate delegation args against a strategy schema.
 *
 * @param schema - Zod schema describing the strategy parameters.
 * @param args - Raw arguments to validate.
 * @returns `{ success: true, data }` or `{ success: false, issues }`.
 *
 * @example
 * ```ts
 * validateArgs(z.object({ n: z.number() }), { n: 1 });
 * // => { success: true, data: { n: 1 } }
 * validateArgs(z.object({ n: z.number() }), { n: "x" });
 * // => { success: false, issues: [...] }
 * ```
 */
export function validateArgs(schema: z.ZodType, args: unknown): ArgsValidation {
  const result = schema.safeParse(args);
  if (result.success) return { success: true, data: result.data };
  return { success: false, issues: result.error.issues };
}

/**
 * Convert a strategy args schema to draft-07 JSON Schema for UI rendering.
 *
 * @param schema - Zod schema describing the strategy parameters.
 * @returns A draft-07 JSON Schema object.
 *
 * @example
 * ```ts
 * argsToJsonSchema(z.object({ n: z.number() }));
 * // => { type: "object", properties: { n: { type: "number" } }, required: ["n"] }
 * ```
 */
export function argsToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return toJSONSchema(schema, {
    target: "draft-07",
    unrepresentable: "any",
  }) as Record<string, unknown>;
}
