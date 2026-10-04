import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { PjhDB } from "@pjh/task";
import { Kysely, sql } from "kysely";
import { BunSqliteDialect } from "kysely-bun-worker/normal";

let instance: Kysely<PjhDB> | undefined;

export async function createDb(path: string): Promise<Kysely<PjhDB>> {
  if (path !== ":memory:") {
    await mkdir(dirname(path), { recursive: true });
  }

  const db = new Kysely<PjhDB>({
    dialect: new BunSqliteDialect({
      url: path,
      dbOptions: { create: true, strict: true },
    }),
  });

  await sql`PRAGMA journal_mode = WAL`.execute(db);
  await sql`PRAGMA foreign_keys = ON`.execute(db);
  await sql`PRAGMA busy_timeout = 5000`.execute(db);

  return db;
}

export function getDb(): Kysely<PjhDB> {
  if (!instance) {
    throw new Error("Database has not been initialized. Call initDb() first.");
  }
  return instance;
}

/** Shared singleton used by the running server. Tests create their own. */
export async function initDb(path: string): Promise<Kysely<PjhDB>> {
  if (!instance) {
    instance = await createDb(path);
  }
  return instance;
}
