import type { Executor } from "@pjh/process-engine";
import type { PjhDB, TaskInstanceStatus } from "@pjh/task";
import type { Kysely } from "kysely";

/**
 * Dependencies injected into the instances controller.
 *
 * @example
 * ```ts
 * const deps: InstancesDeps = { db, executor };
 * ```
 */
export interface InstancesDeps {
  db: Kysely<PjhDB>;
  executor: Executor;
}

/** Instance status filter accepted by `GET /api/instances`. */
export type InstanceStatus = TaskInstanceStatus;
