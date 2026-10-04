import { type Kysely, sql } from "kysely";
import type { PjhDB } from "./db.ts";

/**
 * Idempotent schema setup. Kept as plain SQL so it can run on every boot
 * without a migration bookkeeping table for this first iteration.
 *
 * Model:
 * - `task_strategy`   — code-defined task types (logic + params schema)
 * - `task_delegation` — configured, schedulable instances (seeded or user-created)
 * - `task_instance`   — one row per execution of a delegation
 * - `task_instance_log`
 *
 * @param db - Kysely instance to create the schema in.
 *
 * @example
 * ```ts
 * const db = new Kysely<PjhDB>({ dialect: new BunSqliteDialect({ url: ":memory:" }) });
 * await migrate(db);
 * const tables = await db.introspection.getTables();
 * // => [task_strategy, task_delegation, task_instance, task_instance_log]
 * ```
 */
export async function migrate(db: Kysely<PjhDB>): Promise<void> {
  await db.schema
    .createTable("task_strategy")
    .ifNotExists()
    .addColumn("type", "text", (c) => c.primaryKey())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("description", "text")
    .addColumn("params_schema", "text", (c) => c.notNull())
    .addColumn("default_schedule", "text")
    .addColumn("default_timezone", "text")
    .addColumn("default_timeout_ms", "integer")
    .addColumn("default_concurrency", "text")
    .addColumn("created_at", "text", (c) =>
      c.notNull().defaultTo(sql`(current_timestamp)`),
    )
    .addColumn("updated_at", "text", (c) =>
      c.notNull().defaultTo(sql`(current_timestamp)`),
    )
    .execute();

  await db.schema
    .createTable("task_delegation")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("type", "text", (c) =>
      c.notNull().references("task_strategy.type").onDelete("cascade"),
    )
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("args", "text", (c) => c.notNull().defaultTo("{}"))
    .addColumn("args_hash", "text", (c) => c.notNull())
    .addColumn("schedule", "text", (c) => c.notNull())
    .addColumn("timezone", "text")
    .addColumn("enabled", "integer", (c) => c.notNull().defaultTo(1))
    .addColumn("timeout_ms", "integer")
    .addColumn("concurrency", "text", (c) => c.notNull().defaultTo("skip"))
    .addColumn("last_run_at", "text")
    .addColumn("next_run_at", "text")
    .addColumn("created_at", "text", (c) =>
      c.notNull().defaultTo(sql`(current_timestamp)`),
    )
    .addColumn("updated_at", "text", (c) =>
      c.notNull().defaultTo(sql`(current_timestamp)`),
    )
    .execute();

  await db.schema
    .createIndex("idx_delegation_hash")
    .ifNotExists()
    .on("task_delegation")
    .columns(["args_hash"])
    .execute();

  await db.schema
    .createIndex("idx_delegation_type")
    .ifNotExists()
    .on("task_delegation")
    .columns(["type"])
    .execute();

  await db.schema
    .createTable("task_instance")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("delegation_id", "text", (c) =>
      c.notNull().references("task_delegation.id").onDelete("cascade"),
    )
    .addColumn("status", "text", (c) => c.notNull())
    .addColumn("trigger", "text", (c) => c.notNull())
    .addColumn("queued_at", "text", (c) => c.notNull())
    .addColumn("started_at", "text")
    .addColumn("finished_at", "text")
    .addColumn("duration_ms", "integer")
    .addColumn("result", "text")
    .addColumn("error", "text")
    .execute();

  await db.schema
    .createTable("task_instance_log")
    .ifNotExists()
    .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
    .addColumn("instance_id", "text", (c) =>
      c.notNull().references("task_instance.id").onDelete("cascade"),
    )
    .addColumn("ts", "text", (c) => c.notNull())
    .addColumn("level", "text", (c) => c.notNull())
    .addColumn("message", "text", (c) => c.notNull())
    .addColumn("data", "text")
    .execute();

  // Drop legacy tables from the previous (code-auto-synced) model if present.
  await db.schema.dropTable("task").ifExists().execute();

  await db.schema
    .createIndex("idx_instance_delegation")
    .ifNotExists()
    .on("task_instance")
    .columns(["delegation_id"])
    .execute();

  await db.schema
    .createIndex("idx_instance_status")
    .ifNotExists()
    .on("task_instance")
    .columns(["status"])
    .execute();

  await db.schema
    .createIndex("idx_log_instance")
    .ifNotExists()
    .on("task_instance_log")
    .columns(["instance_id"])
    .execute();
}
