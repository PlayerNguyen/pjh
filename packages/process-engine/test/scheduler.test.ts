import { afterEach, describe, expect, test } from "bun:test";
import type { PjhDB } from "@pjh/task";
import type { Kysely } from "kysely";
import { loadEnabledDelegations, Scheduler } from "../src/scheduler.ts";
import { freshDb, insertDelegation } from "./helpers.ts";

let db: Kysely<PjhDB>;

afterEach(async () => {
  await db?.destroy();
});

describe("Scheduler", () => {
  test("should validate cron expressions and reject invalid ones", () => {
    const scheduler = new Scheduler(
      // A scheduler needs a db only when scheduling jobs; validation is pure.
      {} as Kysely<PjhDB>,
      async () => {},
    );
    expect(() => scheduler.validate("* * * * *")).not.toThrow();
    expect(() => scheduler.validate("not a cron")).toThrow();
  });

  test("should compute the next run time", () => {
    const scheduler = new Scheduler({} as Kysely<PjhDB>, async () => {});
    const next = scheduler.nextRun("0 3 * * *", "UTC");
    expect(next).toBeInstanceOf(Date);
  });

  test("should register a job and persist next_run_at", async () => {
    db = await freshDb();
    const scheduler = new Scheduler(db, async () => {});
    const id = await insertDelegation(db, "job", {});
    await scheduler.schedule({
      id,
      schedule: "* * * * *",
      timezone: null,
      enabled: true,
    });

    const row = await db
      .selectFrom("task_delegation")
      .select("next_run_at")
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
    expect(row.next_run_at).not.toBeNull();
    expect(scheduler.nextFire(id)).toBeInstanceOf(Date);
    scheduler.stopAll();
  });

  test("should clear next_run_at when scheduling a disabled delegation", async () => {
    db = await freshDb();
    const scheduler = new Scheduler(db, async () => {});
    const id = await insertDelegation(db, "job", {}, { enabled: 0 });
    await scheduler.schedule({
      id,
      schedule: "* * * * *",
      timezone: null,
      enabled: false,
    });
    const row = await db
      .selectFrom("task_delegation")
      .select("next_run_at")
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
    expect(row.next_run_at).toBeNull();
    expect(scheduler.nextFire(id)).toBeNull();
  });

  test("should unschedule a job", async () => {
    db = await freshDb();
    const scheduler = new Scheduler(db, async () => {});
    const id = await insertDelegation(db, "job", {});
    await scheduler.schedule({
      id,
      schedule: "* * * * *",
      timezone: null,
      enabled: true,
    });
    expect(scheduler.nextFire(id)).toBeInstanceOf(Date);
    scheduler.unschedule(id);
    expect(scheduler.nextFire(id)).toBeNull();
  });

  test("should load only enabled delegations", async () => {
    db = await freshDb();
    await insertDelegation(db, "job", {}, { enabled: 1 });
    await insertDelegation(db, "job", {}, { enabled: 0 });
    const enabled = await loadEnabledDelegations(db);
    expect(enabled).toHaveLength(1);
    expect(enabled[0]!.enabled).toBe(true);
  });
});
