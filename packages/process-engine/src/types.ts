import type {
  PjhDB,
  TaskConcurrency,
  TaskDefinition,
  TaskInstanceTrigger,
} from "@pjh/task";
import type { Kysely } from "kysely";
import type { z } from "zod";

/**
 * Input accepted when creating a delegation via {@link DelegationService.create}.
 *
 * @example
 * ```ts
 * const input: CreateDelegationInput = {
 *   type: "heartbeat",
 *   name: "Heartbeat",
 *   args: { message: "tick" },
 *   schedule: "* * * * *",
 * };
 * ```
 */
export interface CreateDelegationInput {
  type: string;
  name: string;
  args?: unknown;
  schedule?: string;
  timezone?: string | null;
  enabled?: boolean;
  timeoutMs?: number | null;
  concurrency?: TaskConcurrency;
}

/**
 * Partial update accepted by {@link DelegationService.update}. Every field is
 * optional; omitted fields keep their stored value.
 *
 * @example
 * ```ts
 * const patch: UpdateDelegationInput = { enabled: false };
 * ```
 */
export interface UpdateDelegationInput {
  name?: string;
  args?: unknown;
  schedule?: string;
  timezone?: string | null;
  enabled?: boolean;
  timeoutMs?: number | null;
  concurrency?: TaskConcurrency;
}

/**
 * Discriminated union of every error a delegation service can return. Each
 * `code` maps to an HTTP status in the API layer.
 *
 * @example
 * ```ts
 * const error: ServiceError = { code: "not-found", message: "Delegation not found" };
 * ```
 */
export type ServiceError =
  | { code: "unknown-strategy"; message: string }
  | { code: "invalid-args"; message: string; issues: unknown }
  | { code: "invalid-schedule"; message: string }
  | { code: "duplicate-args"; message: string; existingId: string }
  | { code: "not-found"; message: string };

/**
 * Dependencies required to construct an {@link Executor}.
 *
 * @example
 * ```ts
 * const deps: ExecutorDeps = { db, getStrategy };
 * ```
 */
export interface ExecutorDeps {
  db: Kysely<PjhDB>;
  /** Resolve a strategy by its type from the code registry. */
  getStrategy: (type: string) => TaskDefinition | undefined;
  /** Called after an instance settles so the scheduler can refresh next_run_at. */
  onSettled?: (delegationId: string) => Promise<void> | void;
}

/**
 * Options describing how a delegation instance was triggered.
 *
 * @example
 * ```ts
 * const opts: TriggerOptions = { trigger: "manual", payload: { force: true } };
 * ```
 */
export interface TriggerOptions {
  trigger: TaskInstanceTrigger;
  payload?: unknown;
}

/**
 * Outcome of {@link Executor.trigger}. `started` is false when an existing run
 * blocked the attempt, in which case `reason` explains why.
 *
 * @example
 * ```ts
 * const result: TriggerResult = { started: true, instanceId: "abc" };
 * ```
 */
export interface TriggerResult {
  started: boolean;
  instanceId?: string;
  reason?:
    | "disabled"
    | "unknown-delegation"
    | "unknown-strategy"
    | "skipped-running"
    | "queued";
}

/**
 * Minimal delegation shape the scheduler needs to register a cron job.
 *
 * @example
 * ```ts
 * const input: DelegationInput = {
 *   id: "seed-heartbeat",
 *   schedule: "* * * * *",
 *   timezone: "UTC",
 *   enabled: true,
 * };
 * ```
 */
export interface DelegationInput {
  id: string;
  schedule: string;
  timezone: string | null;
  enabled: boolean;
}

/**
 * Persisted delegation row used internally by {@link Executor}.
 *
 * @example
 * ```ts
 * const row: DelegationRow = {
 *   id: "seed-heartbeat",
 *   type: "heartbeat",
 *   name: "Heartbeat",
 *   args: "{}",
 *   enabled: 1,
 *   concurrency: "skip",
 *   timeout_ms: null,
 * };
 * ```
 */
export interface DelegationRow {
  id: string;
  type: string;
  name: string;
  args: string;
  enabled: number;
  concurrency: TaskConcurrency;
  timeout_ms: number | null;
}

/**
 * A code-defined task strategy queued for registration in the `task_strategy`
 * table, produced from a {@link TaskDefinition}.
 *
 * @example
 * ```ts
 * const seed: SeedDelegation = { id: "seed-heartbeat", type: "heartbeat", name: "Heartbeat" };
 * ```
 */
export interface SeedDelegation {
  /** Deterministic id so re-running the seed is idempotent. */
  id: string;
  type: string;
  name: string;
  args?: unknown;
  schedule?: string;
  timezone?: string | null;
  enabled?: boolean;
  timeoutMs?: number | null;
  concurrency?: TaskConcurrency;
}

/**
 * Signature of the callback the scheduler invokes when a cron job fires.
 *
 * @example
 * ```ts
 * const trigger: TriggerFn = async (id, kind) => {
 *   console.log(id, kind);
 * };
 * ```
 */
export type TriggerFn = (
  delegationId: string,
  trigger: "schedule" | "manual" | "retry",
) => Promise<void>;

/**
 * Configuration for a {@link Scheduler}.
 *
 * @example
 * ```ts
 * const opts: SchedulerOptions = { defaultTimezone: "Asia/Ho_Chi_Minh" };
 * ```
 */
export interface SchedulerOptions {
  defaultTimezone?: string;
}

/** Internal bookkeeping for one in-flight execution of a delegation. */
export interface RunningEntry {
  controller: AbortController;
  promise: Promise<void>;
}

/** Strategy-args resolver used when seeding delegations. */
export type StrategyArgsResolver = (type: string) => z.ZodType | undefined;
