/**
 * Database schema consumed by task handlers and the core engine.
 *
 * The `Task` table holds the runtime state of every code-defined task, while
 * `TaskInstance` records one row per execution attempt. `TaskInstanceLog`
 * carries the log lines emitted by a single instance.
 */

export type TaskConcurrency = "skip" | "queue" | "parallel";

export type TaskInstanceStatus =
  | "running"
  | "succeeded"
  | "failed"
  | "timeout"
  | "cancelled";

export type TaskInstanceTrigger = "schedule" | "manual" | "retry";

export interface TaskTable {
  id: string;
  name: string;
  description: string | null;
  schedule: string;
  timezone: string | null;
  enabled: number;
  timeout_ms: number | null;
  concurrency: TaskConcurrency;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskInstanceTable {
  id: string;
  task_id: string;
  status: TaskInstanceStatus;
  trigger: TaskInstanceTrigger;
  queued_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  result: string | null;
  error: string | null;
}

export interface TaskInstanceLogTable {
  id: number;
  instance_id: string;
  ts: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  data: string | null;
}

export interface PjhDB {
  task: TaskTable;
  task_instance: TaskInstanceTable;
  task_instance_log: TaskInstanceLogTable;
}
