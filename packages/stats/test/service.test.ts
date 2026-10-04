import { afterEach, describe, expect, test } from "bun:test";
import type { PjhDB } from "@pjh/task";
import { migrate } from "@pjh/task";
import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-worker/normal";
import { stats } from "../src/service.ts";

let db: Kysely<PjhDB>;

afterEach(async () => {
  await db?.destroy();
});

async function freshDb(): Promise<Kysely<PjhDB>> {
  const instance = new Kysely<PjhDB>({
    dialect: new BunSqliteDialect({
      url: ":memory:",
      dbOptions: { create: true, strict: true },
    }),
  });
  await migrate(instance);
  return instance;
}

async function seedStrategy() {
  await db
    .insertInto("task_strategy")
    .values({
      type: "heartbeat",
      name: "Heartbeat",
      description: null,
      params_schema: "{}",
      default_schedule: null,
      default_timezone: null,
      default_timeout_ms: null,
      default_concurrency: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .execute();
}

describe("stats", () => {
  test("should return zeroed counts for an empty database", async () => {
    db = await freshDb();
    const result = await stats(db);
    expect(result.strategies).toBe(0);
    expect(result.total).toBe(0);
    expect(result.enabled).toBe(0);
    expect(result.running).toBe(0);
  });

  test("should count strategies, delegations and instance statuses", async () => {
    db = await freshDb();
    await seedStrategy();

    await db
      .insertInto("task_delegation")
      .values({
        id: "d1",
        type: "heartbeat",
        name: "Heartbeat",
        args: "{}",
        args_hash: "h1",
        schedule: "* * * * *",
        timezone: null,
        enabled: 1,
        timeout_ms: null,
        concurrency: "skip",
        last_run_at: null,
        next_run_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute();

    await db
      .insertInto("task_instance")
      .values({
        id: "i1",
        delegation_id: "d1",
        status: "succeeded",
        trigger: "manual",
        queued_at: new Date().toISOString(),
        started_at: null,
        finished_at: null,
        duration_ms: 5,
        result: null,
        error: null,
      })
      .execute();

    const result = await stats(db);
    expect(result.strategies).toBe(1);
    expect(result.total).toBe(1);
    expect(result.enabled).toBe(1);
    expect(result.byStatus.succeeded).toBe(1);
    expect(result.byStatus.running).toBe(0);
  });
});
