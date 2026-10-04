import type { PjhDB } from "@pjh/task";
import type { Kysely } from "kysely";

type CronJob = Bun.CronJob;

export type TriggerFn = (
  delegationId: string,
  trigger: "schedule" | "manual" | "retry",
) => Promise<void>;

export interface SchedulerOptions {
  defaultTimezone?: string;
}

/**
 * Owns one in-process cron job per enabled delegation using Bun's native
 * scheduler.
 *
 * `Bun.cron` already guarantees runs never overlap for a given schedule; the
 * executor adds a second guard so manual triggers respect the same policy.
 */
export class Scheduler {
  readonly #db: Kysely<PjhDB>;
  readonly #trigger: TriggerFn;
  readonly #defaultTimezone: string | undefined;
  readonly #jobs = new Map<string, CronJob>();
  readonly #schedules = new Map<string, string>();

  constructor(db: Kysely<PjhDB>, trigger: TriggerFn, opts: SchedulerOptions = {}) {
    this.#db = db;
    this.#trigger = trigger;
    this.#defaultTimezone = opts.defaultTimezone;
  }

  /**
   * Validate a cron expression and return the next fire time.
   * Throws if the expression is invalid.
   */
  nextRun(schedule: string, timezone?: string): Date | null {
    const tz = timezone ?? this.#defaultTimezone;
    const next = Bun.cron.parse(schedule, Date.now(), tz ? { tz } : undefined);
    if (!next) {
      throw new Error(`Cron expression "${schedule}" has no future runs`);
    }
    return next;
  }

  validate(schedule: string, timezone?: string): void {
    this.nextRun(schedule, timezone);
  }

  /** Register (or re-register) a job from the current delegation row. */
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

  unschedule(delegationId: string): void {
    this.#jobFor(delegationId)?.stop();
    this.#jobs.delete(delegationId);
    this.#schedules.delete(delegationId);
  }

  nextFire(delegationId: string): Date | null {
    const schedule = this.#schedules.get(delegationId);
    if (!schedule) return null;
    return this.#safeNext(schedule, undefined);
  }

  stopAll(): void {
    for (const job of this.#jobs.values()) job.stop();
    this.#jobs.clear();
    this.#schedules.clear();
  }

  #jobFor(delegationId: string): CronJob | undefined {
    return this.#jobs.get(delegationId);
  }

  #safeNext(schedule: string, timezone?: string): Date | null {
    try {
      return this.nextRun(schedule, timezone ?? undefined);
    } catch {
      return null;
    }
  }

  async #writeNext(delegationId: string, next: Date | null): Promise<void> {
    await this.#db
      .updateTable("task_delegation")
      .set({ next_run_at: next ? next.toISOString() : null })
      .where("id", "=", delegationId)
      .execute();
  }
}

export interface DelegationInput {
  id: string;
  schedule: string;
  timezone: string | null;
  enabled: boolean;
}

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
