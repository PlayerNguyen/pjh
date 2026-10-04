import type { Kysely } from "kysely";
import type { PjhDB, TaskConcurrency, TaskInstanceTrigger } from "./db.ts";

export interface LogEntry {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  data?: unknown;
}

export interface TaskContext {
  /** Unique id of the running TaskInstance row. */
  instanceId: string;
  /** Task id this instance belongs to. */
  taskId: string;
  /** What caused this instance to start. */
  trigger: TaskInstanceTrigger;
  /** Fast, type-safe query builder over the shared SQLite database. */
  db: Kysely<PjhDB>;
  /** Append a line to this instance's log. */
  log: (level: LogEntry["level"], message: string, data?: unknown) => void;
  /** Aborted on timeout or manual cancellation. */
  signal: AbortSignal;
  /** Arbitrary input for manually triggered runs. */
  payload?: unknown;
}

/** Value returned by a task handler, persisted on the TaskInstance row. */
export type TaskResult =
  | undefined
  | null
  | Record<string, unknown>
  | string
  | number
  | boolean;

export interface TaskDefinition {
  /** Stable, unique identifier for the task. */
  id: string;
  /** Human readable name shown in the dashboard. */
  name: string;
  description?: string;
  /** Cron expression (5-field or nickname such as `@hourly`). */
  schedule: string;
  /** IANA timezone the schedule is evaluated in. Defaults to server zone. */
  timezone?: string;
  /** Whether the task is active. Defaults to true. */
  enabled?: boolean;
  /** Hard timeout in milliseconds. 0 or undefined means no timeout. */
  timeoutMs?: number;
  /** Behavior when the task is triggered while already running. Defaults to "skip". */
  concurrency?: TaskConcurrency;
  /** The work to perform. Called once per TaskInstance. */
  handle: (ctx: TaskContext) => Promise<TaskResult> | TaskResult;
}

/**
 * Identity helper that gives task definitions full type-checking and
 * autocompletion at the definition site.
 */
export function defineTask(def: TaskDefinition): TaskDefinition {
  return def;
}
