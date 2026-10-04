import { beforeEach, describe, expect, test } from "bun:test";
import type { PjhDB } from "@pjh/task";
import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-worker/normal";
import { migrate } from "../src/db/migrations.ts";

export async function freshDb(): Promise<Kysely<PjhDB>> {
  const db = new Kysely<PjhDB>({
    dialect: new BunSqliteDialect({
      url: ":memory:",
      dbOptions: { create: true, strict: true },
    }),
  });
  await migrate(db);
  return db;
}

describe("migrations", () => {
  let db: Kysely<PjhDB>;

  beforeEach(async () => {
    db = await freshDb();
  });

  test("creates all tables", async () => {
    const tables = await db.introspection.getTables();
    const names = tables.map((t) => t.name).sort();
    expect(names).toEqual([
      "task_delegation",
      "task_instance",
      "task_instance_log",
      "task_strategy",
    ]);
  });
});
