import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { PjhDB } from "@pjh/task";
import { Kysely, sql } from "kysely";
import { BunSqliteDialect } from "kysely-bun-worker/normal";

let instance: Kysely<PjhDB> | undefined;

/**
 * Creates a new SQLite-backed Kysely instance and applies the recommended
 * PRAGMAs (WAL journaling, foreign keys, busy timeout). The parent directory
 * of a file path is created when missing.
 *
 * @param path - SQLite file path, or `":memory:"` for an ephemeral database.
 * @returns A ready-to-use Kysely query builder.
 *
 * @example
 * ```ts
 * const db = await createDb("./data/pjh.sqlite");
 * const mem = await createDb(":memory:");
 * ```
 */
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

/**
 * Returns the shared singleton database created by {@link initDb}.
 *
 * @throws If {@link initDb} has not been called yet.
 *
 * @example
 * ```ts
 * const db = getDb();
 * ```
 */
export function getDb(): Kysely<PjhDB> {
  if (!instance) {
    throw new Error("Database has not been initialized. Call initDb() first.");
  }
  return instance;
}

/**
 * Shared singleton used by the running server. Tests create their own.
 *
 * @param path - SQLite file path, or `":memory:"`.
 * @returns The shared Kysely instance, creating it on first call.
 *
 * @example
 * ```ts
 * const db = await initDb(config.databaseUrl);
 * ```
 */
export async function initDb(path: string): Promise<Kysely<PjhDB>> {
  if (!instance) {
    instance = await createDb(path);
  }
  return instance;
}
