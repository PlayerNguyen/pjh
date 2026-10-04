import type { z } from "zod";
import { toJSONSchema } from "zod";

/**
 * Stable, key-sorted JSON serialization used to hash delegation arguments, so
 * `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` are treated as identical.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

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

export interface ArgsValidation {
  success: boolean;
  data?: unknown;
  issues?: z.ZodIssue[];
}

/** Validate delegation args against a strategy schema. */
export function validateArgs(schema: z.ZodType, args: unknown): ArgsValidation {
  const result = schema.safeParse(args);
  if (result.success) return { success: true, data: result.data };
  return { success: false, issues: result.error.issues };
}

/** Convert a strategy args schema to draft-07 JSON Schema for UI rendering. */
export function argsToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return toJSONSchema(schema, {
    target: "draft-07",
    unrepresentable: "any",
  }) as Record<string, unknown>;
}
