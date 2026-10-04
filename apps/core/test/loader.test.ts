import { afterEach, describe, expect, test } from "bun:test";
import { pruneStrategies, seedDelegations, syncStrategies } from "@pjh/process-engine";
import type { PjhDB } from "@pjh/task";
import { defineTask } from "@pjh/task";
import type { Kysely } from "kysely";
import { z } from "zod";
import { freshDb } from "./helpers.ts";

let db: Kysely<PjhDB>;

afterEach(async () => {
  await db?.destroy();
});

function strategy(type: string) {
  return defineTask({
    type,
    name: type.toUpperCase(),
    args: z.object({ n: z.number().default(1) }),
    defaultSchedule: "@daily",
    defaultTimeoutMs: 1000,
    defaultConcurrency: "queue",
    handle: () => {},
  });
}

describe("loader", () => {
  test("should sync strategies from code", async () => {
    db = await freshDb();
    const result = await syncStrategies(db, [strategy("a")]);
    expect(result.created).toEqual(["a"]);

    const row = await db
      .selectFrom("task_strategy")
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(row.default_schedule).toBe("@daily");
    expect(row.default_timeout_ms).toBe(1000);
    expect(row.default_concurrency).toBe("queue");
    const schema = JSON.parse(row.params_schema) as { type: string };
    expect(schema.type).toBe("object");
  });

  test("should update descriptive fields on re-sync without touching delegations", async () => {
    db = await freshDb();
    const def = strategy("a");
    await syncStrategies(db, [def]);
    const res = await syncStrategies(db, [def]);
    expect(res.updated).toEqual(["a"]);
  });

  test("should prune orphan strategies", async () => {
    db = await freshDb();
    await syncStrategies(db, [strategy("keep"), strategy("drop")]);
    const removed = await pruneStrategies(db, ["keep"]);
    expect(removed).toBe(1);
    const rows = await db.selectFrom("task_strategy").select("type").execute();
    expect(rows.map((r) => r.type)).toEqual(["keep"]);
  });

  test("should seed delegations idempotently and preserve user edits", async () => {
    db = await freshDb();
    const def = strategy("a");
    await syncStrategies(db, [def]);

    const resolve = (type: string) => (type === "a" ? def.args : undefined);
    const first = await seedDelegations(
      db,
      [{ id: "seed-a", type: "a", name: "A", args: { n: 5 } }],
      resolve,
    );
    expect(first).toEqual(["seed-a"]);

    await db
      .updateTable("task_delegation")
      .set({ name: "Renamed", enabled: 0 })
      .where("id", "=", "seed-a")
      .execute();

    const second = await seedDelegations(
      db,
      [{ id: "seed-a", type: "a", name: "A", args: { n: 5 } }],
      resolve,
    );
    expect(second).toEqual([]);

    const row = await db
      .selectFrom("task_delegation")
      .selectAll()
      .where("id", "=", "seed-a")
      .executeTakeFirstOrThrow();
    expect(row.name).toBe("Renamed");
    expect(row.enabled).toBe(0);
    expect(JSON.parse(row.args)).toEqual({ n: 5 });
  });

  test("should apply schema defaults during seeding for consistent dedupe", async () => {
    db = await freshDb();
    const def = strategy("a");
    await syncStrategies(db, [def]);
    const resolve = (type: string) => (type === "a" ? def.args : undefined);

    await seedDelegations(
      db,
      [{ id: "seed-a", type: "a", name: "A", args: {} }],
      resolve,
    );

    const row = await db
      .selectFrom("task_delegation")
      .selectAll()
      .where("id", "=", "seed-a")
      .executeTakeFirstOrThrow();
    // Schema default for `n` is 1.
    expect(JSON.parse(row.args)).toEqual({ n: 1 });
  });
});
