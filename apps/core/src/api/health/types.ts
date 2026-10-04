import type { PjhDB } from "@pjh/task";
import type { Kysely } from "kysely";

/**
 * Dependencies injected into the health controller.
 *
 * @example
 * ```ts
 * const deps: HealthDeps = { db };
 * ```
 */
export interface HealthDeps {
  db: Kysely<PjhDB>;
}
