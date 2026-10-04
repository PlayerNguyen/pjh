import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { TaskRegistry } from "../src/registry.ts";
import { defineTask } from "../src/task.ts";

function strategy(type: string) {
  return defineTask({
    type,
    name: type.toUpperCase(),
    args: z.object({ n: z.number().default(1) }),
    handle: () => ({ ok: true }),
  });
}

describe("TaskRegistry", () => {
  test("should register and resolve strategies", () => {
    const registry = new TaskRegistry().register(strategy("a"), strategy("b"));
    expect(registry.size).toBe(2);
    expect(registry.has("a")).toBe(true);
    expect(registry.get("a")?.name).toBe("A");
    expect(registry.get("missing")).toBeUndefined();
  });

  test("should list every registered strategy", () => {
    const registry = new TaskRegistry().register(strategy("a"), strategy("b"));
    expect(registry.list().map((t) => t.type)).toEqual(["a", "b"]);
  });

  test("should throw when a type is registered twice", () => {
    expect(() => new TaskRegistry().register(strategy("a"), strategy("a"))).toThrow(
      'Task strategy "a" is already registered',
    );
  });
});

describe("defineTask", () => {
  test("should preserve the definition and infer args", () => {
    const def = defineTask({
      type: "x",
      name: "X",
      args: z.object({ n: z.number() }),
      defaultSchedule: "@daily",
      handle: (ctx) => ({ value: ctx.args.n }),
    });
    expect(def.type).toBe("x");
    expect(def.defaultSchedule).toBe("@daily");
  });
});
