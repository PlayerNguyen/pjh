import type { PjhDB, TaskInstanceStatus } from "@pjh/task";
import type { Kysely } from "kysely";

export function taskToDto(row: {
  id: string;
  name: string;
  description: string | null;
  schedule: string;
  timezone: string | null;
  enabled: number;
  timeout_ms: number | null;
  concurrency: string;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    schedule: row.schedule,
    timezone: row.timezone,
    enabled: row.enabled === 1,
    timeoutMs: row.timeout_ms,
    concurrency: row.concurrency,
    lastRunAt: row.last_run_at,
    nextRunAt: row.next_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function instanceToDto(row: {
  id: string;
  task_id: string;
  status: string;
  trigger: string;
  queued_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  result: string | null;
  error: string | null;
}) {
  return {
    id: row.id,
    taskId: row.task_id,
    status: row.status,
    trigger: row.trigger,
    queuedAt: row.queued_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
    result: row.result,
    error: row.error,
  };
}

export interface StatsShape {
  total: number;
  enabled: number;
  byStatus: Record<TaskInstanceStatus, number>;
  running: number;
}

export async function stats(db: Kysely<PjhDB>): Promise<StatsShape> {
  const tasks = await db.selectFrom("task").select(["enabled"]).execute();
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
    total: tasks.length,
    enabled: tasks.filter((t) => t.enabled === 1).length,
    byStatus: byStatus as Record<TaskInstanceStatus, number>,
    running: byStatus.running ?? 0,
  };
}
