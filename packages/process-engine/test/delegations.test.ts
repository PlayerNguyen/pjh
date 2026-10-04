import { afterEach, describe, expect, test } from "bun:test";
import type { PjhDB } from "@pjh/task";
import { defineTask, TaskRegistry } from "@pjh/task";
import type { Kysely } from "kysely";
import { z } from "zod";
import { DelegationService } from "../src/delegations.ts";
import { Scheduler } from "../src/scheduler.ts";
import { freshDb } from "./helpers.ts";

let db: Kysely<PjhDB>;

afterEach(async () => {
  await db?.destroy();
});

async function setup() {
  db = await freshDb();
  const def = defineTask({
    type: "job",
    name: "Job",
    args: z.object({ target: z.string() }),
    defaultSchedule: "@hourly",
    defaultTimeoutMs: 1234,
    defaultConcurrency: "queue",
    handle: () => ({ ok: true }),
  });
  const registry = new TaskRegistry().register(def);
  const scheduler = new Scheduler(db, async () => {});
  const service = new DelegationService(db, (t) => registry.get(t), scheduler);
  return { service, scheduler };
}

describe("DelegationService", () => {
  test("should create a delegation applying strategy defaults", async () => {
    const { service } = await setup();
    const result = await service.create({
      type: "job",
      name: "A",
      args: { target: "a" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = await db
      .selectFrom("task_delegation")
      .selectAll()
      .where("id", "=", result.id)
      .executeTakeFirstOrThrow();
    expect(row.schedule).toBe("@hourly");
    expect(row.timeout_ms).toBe(1234);
    expect(row.concurrency).toBe("queue");
    expect(row.enabled).toBe(1);
  });

  test("should reject an unknown strategy", async () => {
    const { service } = await setup();
    const result = await service.create({ type: "nope", name: "N" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unknown-strategy");
  });

  test("should reject invalid args", async () => {
    const { service } = await setup();
    const result = await service.create({
      type: "job",
      name: "A",
      args: { target: 123 },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid-args");
  });

  test("should detect duplicate type+args regardless of name", async () => {
    const { service } = await setup();
    const first = await service.create({
      type: "job",
      name: "First",
      args: { target: "a" },
    });
    expect(first.ok).toBe(true);

    const second = await service.create({
      type: "job",
      name: "Second",
      args: { target: "a" },
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe("duplicate-args");
  });

  test("should reject an invalid schedule", async () => {
    const { service } = await setup();
    const result = await service.create({
      type: "job",
      name: "A",
      args: { target: "a" },
      schedule: "not a cron",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid-schedule");
  });

  test("should exclude the given id from duplicate detection", async () => {
    const { service } = await setup();
    const created = await service.create({
      type: "job",
      name: "A",
      args: { target: "a" },
    });
    if (!created.ok) throw new Error("setup failed");
    const dup = await service.findDuplicate("job", { target: "a" });
    expect(dup).toBe(created.id);
    const excluded = await service.findDuplicate("job", { target: "a" }, created.id);
    expect(excluded).toBeUndefined();
  });

  test("should update fields and reject duplicate args", async () => {
    const { service } = await setup();
    const a = await service.create({ type: "job", name: "A", args: { target: "a" } });
    const b = await service.create({ type: "job", name: "B", args: { target: "b" } });
    if (!a.ok || !b.ok) throw new Error("setup failed");

    const renamed = await service.update(a.id, { name: "Renamed", enabled: false });
    expect(renamed.ok).toBe(true);
    const row = await db
      .selectFrom("task_delegation")
      .selectAll()
      .where("id", "=", a.id)
      .executeTakeFirstOrThrow();
    expect(row.name).toBe("Renamed");
    expect(row.enabled).toBe(0);

    const conflict = await service.update(a.id, { args: { target: "b" } });
    expect(conflict.ok).toBe(false);
    if (conflict.ok) return;
    expect(conflict.error.code).toBe("duplicate-args");
  });

  test("should return not-found when updating an unknown id", async () => {
    const { service } = await setup();
    const result = await service.update("missing", { name: "X" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not-found");
  });

  test("should report whether a row was deleted", async () => {
    const { service } = await setup();
    const created = await service.create({
      type: "job",
      name: "A",
      args: { target: "a" },
    });
    if (!created.ok) throw new Error("setup failed");
    expect(await service.remove(created.id)).toBe(true);
    expect(await service.remove(created.id)).toBe(false);
  });

  test("should re-register the cron job on reschedule", async () => {
    const { service } = await setup();
    const created = await service.create({
      type: "job",
      name: "A",
      args: { target: "a" },
    });
    if (!created.ok) throw new Error("setup failed");
    await service.reschedule(created.id);
    const row = await db
      .selectFrom("task_delegation")
      .select(["next_run_at"])
      .where("id", "=", created.id)
      .executeTakeFirstOrThrow();
    expect(row.next_run_at).not.toBeNull();
  });
});
