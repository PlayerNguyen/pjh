import type { DelegationService, Executor } from "@pjh/process-engine";
import type { PjhDB, TaskInstanceStatus } from "@pjh/task";
import type { Kysely } from "kysely";

/**
 * Dependencies injected into the tasks controller.
 *
 * @example
 * ```ts
 * const deps: TasksDeps = { db, executor, delegations };
 * ```
 */
export interface TasksDeps {
  db: Kysely<PjhDB>;
  executor: Executor;
  delegations: DelegationService;
}

/** Instance status filter accepted by `GET /api/instances`. */
export type InstanceStatus = TaskInstanceStatus;
