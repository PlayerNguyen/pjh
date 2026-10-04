/**
 * Database schema consumed by task handlers and the core engine.
 *
 * A `TaskStrategy` (code) defines reusable logic and a parameter schema.
 * A `TaskDelegation` (row) is a configured, schedulable instance of a strategy
 * — created by a seed migration or by a user. `TaskInstance` records one row
 * per execution attempt, and `TaskInstanceLog` carries its log lines.
 */

export type TaskConcurrency = "skip" | "queue" | "parallel";

export type TaskInstanceStatus =
  | "running"
  | "succeeded"
  | "failed"
  | "timeout"
  | "cancelled";

export type TaskInstanceTrigger = "schedule" | "manual" | "retry";

/**
 * A code-defined task type. Descriptive fields (name, description, params
 * schema) come from code; there is one row per registered strategy.
 */
export interface TaskStrategyTable {
  type: string;
  name: string;
  description: string | null;
  /** JSON Schema (draft-07) of the strategy parameters, for UI rendering. */
  params_schema: string;
  /** Default cron schedule proposed when creating a delegation. */
  default_schedule: string | null;
  default_timezone: string | null;
  default_timeout_ms: number | null;
  default_concurrency: TaskConcurrency | null;
  created_at: string;
  updated_at: string;
}

/** A configured, schedulable instance of a task strategy. */
export interface TaskDelegationTable {
  id: string;
  type: string;
  name: string;
  /** Serialized, validated parameters for the strategy. */
  args: string;
  /** Stable hash of `type` + canonical `args`, for duplicate detection. */
  args_hash: string;
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
  /** References task_delegation.id */
  delegation_id: string;
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
  task_strategy: TaskStrategyTable;
  task_delegation: TaskDelegationTable;
  task_instance: TaskInstanceTable;
  task_instance_log: TaskInstanceLogTable;
}
