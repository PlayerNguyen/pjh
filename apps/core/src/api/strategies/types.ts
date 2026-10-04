import type { PjhDB } from "@pjh/task";
import type { Kysely } from "kysely";

/**
 * Dependencies injected into the strategies controller.
 *
 * @example
 * ```ts
 * const deps: StrategiesDeps = { db };
 * ```
 */
export interface StrategiesDeps {
  db: Kysely<PjhDB>;
}
