import { afterEach, describe, expect, test } from "bun:test";
import type { PjhDB } from "@pjh/task";
import { defineTask } from "@pjh/task";
import type { Kysely } from "kysely";
import { pruneOrphans, syncTasks } from "../src/engine/loader.ts";
import { freshDb } from "./helpers.ts";

let db: Kysely<PjhDB>;

afterEach(async () => {
  await db?.destroy();
});

describe("loader", () => {
  test("creates tasks from definitions", async () => {
    db = await freshDb();
    const result = await syncTasks(db, [
      defineTask({ id: "a", name: "A", schedule: "@daily", handle: () => {} }),
    ]);
    expect(result.created).toEqual(["a"]);
    const row = await db.selectFrom("task").selectAll().executeTakeFirstOrThrow();
    expect(row.enabled).toBe(1);
    expect(row.concurrency).toBe("skip");
  });

  test("preserves runtime fields on re-sync", async () => {
    db = await freshDb();
    const def = defineTask({
      id: "a",
      name: "A",
      schedule: "@daily",
      handle: () => {},
    });
    await syncTasks(db, [def]);
    await db
      .updateTable("task")
      .set({ enabled: 0, schedule: "0 5 * * *", concurrency: "queue" })
      .where("id", "=", "a")
      .execute();

    const res = await syncTasks(db, [def]);
    expect(res.updated).toEqual(["a"]);

    const row = await db.selectFrom("task").selectAll().executeTakeFirstOrThrow();
    expect(row.enabled).toBe(0);
    expect(row.schedule).toBe("0 5 * * *");
    expect(row.concurrency).toBe("queue");
    expect(row.name).toBe("A");
  });

  test("prunes orphan tasks", async () => {
    db = await freshDb();
    await syncTasks(db, [
      defineTask({ id: "keep", name: "Keep", schedule: "@daily", handle: () => {} }),
      defineTask({ id: "drop", name: "Drop", schedule: "@daily", handle: () => {} }),
    ]);
    const removed = await pruneOrphans(db, ["keep"]);
    expect(removed).toBe(1);
    const rows = await db.selectFrom("task").select("id").execute();
    expect(rows.map((r) => r.id)).toEqual(["keep"]);
  });
});
