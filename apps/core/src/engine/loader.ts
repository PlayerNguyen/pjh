import type { PjhDB, TaskConcurrency, TaskDefinition } from "@pjh/task";
import { argsHash, argsToJsonSchema } from "@pjh/task";
import type { Kysely } from "kysely";
import type { z } from "zod";

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
 * Mirrors code-defined strategies into `task_strategy`. Descriptive fields and
 * the params schema are owned by code and refreshed on every boot.
 */
export async function syncStrategies(
  db: Kysely<PjhDB>,
  defs: TaskDefinition[],
): Promise<{ created: string[]; updated: string[] }> {
  const created: string[] = [];
  const updated: string[] = [];

  for (const def of defs) {
    const now = new Date().toISOString();
    const paramsSchema = JSON.stringify(argsToJsonSchema(def.args));

    const existing = await db
      .selectFrom("task_strategy")
      .select("type")
      .where("type", "=", def.type)
      .executeTakeFirst();

    if (existing) {
      await db
        .updateTable("task_strategy")
        .set({
          name: def.name,
          description: def.description ?? null,
          params_schema: paramsSchema,
          default_schedule: def.defaultSchedule ?? null,
          default_timezone: def.defaultTimezone ?? null,
          default_timeout_ms: def.defaultTimeoutMs ?? null,
          default_concurrency: def.defaultConcurrency ?? null,
          updated_at: now,
        })
        .where("type", "=", def.type)
        .execute();
      updated.push(def.type);
      continue;
    }

    await db
      .insertInto("task_strategy")
      .values({
        type: def.type,
        name: def.name,
        description: def.description ?? null,
        params_schema: paramsSchema,
        default_schedule: def.defaultSchedule ?? null,
        default_timezone: def.defaultTimezone ?? null,
        default_timeout_ms: def.defaultTimeoutMs ?? null,
        default_concurrency: def.defaultConcurrency ?? null,
        created_at: now,
        updated_at: now,
      })
      .execute();
    created.push(def.type);
  }

  return { created, updated };
}

export async function pruneStrategies(
  db: Kysely<PjhDB>,
  knownTypes: string[],
): Promise<number> {
  const query = db.deleteFrom("task_strategy");
  const res =
    knownTypes.length === 0
      ? await query.executeTakeFirst()
      : await query.where("type", "not in", knownTypes).executeTakeFirst();
  return Number(res.numDeletedRows ?? 0n);
}

/**
 * Migration-style seeding of delegations. Only inserts a delegation when its
 * deterministic id does not already exist, so user edits are never clobbered
 * and re-running the seed is a no-op.
 */
export async function seedDelegations(
  db: Kysely<PjhDB>,
  seeds: SeedDelegation[],
  resolveSchema?: (type: string) => z.ZodType | undefined,
): Promise<string[]> {
  const inserted: string[] = [];
  const now = new Date().toISOString();

  for (const seed of seeds) {
    const existing = await db
      .selectFrom("task_delegation")
      .select("id")
      .where("id", "=", seed.id)
      .executeTakeFirst();
    if (existing) continue;

    const strategy = await db
      .selectFrom("task_strategy")
      .select(["default_schedule", "default_timeout_ms", "default_concurrency"])
      .where("type", "=", seed.type)
      .executeTakeFirst();

    const schema = resolveSchema?.(seed.type);
    const parsed = schema?.safeParse(seed.args ?? {});
    const args = parsed?.success ? parsed.data : (seed.args ?? {});

    await db
      .insertInto("task_delegation")
      .values({
        id: seed.id,
        type: seed.type,
        name: seed.name,
        args: JSON.stringify(args),
        args_hash: argsHash(seed.type, args),
        schedule: seed.schedule ?? strategy?.default_schedule ?? "@daily",
        timezone: seed.timezone ?? null,
        enabled: (seed.enabled ?? true) ? 1 : 0,
        timeout_ms: seed.timeoutMs ?? strategy?.default_timeout_ms ?? null,
        concurrency: (seed.concurrency ??
          strategy?.default_concurrency ??
          "skip") as TaskConcurrency,
        last_run_at: null,
        next_run_at: null,
        created_at: now,
        updated_at: now,
      })
      .execute();
    inserted.push(seed.id);
  }

  return inserted;
}
