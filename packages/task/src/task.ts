import type { Kysely } from "kysely";
import type { z } from "zod";
import type { PjhDB, TaskConcurrency, TaskInstanceTrigger } from "./db.ts";

export interface LogEntry {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  data?: unknown;
}

/** A task strategy with no parameters. */
export type EmptyArgsSchema = z.ZodType<unknown>;

/**
 * Runtime context passed to a task handler. `args` is the validated,
 * strategy-specific configuration of the delegation being run.
 */
export interface TaskContext<Args = unknown> {
  /** Unique id of the running TaskInstance row. */
  instanceId: string;
  /** Delegation id this instance belongs to. */
  delegationId: string;
  /** Strategy type of the delegation. */
  type: string;
  /** Delegation display name. */
  taskName: string;
  /** What caused this instance to start. */
  trigger: TaskInstanceTrigger;
  /** Validated delegation arguments. */
  args: Args;
  /** Fast, type-safe query builder over the shared SQLite database. */
  db: Kysely<PjhDB>;
  /** Append a line to this instance's log. */
  log: (level: LogEntry["level"], message: string, data?: unknown) => void;
  /** Aborted on timeout or manual cancellation. */
  signal: AbortSignal;
  /** Arbitrary input for manually triggered runs, merged over `args` if provided. */
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

/**
 * A code-defined task strategy (the "strategy pattern").
 *
 * Strategies carry the executable logic plus the parameter contract (`args`)
 * used to render forms in the dashboard and to validate delegations. They are
 * registered from code and mirrored into the `task_strategy` table — they are
 * never created by the web user.
 */
// biome-ignore lint/suspicious/noExplicitAny: default generic keeps the registry type usable
export interface TaskDefinition<Args = any> {
  /** Stable, unique strategy type (e.g. `"backup"`). */
  type: string;
  /** Human readable name shown in the dashboard. */
  name: string;
  description?: string;
  /**
   * Zod schema describing this strategy's parameters. Use `z.object({})` for
   * a parametrized task with no arguments. Converted to JSON Schema for the UI.
   */
  args: z.ZodType<Args>;
  /** Default cron schedule proposed when creating a delegation. */
  defaultSchedule?: string;
  /** Default IANA timezone for new delegations. */
  defaultTimezone?: string;
  /** Default hard timeout (ms) for new delegations. 0/undefined = none. */
  defaultTimeoutMs?: number;
  /** Default concurrency policy for new delegations. Defaults to "skip". */
  defaultConcurrency?: TaskConcurrency;
  /** The work to perform for a single delegation instance. */
  handle: (ctx: TaskContext<Args>) => Promise<TaskResult> | TaskResult;
}

/**
 * Identity helper that gives task strategies full type-checking and
 * autocompletion at the definition site. `Args` is inferred from the schema.
 */
export function defineTask<S extends z.ZodType>(
  def: Omit<TaskDefinition<z.infer<S>>, "args"> & { args: S },
): TaskDefinition<z.infer<S>> {
  return def as TaskDefinition<z.infer<S>>;
}
