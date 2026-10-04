import type { PjhDB, TaskConcurrency, TaskDefinition } from "@pjh/task";
import { type Kysely, sql } from "kysely";

interface SyncResult {
  created: string[];
  updated: string[];
}

/**
 * Reconciles code-defined tasks into the `task` table.
 *
 * Code is the source of truth for descriptive fields (name, description).
 * Once a row exists, runtime fields (enabled, schedule, timezone, timeout,
 * concurrency) are preserved so dashboard edits survive restarts.
 */
export async function syncTasks(
  db: Kysely<PjhDB>,
  defs: TaskDefinition[],
  defaultEnabled = true,
): Promise<SyncResult> {
  const created: string[] = [];
  const updated: string[] = [];

  for (const def of defs) {
    const existing = await db
      .selectFrom("task")
      .select(["id", "next_run_at"])
      .where("id", "=", def.id)
      .executeTakeFirst();

    const now = new Date().toISOString();

    if (existing) {
      await db
        .updateTable("task")
        .set({
          name: def.name,
          description: def.description ?? null,
          updated_at: now,
        })
        .where("id", "=", def.id)
        .execute();
      updated.push(def.id);
      continue;
    }

    await db
      .insertInto("task")
      .values({
        id: def.id,
        name: def.name,
        description: def.description ?? null,
        schedule: def.schedule,
        timezone: def.timezone ?? null,
        enabled: (def.enabled ?? defaultEnabled) ? 1 : 0,
        timeout_ms: def.timeoutMs ?? null,
        concurrency: (def.concurrency ?? "skip") as TaskConcurrency,
        last_run_at: null,
        next_run_at: null,
        created_at: now,
        updated_at: now,
      })
      .execute();
    created.push(def.id);
  }

  return { created, updated };
}

export async function pruneOrphans(
  db: Kysely<PjhDB>,
  knownIds: string[],
): Promise<number> {
  if (knownIds.length === 0) {
    const res = await db.deleteFrom("task").executeTakeFirst();
    return Number(res.numDeletedRows ?? 0n);
  }

  const res = await db
    .deleteFrom("task")
    .where(sql<boolean>`id NOT IN (${sql.join(knownIds)})`)
    .executeTakeFirst();

  return Number(res.numDeletedRows ?? 0n);
}
