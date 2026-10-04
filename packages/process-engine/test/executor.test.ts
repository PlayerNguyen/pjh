import { afterEach, describe, expect, test } from "bun:test";
import type { PjhDB } from "@pjh/task";
import { defineTask, TaskRegistry } from "@pjh/task";
import type { Kysely } from "kysely";
import { z } from "zod";
import { Executor } from "../src/executor.ts";
import { freshDb, insertDelegation } from "./helpers.ts";

let db: Kysely<PjhDB>;

afterEach(async () => {
  await db?.destroy();
});

describe("Executor", () => {
  test("should record a successful instance with validated args", async () => {
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
    const id = await insertDelegation(db, "ok", { value: 21 });

    const executor = new Executor({ db, getStrategy: (t) => registry.get(t) });
    const res = await executor.trigger(id, { trigger: "manual" });
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

  test("should fail when args are invalid for the strategy", async () => {
    db = await freshDb();
    const def = defineTask({
      type: "strict",
      name: "Strict",
      args: z.object({ n: z.number() }),
      handle: () => {},
    });
    const registry = new TaskRegistry().register(def);
    const id = await insertDelegation(db, "strict", { n: "not-a-number" });

    const executor = new Executor({ db, getStrategy: (t) => registry.get(t) });
    await executor.trigger(id, { trigger: "manual" });
    await Bun.sleep(30);

    const instance = await db
      .selectFrom("task_instance")
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(instance.status).toBe("failed");
    expect(instance.error).toContain("Invalid delegation args");
  });

  test("should record a failed instance", async () => {
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
    const id = await insertDelegation(db, "boom", {});

    const executor = new Executor({ db, getStrategy: (t) => registry.get(t) });
    await executor.trigger(id, { trigger: "manual" });
    await Bun.sleep(30);

    const instance = await db
      .selectFrom("task_instance")
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(instance.status).toBe("failed");
    expect(instance.error).toBe("kaboom");
  });

  test("should skip when a run is in progress under the skip policy", async () => {
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
    const id = await insertDelegation(db, "slow", {}, { concurrency: "skip" });

    const executor = new Executor({ db, getStrategy: (t) => registry.get(t) });
    const first = await executor.trigger(id, { trigger: "manual" });
    const second = await executor.trigger(id, { trigger: "manual" });
    expect(first.started).toBe(true);
    expect(second.started).toBe(false);
    expect(second.reason).toBe("skipped-running");
    await Bun.sleep(80);
  });

  test("should queue a run under the queue policy", async () => {
    db = await freshDb();
    let runs = 0;
    const def = defineTask({
      type: "slow",
      name: "Slow",
      args: z.object({}),
      handle: async () => {
        runs += 1;
        await Bun.sleep(30);
      },
    });
    const registry = new TaskRegistry().register(def);
    const id = await insertDelegation(db, "slow", {}, { concurrency: "queue" });

    const executor = new Executor({ db, getStrategy: (t) => registry.get(t) });
    await executor.trigger(id, { trigger: "manual" });
    const second = await executor.trigger(id, { trigger: "manual" });
    expect(second.started).toBe(false);
    expect(second.reason).toBe("queued");
    await Bun.sleep(100);
    expect(runs).toBe(2);
  });

  test("should reject an unknown delegation", async () => {
    db = await freshDb();
    const registry = new TaskRegistry();
    const executor = new Executor({ db, getStrategy: (t) => registry.get(t) });
    const res = await executor.trigger("nope", { trigger: "manual" });
    expect(res.started).toBe(false);
    expect(res.reason).toBe("unknown-delegation");
  });

  test("should reject a delegation whose strategy is unknown", async () => {
    db = await freshDb();
    const registry = new TaskRegistry();
    const id = await insertDelegation(db, "ghost", {});
    const executor = new Executor({ db, getStrategy: (t) => registry.get(t) });
    const res = await executor.trigger(id, { trigger: "manual" });
    expect(res.started).toBe(false);
    expect(res.reason).toBe("unknown-strategy");
  });

  test("should skip a disabled delegation for scheduled triggers", async () => {
    db = await freshDb();
    const def = defineTask({
      type: "job",
      name: "Job",
      args: z.object({}),
      handle: () => {},
    });
    const registry = new TaskRegistry().register(def);
    const id = await insertDelegation(db, "job", {}, { enabled: 0 });
    const executor = new Executor({ db, getStrategy: (t) => registry.get(t) });
    const res = await executor.trigger(id, { trigger: "schedule" });
    expect(res.started).toBe(false);
    expect(res.reason).toBe("disabled");
  });

  test("should mark a timed out run as timeout", async () => {
    db = await freshDb();
    const def = defineTask({
      type: "timeout",
      name: "Timeout",
      args: z.object({}),
      handle: async (ctx) => {
        await Bun.sleep(200);
        if (ctx.signal.aborted) throw new Error("aborted");
      },
    });
    const registry = new TaskRegistry().register(def);
    const id = await insertDelegation(db, "timeout", {}, { timeout_ms: 20 });

    const executor = new Executor({ db, getStrategy: (t) => registry.get(t) });
    await executor.trigger(id, { trigger: "manual" });
    await Bun.sleep(80);

    const instance = await db
      .selectFrom("task_instance")
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(instance.status).toBe("timeout");
  });

  test("should cancel a running instance", async () => {
    db = await freshDb();
    const def = defineTask({
      type: "slow",
      name: "Slow",
      args: z.object({}),
      handle: async (ctx) => {
        await Bun.sleep(200);
        if (ctx.signal.aborted) throw new Error("aborted");
      },
    });
    const registry = new TaskRegistry().register(def);
    const id = await insertDelegation(db, "slow", {});

    const executor = new Executor({ db, getStrategy: (t) => registry.get(t) });
    const res = await executor.trigger(id, { trigger: "manual" });
    expect(res.instanceId).toBeDefined();
    expect(executor.isRunning(id)).toBe(true);
    expect(executor.cancel(res.instanceId!)).toBe(true);
    expect(executor.cancel("missing")).toBe(false);
    await Bun.sleep(50);

    const instance = await db
      .selectFrom("task_instance")
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(instance.status).toBe("cancelled");
  });

  test("should invoke onSettled after an instance finishes", async () => {
    db = await freshDb();
    const def = defineTask({
      type: "job",
      name: "Job",
      args: z.object({}),
      handle: () => ({ ok: true }),
    });
    const registry = new TaskRegistry().register(def);
    const id = await insertDelegation(db, "job", {});

    const settled: string[] = [];
    const executor = new Executor({
      db,
      getStrategy: (t) => registry.get(t),
      onSettled: (delegationId) => {
        settled.push(delegationId);
      },
    });
    await executor.trigger(id, { trigger: "manual" });
    await Bun.sleep(30);
    expect(settled).toEqual([id]);
  });
});
