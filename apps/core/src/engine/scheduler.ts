import type { PjhDB, TaskDefinition } from "@pjh/task";
import { type Kysely, sql } from "kysely";

type CronJob = Bun.CronJob;

export type TriggerFn = (
  taskId: string,
  trigger: "schedule" | "manual" | "retry",
) => Promise<void>;

export interface SchedulerOptions {
  defaultTimezone?: string;
}

/**
 * Owns one in-process cron job per enabled task using Bun's native scheduler.
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

  /** Register (or re-register) a job from the current DB row. */
  async schedule(task: TaskDefinition | TaskRowInput): Promise<void> {
    const job = this.#jobFor(task.id);
    job?.stop();

    if (!task.enabled) {
      this.#jobs.delete(task.id);
      this.#schedules.delete(task.id);
      await this.#writeNext(task.id, null);
      return;
    }

    const tz = task.timezone ?? this.#defaultTimezone;
    const options: { tz: string } | undefined = tz ? { tz } : undefined;

    const newJob = Bun.cron(
      task.schedule,
      async () => {
        await this.#trigger(task.id, "schedule");
        await this.#writeNext(task.id, this.#safeNext(task.schedule, tz ?? undefined));
      },
      options,
    );

    this.#jobs.set(task.id, newJob);
    this.#schedules.set(task.id, task.schedule);
    await this.#writeNext(task.id, this.nextRun(task.schedule, tz ?? undefined));
  }

  unschedule(taskId: string): void {
    this.#jobFor(taskId)?.stop();
    this.#jobs.delete(taskId);
    this.#schedules.delete(taskId);
  }

  nextFire(taskId: string): Date | null {
    const schedule = this.#schedules.get(taskId);
    if (!schedule) return null;
    return this.#safeNext(schedule, undefined);
  }

  stopAll(): void {
    for (const job of this.#jobs.values()) job.stop();
    this.#jobs.clear();
    this.#schedules.clear();
  }

  #jobFor(taskId: string): CronJob | undefined {
    return this.#jobs.get(taskId);
  }

  #safeNext(schedule: string, timezone?: string): Date | null {
    try {
      return this.nextRun(schedule, timezone ?? undefined);
    } catch {
      return null;
    }
  }

  async #writeNext(taskId: string, next: Date | null): Promise<void> {
    await this.#db
      .updateTable("task")
      .set({ next_run_at: next ? next.toISOString() : null })
      .where("id", "=", taskId)
      .execute();
  }
}

export interface TaskRowInput {
  id: string;
  schedule: string;
  timezone: string | null;
  enabled: boolean;
}

export async function loadEnabledTasks(db: Kysely<PjhDB>): Promise<TaskRowInput[]> {
  const rows = await db
    .selectFrom("task")
    .select(["id", "schedule", "timezone", "enabled"])
    .where(sql<boolean>`enabled = 1`)
    .execute();

  return rows.map((r) => ({
    id: r.id,
    schedule: r.schedule,
    timezone: r.timezone,
    enabled: r.enabled === 1,
  }));
}
