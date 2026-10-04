import { afterEach, describe, expect, test } from "bun:test";
import type { PjhDB } from "@pjh/task";
import { defineTask, TaskRegistry } from "@pjh/task";
import type { Kysely } from "kysely";
import { Executor } from "../src/engine/executor.ts";
import { syncTasks } from "../src/engine/loader.ts";
import { freshDb } from "./helpers.ts";

let db: Kysely<PjhDB>;

afterEach(async () => {
  await db?.destroy();
});

function makeDb() {
  return freshDb();
}

describe("executor", () => {
  test("records a successful instance", async () => {
    db = await makeDb();
    const def = defineTask({
      id: "ok",
      name: "OK",
      schedule: "* * * * *",
      handle: (ctx) => {
        ctx.log("info", "hello");
        return { value: 42 };
      },
    });
    const registry = new TaskRegistry().register(def);
    await syncTasks(db, registry.list());

    const executor = new Executor({ db, getTask: (id) => registry.get(id) });
    const res = await executor.trigger("ok", { trigger: "manual" });
    expect(res.started).toBe(true);
    await Bun.sleep(30);

    const instance = await db
      .selectFrom("task_instance")
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(instance.status).toBe("succeeded");
    expect(instance.result).toBe(JSON.stringify({ value: 42 }));

    const logs = await db.selectFrom("task_instance_log").selectAll().execute();
    expect(logs).toHaveLength(1);
    expect(logs[0]!.message).toBe("hello");
  });

  test("records a failed instance", async () => {
    db = await makeDb();
    const def = defineTask({
      id: "boom",
      name: "Boom",
      schedule: "* * * * *",
      handle: () => {
        throw new Error("kaboom");
      },
    });
    const registry = new TaskRegistry().register(def);
    await syncTasks(db, registry.list());

    const executor = new Executor({ db, getTask: (id) => registry.get(id) });
    await executor.trigger("boom", { trigger: "manual" });
    await Bun.sleep(30);

    const instance = await db
      .selectFrom("task_instance")
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(instance.status).toBe("failed");
    expect(instance.error).toBe("kaboom");
  });

  test("skips when a run is in progress (skip policy)", async () => {
    db = await makeDb();
    const def = defineTask({
      id: "slow",
      name: "Slow",
      schedule: "* * * * *",
      handle: async () => {
        await Bun.sleep(50);
      },
    });
    const registry = new TaskRegistry().register(def);
    await syncTasks(db, registry.list());

    const executor = new Executor({ db, getTask: (id) => registry.get(id) });
    const first = await executor.trigger("slow", { trigger: "manual" });
    const second = await executor.trigger("slow", { trigger: "manual" });
    expect(first.started).toBe(true);
    expect(second.started).toBe(false);
    expect(second.reason).toBe("skipped-running");
    await Bun.sleep(80);
  });

  test("timed out run is marked as timeout", async () => {
    db = await makeDb();
    const def = defineTask({
      id: "timeout",
      name: "Timeout",
      schedule: "* * * * *",
      timeoutMs: 20,
      handle: async (ctx) => {
        await Bun.sleep(200);
        if (ctx.signal.aborted) throw new Error("aborted");
      },
    });
    const registry = new TaskRegistry().register(def);
    await syncTasks(db, registry.list());

    const executor = new Executor({ db, getTask: (id) => registry.get(id) });
    await executor.trigger("timeout", { trigger: "manual" });
    await Bun.sleep(80);

    const instance = await db
      .selectFrom("task_instance")
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(instance.status).toBe("timeout");
  });
});
