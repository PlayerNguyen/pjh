import {
  argsHash,
  type PjhDB,
  type TaskConcurrency,
  type TaskDefinition,
} from "@pjh/task";
import type { Kysely } from "kysely";
import type { Scheduler } from "./scheduler.ts";

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

export interface UpdateDelegationInput {
  name?: string;
  args?: unknown;
  schedule?: string;
  timezone?: string | null;
  enabled?: boolean;
  timeoutMs?: number | null;
  concurrency?: TaskConcurrency;
}

export type ServiceError =
  | { code: "unknown-strategy"; message: string }
  | { code: "invalid-args"; message: string; issues: unknown }
  | { code: "invalid-schedule"; message: string }
  | { code: "duplicate-args"; message: string; existingId: string }
  | { code: "not-found"; message: string };

export class DelegationService {
  readonly #db: Kysely<PjhDB>;
  readonly #getStrategy: (type: string) => TaskDefinition | undefined;
  readonly #scheduler: Scheduler;

  constructor(
    db: Kysely<PjhDB>,
    getStrategy: (type: string) => TaskDefinition | undefined,
    scheduler: Scheduler,
  ) {
    this.#db = db;
    this.#getStrategy = getStrategy;
    this.#scheduler = scheduler;
  }

  /** Returns the id of another delegation of the same type+args, if any. */
  async findDuplicate(
    type: string,
    args: unknown,
    excludeId?: string,
  ): Promise<string | undefined> {
    const hash = argsHash(type, args);
    let query = this.#db
      .selectFrom("task_delegation")
      .select("id")
      .where("type", "=", type)
      .where("args_hash", "=", hash);
    if (excludeId) query = query.where("id", "!=", excludeId);
    const row = await query.executeTakeFirst();
    return row?.id;
  }

  async create(
    input: CreateDelegationInput,
  ): Promise<{ ok: true; id: string } | { ok: false; error: ServiceError }> {
    const strategy = this.#getStrategy(input.type);
    if (!strategy) {
      return {
        ok: false,
        error: {
          code: "unknown-strategy",
          message: `Unknown task type "${input.type}"`,
        },
      };
    }

    const parsed = strategy.args.safeParse(input.args ?? {});
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: "invalid-args",
          message: "Arguments do not match the task schema",
          issues: parsed.error.issues,
        },
      };
    }
    const args = parsed.data;

    const duplicate = await this.findDuplicate(input.type, args);
    if (duplicate) {
      return {
        ok: false,
        error: {
          code: "duplicate-args",
          message: "A delegation with the same type and arguments already exists",
          existingId: duplicate,
        },
      };
    }

    const schedule = input.schedule ?? strategy.defaultSchedule ?? "@daily";
    const timezone =
      input.timezone === undefined
        ? (strategy.defaultTimezone ?? null)
        : input.timezone;

    try {
      this.#scheduler.validate(schedule, timezone ?? undefined);
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "invalid-schedule",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.#db
      .insertInto("task_delegation")
      .values({
        id,
        type: input.type,
        name: input.name,
        args: JSON.stringify(args),
        args_hash: argsHash(input.type, args),
        schedule,
        timezone,
        enabled: (input.enabled ?? true) ? 1 : 0,
        timeout_ms:
          input.timeoutMs === undefined
            ? (strategy.defaultTimeoutMs ?? null)
            : input.timeoutMs,
        concurrency: (input.concurrency ??
          strategy.defaultConcurrency ??
          "skip") as TaskConcurrency,
        last_run_at: null,
        next_run_at: null,
        created_at: now,
        updated_at: now,
      })
      .execute();

    await this.#reschedule(id);
    return { ok: true, id };
  }

  async update(
    id: string,
    input: UpdateDelegationInput,
  ): Promise<{ ok: true } | { ok: false; error: ServiceError }> {
    const existing = await this.#db
      .selectFrom("task_delegation")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    if (!existing) {
      return {
        ok: false,
        error: { code: "not-found", message: "Delegation not found" },
      };
    }

    const strategy = this.#getStrategy(existing.type);
    if (!strategy) {
      return {
        ok: false,
        error: {
          code: "unknown-strategy",
          message: `Unknown task type "${existing.type}"`,
        },
      };
    }

    let args = JSON.parse(existing.args) as unknown;
    if (input.args !== undefined) {
      const parsed = strategy.args.safeParse(input.args);
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: "invalid-args",
            message: "Arguments do not match the task schema",
            issues: parsed.error.issues,
          },
        };
      }
      args = parsed.data;
      const duplicate = await this.findDuplicate(existing.type, args, id);
      if (duplicate) {
        return {
          ok: false,
          error: {
            code: "duplicate-args",
            message: "A delegation with the same type and arguments already exists",
            existingId: duplicate,
          },
        };
      }
    }

    const schedule = input.schedule ?? existing.schedule;
    const timezone = input.timezone === undefined ? existing.timezone : input.timezone;

    if (input.schedule !== undefined || input.timezone !== undefined) {
      try {
        this.#scheduler.validate(schedule, timezone ?? undefined);
      } catch (error) {
        return {
          ok: false,
          error: {
            code: "invalid-schedule",
            message: error instanceof Error ? error.message : String(error),
          },
        };
      }
    }

    await this.#db
      .updateTable("task_delegation")
      .set({
        name: input.name ?? existing.name,
        args: JSON.stringify(args),
        args_hash: argsHash(existing.type, args),
        schedule,
        timezone,
        enabled: input.enabled === undefined ? existing.enabled : input.enabled ? 1 : 0,
        timeout_ms:
          input.timeoutMs === undefined ? existing.timeout_ms : input.timeoutMs,
        concurrency: input.concurrency ?? existing.concurrency,
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", id)
      .execute();

    await this.#reschedule(id);
    return { ok: true };
  }

  async remove(id: string): Promise<boolean> {
    const res = await this.#db
      .deleteFrom("task_delegation")
      .where("id", "=", id)
      .executeTakeFirst();
    this.#scheduler.unschedule(id);
    return Number(res.numDeletedRows ?? 0n) > 0;
  }

  async #reschedule(id: string): Promise<void> {
    const row = await this.#db
      .selectFrom("task_delegation")
      .select(["id", "schedule", "timezone", "enabled"])
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) return;
    await this.#scheduler.schedule({
      id: row.id,
      schedule: row.schedule,
      timezone: row.timezone,
      enabled: row.enabled === 1,
    });
  }
}
