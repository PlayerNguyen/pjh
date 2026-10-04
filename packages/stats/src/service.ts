import type { PjhDB, TaskInstanceStatus } from "@pjh/task";
import type { Kysely } from "kysely";

/**
 * Aggregate counts describing the current state of the system.
 *
 * @example
 * ```ts
 * const s: StatsShape = {
 *   strategies: 2,
 *   total: 1,
 *   enabled: 1,
 *   byStatus: { running: 0, succeeded: 1, failed: 0, timeout: 0, cancelled: 0 },
 *   running: 0,
 * };
 * ```
 */
export interface StatsShape {
  strategies: number;
  total: number;
  enabled: number;
  byStatus: Record<TaskInstanceStatus, number>;
  running: number;
}

/**
 * Compute dashboard statistics: strategy count, delegation totals and instance
 * counts grouped by status.
 *
 * @param db - Query builder over the shared SQLite database.
 * @returns Aggregate counts for the stats endpoint.
 *
 * @example
 * ```ts
 * const s = await stats(db);
 * // => { strategies: 1, total: 1, enabled: 1,
 * //      byStatus: { running: 0, succeeded: 1, ... }, running: 0 }
 * ```
 */
export async function stats(db: Kysely<PjhDB>): Promise<StatsShape> {
  const strategies = await db
    .selectFrom("task_strategy")
    .select(db.fn.count("type").as("count"))
    .executeTakeFirst();
  const delegations = await db
    .selectFrom("task_delegation")
    .select(["enabled"])
    .execute();
  const statuses = await db
    .selectFrom("task_instance")
    .select(["status", db.fn.count("id").as("count")])
    .groupBy("status")
    .execute();

  const byStatus: Record<string, number> = {
    running: 0,
    succeeded: 0,
    failed: 0,
    timeout: 0,
    cancelled: 0,
  };
  for (const s of statuses) byStatus[s.status] = Number(s.count);

  return {
    strategies: Number(strategies?.count ?? 0),
    total: delegations.length,
    enabled: delegations.filter((t) => t.enabled === 1).length,
    byStatus: byStatus as Record<TaskInstanceStatus, number>,
    running: byStatus.running ?? 0,
  };
}
