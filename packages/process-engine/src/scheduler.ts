import type { PjhDB } from "@pjh/task";
import type { Kysely } from "kysely";
import type { DelegationInput, SchedulerOptions, TriggerFn } from "./types.ts";

type CronJob = Bun.CronJob;

/**
 * Owns one in-process cron job per enabled delegation using Bun's native
 * scheduler.
 *
 * `Bun.cron` already guarantees runs never overlap for a given schedule; the
 * executor adds a second guard so manual triggers respect the same policy.
 *
 * @example
 * ```ts
 * const scheduler = new Scheduler(db, async (id, trigger) => {
 *   await executor.trigger(id, { trigger });
 * }, { defaultTimezone: "UTC" });
 *
 * await scheduler.schedule({
 *   id: "seed-heartbeat",
 *   schedule: "* * * * *",
 *   timezone: null,
 *   enabled: true,
 * });
 * ```
 */
export class Scheduler {
  readonly #db: Kysely<PjhDB>;
  readonly #trigger: TriggerFn;
  readonly #defaultTimezone: string | undefined;
  readonly #jobs = new Map<string, CronJob>();
  readonly #schedules = new Map<string, string>();

  /**
   * @param db - Query builder over the shared SQLite database.
   * @param trigger - Callback invoked when a cron job fires.
   * @param opts - Optional scheduler configuration.
   */
  constructor(db: Kysely<PjhDB>, trigger: TriggerFn, opts: SchedulerOptions = {}) {
    this.#db = db;
    this.#trigger = trigger;
    this.#defaultTimezone = opts.defaultTimezone;
  }

  /**
   * Validate a cron expression and return the next fire time.
   *
   * @throws If the expression is invalid or has no future run.
   * @example
   * ```ts
   * const at = scheduler.nextRun("0 3 * * *", "UTC");
   * // => Date for the next 03:00 UTC
   * ```
   */
  nextRun(schedule: string, timezone?: string): Date | null {
    const tz = timezone ?? this.#defaultTimezone;
    const next = Bun.cron.parse(schedule, Date.now(), tz ? { tz } : undefined);
    if (!next) {
      throw new Error(`Cron expression "${schedule}" has no future runs`);
    }
    return next;
  }

  /**
   * Validate a cron expression without keeping the parsed result.
   *
   * @throws If the expression is invalid.
   * @example
   * ```ts
   * scheduler.validate("* * * * *"); // ok
   * scheduler.validate("nope");      // throws
   * ```
   */
  validate(schedule: string, timezone?: string): void {
    this.nextRun(schedule, timezone);
  }

  /**
   * Register (or re-register) a job from the current delegation row. Passing a
   * disabled delegation stops and forgets any existing job.
   *
   * @example
   * ```ts
   * await scheduler.schedule({ id, schedule: "@daily", timezone: null, enabled: true });
   * ```
   */
  async schedule(delegation: DelegationInput): Promise<void> {
    this.#jobFor(delegation.id)?.stop();

    if (!delegation.enabled) {
      this.#jobs.delete(delegation.id);
      this.#schedules.delete(delegation.id);
      await this.#writeNext(delegation.id, null);
      return;
    }

    const tz = delegation.timezone ?? this.#defaultTimezone;
    const options: { tz: string } | undefined = tz ? { tz } : undefined;

    const newJob = Bun.cron(
      delegation.schedule,
      async () => {
        await this.#trigger(delegation.id, "schedule");
        await this.#writeNext(
          delegation.id,
          this.#safeNext(delegation.schedule, tz ?? undefined),
        );
      },
      options,
    );

    this.#jobs.set(delegation.id, newJob);
    this.#schedules.set(delegation.id, delegation.schedule);
    await this.#writeNext(
      delegation.id,
      this.nextRun(delegation.schedule, tz ?? undefined),
    );
  }

  /**
   * Stop and forget the cron job for a delegation.
   *
   * @example
   * ```ts
   * scheduler.unschedule("seed-heartbeat");
   * ```
   */
  unschedule(delegationId: string): void {
    this.#jobFor(delegationId)?.stop();
    this.#jobs.delete(delegationId);
    this.#schedules.delete(delegationId);
  }

  /**
   * Next scheduled fire time for a tracked delegation, if any.
   *
   * @example
   * ```ts
   * const at = scheduler.nextFire("seed-heartbeat"); // Date | null
   * ```
   */
  nextFire(delegationId: string): Date | null {
    const schedule = this.#schedules.get(delegationId);
    if (!schedule) return null;
    return this.#safeNext(schedule, undefined);
  }

  /**
   * Stop every tracked job. Called during graceful shutdown.
   *
   * @example
   * ```ts
   * scheduler.stopAll();
   * ```
   */
  stopAll(): void {
    for (const job of this.#jobs.values()) job.stop();
    this.#jobs.clear();
    this.#schedules.clear();
  }

  /** Look up the tracked cron job for a delegation. */
  #jobFor(delegationId: string): CronJob | undefined {
    return this.#jobs.get(delegationId);
  }

  /** Parse the next run time, returning null instead of throwing on failure. */
  #safeNext(schedule: string, timezone?: string): Date | null {
    try {
      return this.nextRun(schedule, timezone ?? undefined);
    } catch {
      return null;
    }
  }

  /** Persist the computed next fire time onto the delegation row. */
  async #writeNext(delegationId: string, next: Date | null): Promise<void> {
    await this.#db
      .updateTable("task_delegation")
      .set({ next_run_at: next ? next.toISOString() : null })
      .where("id", "=", delegationId)
      .execute();
  }
}

/**
 * Load every enabled delegation as a scheduler input.
 *
 * @example
 * ```ts
 * const enabled = await loadEnabledDelegations(db);
 * // => [{ id: "seed-heartbeat", schedule: "* * * * *", timezone: null, enabled: true }]
 * ```
 */
export async function loadEnabledDelegations(
  db: Kysely<PjhDB>,
): Promise<DelegationInput[]> {
  const rows = await db
    .selectFrom("task_delegation")
    .select(["id", "schedule", "timezone", "enabled"])
    .where("enabled", "=", 1)
    .execute();

  return rows.map((r) => ({
    id: r.id,
    schedule: r.schedule,
    timezone: r.timezone,
    enabled: r.enabled === 1,
  }));
}
