import { afterEach, describe, expect, test } from "bun:test";
import type { PjhDB } from "@pjh/task";
import { argsHash, defineTask, TaskRegistry } from "@pjh/task";
import type { Kysely } from "kysely";
import { z } from "zod";
import { Executor } from "../src/engine/executor.ts";
import { freshDb } from "./helpers.ts";

let db: Kysely<PjhDB>;

afterEach(async () => {
  await db?.destroy();
});

async function insertDelegation(
  type: string,
  args: unknown,
  overrides: Partial<{
    id: string;
    name: string;
    concurrency: string;
    enabled: number;
  }> = {},
) {
  await db
    .insertInto("task_delegation")
    .values({
      id: overrides.id ?? crypto.randomUUID(),
      type,
      name: overrides.name ?? type,
      args: JSON.stringify(args),
      args_hash: argsHash(type, args),
      schedule: "* * * * *",
      timezone: null,
      enabled: overrides.enabled ?? 1,
      timeout_ms: null,
      concurrency: (overrides.concurrency ?? "skip") as "skip",
      last_run_at: null,
      next_run_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .execute();
}

describe("executor", () => {
  test("records a successful instance with validated args", async () => {
    db = await freshDb();
    const def = defineTask({
      type: "ok",
      name: "OK",
      args: z.object({ value: z.number() }),
      handle: (ctx) => {
        ctx.log("info", "hello");
        return { doubled: ctx.args.value * 2 };
      },
    });
    const registry = new TaskRegistry().register(def);
    await insertDelegation("ok", { value: 21 });

    const delegation = await db
      .selectFrom("task_delegation")
      .selectAll()
      .executeTakeFirstOrThrow();

    const executor = new Executor({ db, getStrategy: (t) => registry.get(t) });
    const res = await executor.trigger(delegation.id, { trigger: "manual" });
    expect(res.started).toBe(true);
    await Bun.sleep(30);

    const instance = await db
      .selectFrom("task_instance")
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(instance.status).toBe("succeeded");
    expect(instance.result).toBe(JSON.stringify({ doubled: 42 }));

    const logs = await db.selectFrom("task_instance_log").selectAll().execute();
    expect(logs).toHaveLength(1);
  });

  test("fails when args are invalid for the strategy", async () => {
    db = await freshDb();
    const def = defineTask({
      type: "strict",
      name: "Strict",
      args: z.object({ n: z.number() }),
      handle: () => {},
    });
    const registry = new TaskRegistry().register(def);
    await insertDelegation("strict", { n: "not-a-number" });

    const delegation = await db
      .selectFrom("task_delegation")
      .selectAll()
      .executeTakeFirstOrThrow();

    const executor = new Executor({ db, getStrategy: (t) => registry.get(t) });
    await executor.trigger(delegation.id, { trigger: "manual" });
    await Bun.sleep(30);

    const instance = await db
      .selectFrom("task_instance")
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(instance.status).toBe("failed");
    expect(instance.error).toContain("Invalid delegation args");
  });

  test("records a failed instance", async () => {
    db = await freshDb();
    const def = defineTask({
      type: "boom",
      name: "Boom",
      args: z.object({}),
      handle: () => {
        throw new Error("kaboom");
      },
    });
    const registry = new TaskRegistry().register(def);
    await insertDelegation("boom", {});

    const delegation = await db
      .selectFrom("task_delegation")
      .selectAll()
      .executeTakeFirstOrThrow();

    const executor = new Executor({ db, getStrategy: (t) => registry.get(t) });
    await executor.trigger(delegation.id, { trigger: "manual" });
    await Bun.sleep(30);

    const instance = await db
      .selectFrom("task_instance")
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(instance.status).toBe("failed");
    expect(instance.error).toBe("kaboom");
  });

  test("skips when a run is in progress (skip policy)", async () => {
    db = await freshDb();
    const def = defineTask({
      type: "slow",
      name: "Slow",
      args: z.object({}),
      handle: async () => {
        await Bun.sleep(50);
      },
    });
    const registry = new TaskRegistry().register(def);
    await insertDelegation("slow", {}, { concurrency: "skip" });

    const delegation = await db
      .selectFrom("task_delegation")
      .selectAll()
      .executeTakeFirstOrThrow();

    const executor = new Executor({ db, getStrategy: (t) => registry.get(t) });
    const first = await executor.trigger(delegation.id, { trigger: "manual" });
    const second = await executor.trigger(delegation.id, { trigger: "manual" });
    expect(first.started).toBe(true);
    expect(second.started).toBe(false);
    expect(second.reason).toBe("skipped-running");
    await Bun.sleep(80);
  });

  test("unknown delegation is rejected", async () => {
    db = await freshDb();
    const registry = new TaskRegistry();
    const executor = new Executor({ db, getStrategy: (t) => registry.get(t) });
    const res = await executor.trigger("nope", { trigger: "manual" });
    expect(res.started).toBe(false);
    expect(res.reason).toBe("unknown-delegation");
  });

  test("timed out run is marked as timeout", async () => {
    db = await freshDb();
    const def = defineTask({
      type: "timeout",
      name: "Timeout",
      args: z.object({}),
      defaultTimeoutMs: 20,
      handle: async (ctx) => {
        await Bun.sleep(200);
        if (ctx.signal.aborted) throw new Error("aborted");
      },
    });
    const registry = new TaskRegistry().register(def);
    await insertDelegation("timeout", {});

    const delegation = await db
      .selectFrom("task_delegation")
      .selectAll()
      .executeTakeFirstOrThrow();
    await db
      .updateTable("task_delegation")
      .set({ timeout_ms: 20 })
      .where("id", "=", delegation.id)
      .execute();

    const executor = new Executor({ db, getStrategy: (t) => registry.get(t) });
    await executor.trigger(delegation.id, { trigger: "manual" });
    await Bun.sleep(80);

    const instance = await db
      .selectFrom("task_instance")
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(instance.status).toBe("timeout");
  });
});
