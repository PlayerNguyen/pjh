import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { argsHash, argsToJsonSchema, canonicalize, validateArgs } from "../src/args.ts";

describe("canonicalize", () => {
  test("should sort object keys recursively", () => {
    expect(canonicalize({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    expect(canonicalize({ b: { d: 4, c: 3 }, a: 1 })).toBe('{"a":1,"b":{"c":3,"d":4}}');
  });

  test("should preserve array order", () => {
    expect(canonicalize({ a: [2, 1, 3] })).toBe('{"a":[2,1,3]}');
  });

  test("should serialize primitives and null", () => {
    expect(canonicalize(null)).toBe("null");
    expect(canonicalize(42)).toBe("42");
    expect(canonicalize("x")).toBe('"x"');
  });
});

describe("argsHash", () => {
  test("should be order-independent for object keys", () => {
    expect(argsHash("t", { a: 1, b: 2 })).toBe(argsHash("t", { b: 2, a: 1 }));
  });

  test("should differ when the type differs", () => {
    expect(argsHash("a", { x: 1 })).not.toBe(argsHash("b", { x: 1 }));
  });

  test("should produce a stable 8-char hex string", () => {
    const hash = argsHash("heartbeat", { message: "tick" });
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
    expect(hash).toBe(argsHash("heartbeat", { message: "tick" }));
  });
});

describe("validateArgs", () => {
  test("should return data on success", () => {
    const result = validateArgs(z.object({ n: z.number() }), { n: 1 });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ n: 1 });
  });

  test("should return issues on failure", () => {
    const result = validateArgs(z.object({ n: z.number() }), { n: "x" });
    expect(result.success).toBe(false);
    expect(result.issues?.length).toBeGreaterThan(0);
  });

  test("should apply schema defaults", () => {
    const schema = z.object({ n: z.number().default(5) });
    const result = validateArgs(schema, {});
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ n: 5 });
  });
});

describe("argsToJsonSchema", () => {
  test("should convert a zod object to draft-07 JSON schema", () => {
    const schema = argsToJsonSchema(z.object({ n: z.number() }));
    expect(schema.type).toBe("object");
    expect((schema.properties as Record<string, unknown>).n).toEqual({
      type: "number",
    });
  });
});
