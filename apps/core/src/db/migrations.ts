import type { PjhDB } from "@pjh/task";
import { type Kysely, sql } from "kysely";

/**
 * Idempotent schema setup. Kept as plain SQL so it can run on every boot
 * without a migration bookkeeping table for this first iteration.
 */
export async function migrate(db: Kysely<PjhDB>): Promise<void> {
  await db.schema
    .createTable("task")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("description", "text")
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
    .createTable("task_instance")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("task_id", "text", (c) =>
      c.notNull().references("task.id").onDelete("cascade"),
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

  await db.schema
    .createIndex("idx_instance_task")
    .ifNotExists()
    .on("task_instance")
    .columns(["task_id"])
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
