import type { PjhDB, TaskInstanceStatus } from "@pjh/task";
import type { Kysely } from "kysely";

export function strategyToDto(row: {
  type: string;
  name: string;
  description: string | null;
  params_schema: string;
  default_schedule: string | null;
  default_timezone: string | null;
  default_timeout_ms: number | null;
  default_concurrency: string | null;
}) {
  return {
    type: row.type,
    name: row.name,
    description: row.description,
    paramsSchema: safeParse(row.params_schema, {}),
    defaultSchedule: row.default_schedule,
    defaultTimezone: row.default_timezone,
    defaultTimeoutMs: row.default_timeout_ms,
    defaultConcurrency: row.default_concurrency,
  };
}

export function delegationToDto(row: {
  id: string;
  type: string;
  name: string;
  args: string;
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
    type: row.type,
    name: row.name,
    args: safeParse(row.args, {}),
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
  delegation_id: string;
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
    delegationId: row.delegation_id,
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
  strategies: number;
  total: number;
  enabled: number;
  byStatus: Record<TaskInstanceStatus, number>;
  running: number;
}

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

function safeParse(value: string, fallback: unknown): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
