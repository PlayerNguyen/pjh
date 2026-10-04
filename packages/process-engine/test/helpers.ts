import type { PjhDB } from "@pjh/task";
import { argsHash, migrate } from "@pjh/task";
import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-worker/normal";

/**
 * Create an in-memory SQLite database with the full schema applied.
 *
 * @returns A migrated Kysely instance for tests.
 *
 * @example
 * ```ts
 * const db = await freshDb();
 * await db.destroy();
 * ```
 */
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

/**
 * Insert a delegation row with sensible defaults for tests.
 *
 * @param db - Target database.
 * @param type - Strategy type.
 * @param args - Delegation arguments.
 * @param overrides - Field overrides (id, name, concurrency, enabled, timeout).
 * @returns The inserted delegation id.
 *
 * @example
 * ```ts
 * const id = await insertDelegation(db, "job", { target: "a" });
 * ```
 */
export async function insertDelegation(
  db: Kysely<PjhDB>,
  type: string,
  args: unknown,
  overrides: Partial<{
    id: string;
    name: string;
    concurrency: string;
    enabled: number;
    timeout_ms: number | null;
  }> = {},
): Promise<string> {
  const id = overrides.id ?? crypto.randomUUID();
  await db
    .insertInto("task_delegation")
    .values({
      id,
      type,
      name: overrides.name ?? type,
      args: JSON.stringify(args),
      args_hash: argsHash(type, args),
      schedule: "* * * * *",
      timezone: null,
      enabled: overrides.enabled ?? 1,
      timeout_ms: overrides.timeout_ms ?? null,
      concurrency: (overrides.concurrency ?? "skip") as "skip",
      last_run_at: null,
      next_run_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .execute();
  return id;
}
