import type { TaskInstanceStatus } from "@pjh/task";

/**
 * Safely parse a JSON string, returning `fallback` when it is empty or invalid.
 *
 * @param value - Raw JSON text, typically a serialized column.
 * @param fallback - Value returned when parsing fails.
 * @returns The parsed value, or `fallback`.
 *
 * @example
 * ```ts
 * safeParse('{"a":1}', {}); // => { a: 1 }
 * safeParse("not json", {}); // => {}
 * ```
 */
export function safeParse(value: string, fallback: unknown): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Map a `task_strategy` row to the API DTO shape, decoding `params_schema`.
 *
 * @param row - Row from the `task_strategy` table.
 * @returns Strategy DTO with camelCase fields.
 *
 * @example
 * ```ts
 * strategyToDto({
 *   type: "heartbeat",
 *   name: "Heartbeat",
 *   description: null,
 *   params_schema: "{}",
 *   default_schedule: "@daily",
 *   default_timezone: null,
 *   default_timeout_ms: null,
 *   default_concurrency: "skip",
 * });
 * // => { type: "heartbeat", name: "Heartbeat", paramsSchema: {}, ... }
 * ```
 */
export function strategyToDto(row: {
  type: string;
  name: string;
  description: string | null;
  params_schema: string;
  default_schedule: string | null;
  default_timezone: string | null;
  default_timeout_ms: number | null;
  default_concurrency: string | null;
}): StrategyDto {
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

/**
 * Map a `task_delegation` row to the API DTO shape, decoding args and the
 * `enabled` integer flag.
 *
 * @param row - Row from the `task_delegation` table.
 * @returns Delegation DTO with camelCase fields.
 *
 * @example
 * ```ts
 * delegationToDto({
 *   id: "seed-heartbeat",
 *   type: "heartbeat",
 *   name: "Heartbeat",
 *   args: '{"message":"tick"}',
 *   schedule: "* * * * *",
 *   timezone: null,
 *   enabled: 1,
 *   timeout_ms: null,
 *   concurrency: "skip",
 *   last_run_at: null,
 *   next_run_at: null,
 *   created_at: "2026-01-01T00:00:00.000Z",
 *   updated_at: "2026-01-01T00:00:00.000Z",
 * });
 * // => { id: "seed-heartbeat", enabled: true, args: { message: "tick" }, ... }
 * ```
 */
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
}): DelegationDto {
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

/**
 * Map a `task_instance` row to the API DTO shape.
 *
 * @param row - Row from the `task_instance` table.
 * @returns Instance DTO with camelCase fields.
 *
 * @example
 * ```ts
 * instanceToDto({
 *   id: "inst-1",
 *   delegation_id: "seed-heartbeat",
 *   status: "succeeded",
 *   trigger: "manual",
 *   queued_at: "2026-01-01T00:00:00.000Z",
 *   started_at: "2026-01-01T00:00:00.000Z",
 *   finished_at: "2026-01-01T00:00:00.010Z",
 *   duration_ms: 10,
 *   result: '{"ok":true}',
 *   error: null,
 * });
 * // => { id: "inst-1", delegationId: "seed-heartbeat", status: "succeeded", ... }
 * ```
 */
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
}): InstanceDto {
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

/** API representation of a task strategy. */
export interface StrategyDto {
  type: string;
  name: string;
  description: string | null;
  paramsSchema: unknown;
  defaultSchedule: string | null;
  defaultTimezone: string | null;
  defaultTimeoutMs: number | null;
  defaultConcurrency: string | null;
}

/** API representation of a task delegation. */
export interface DelegationDto {
  id: string;
  type: string;
  name: string;
  args: unknown;
  schedule: string;
  timezone: string | null;
  enabled: boolean;
  timeoutMs: number | null;
  concurrency: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** API representation of a task instance. */
export interface InstanceDto {
  id: string;
  delegationId: string;
  status: string;
  trigger: string;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  result: string | null;
  error: string | null;
}

/** Aggregate counts returned by the API stats endpoint. */
export interface StatsShape {
  strategies: number;
  total: number;
  enabled: number;
  byStatus: Record<TaskInstanceStatus, number>;
  running: number;
}
