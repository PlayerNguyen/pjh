import type {
  PjhDB,
  TaskConcurrency,
  TaskDefinition,
  TaskInstanceStatus,
  TaskInstanceTrigger,
} from "@pjh/task";
import type { Kysely } from "kysely";

export interface ExecutorDeps {
  db: Kysely<PjhDB>;
  getTask: (id: string) => TaskDefinition | undefined;
  /** Called after an instance settles so the scheduler can refresh next_run_at. */
  onSettled?: (taskId: string) => Promise<void> | void;
}

export interface TriggerOptions {
  trigger: TaskInstanceTrigger;
  payload?: unknown;
}

export interface TriggerResult {
  started: boolean;
  instanceId?: string;
  reason?: "disabled" | "unknown-task" | "skipped-running" | "queued";
}

interface RunningEntry {
  controller: AbortController;
  promise: Promise<void>;
}

function serializeResult(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Runs task handlers and records the lifecycle of every attempt as a
 * `task_instance` row.
 */
export class Executor {
  readonly #db: Kysely<PjhDB>;
  readonly #getTask: ExecutorDeps["getTask"];
  readonly #onSettled: ExecutorDeps["onSettled"] | undefined;
  readonly #running = new Map<string, RunningEntry>();
  readonly #queue = new Map<string, TriggerOptions[]>();
  readonly #instances = new Map<string, AbortController>();

  constructor(deps: ExecutorDeps) {
    this.#db = deps.db;
    this.#getTask = deps.getTask;
    this.#onSettled = deps.onSettled;
  }

  isRunning(taskId: string): boolean {
    return this.#running.has(taskId);
  }

  async trigger(taskId: string, opts: TriggerOptions): Promise<TriggerResult> {
    const def = this.#getTask(taskId);
    if (!def) return { started: false, reason: "unknown-task" };

    const row = await this.#db
      .selectFrom("task")
      .select(["enabled", "concurrency"])
      .where("id", "=", taskId)
      .executeTakeFirst();

    if (!row) return { started: false, reason: "unknown-task" };
    if (row.enabled !== 1 && opts.trigger !== "manual") {
      return { started: false, reason: "disabled" };
    }

    const policy: TaskConcurrency = row.concurrency ?? "skip";
    const running = this.#running.has(taskId);

    if (running) {
      if (policy === "skip") return { started: false, reason: "skipped-running" };
      if (policy === "queue") {
        const queued = this.#queue.get(taskId) ?? [];
        queued.push(opts);
        this.#queue.set(taskId, queued);
        return { started: false, reason: "queued" };
      }
      // "parallel" falls through and starts immediately.
    }

    const instanceId = crypto.randomUUID();
    await this.#start(def, instanceId, opts);
    return { started: true, instanceId };
  }

  cancel(instanceId: string): boolean {
    const controller = this.#instances.get(instanceId);
    if (!controller) return false;
    controller.abort(new Error("Task cancelled"));
    return true;
  }

  async #start(
    def: TaskDefinition,
    instanceId: string,
    opts: TriggerOptions,
  ): Promise<void> {
    const startedAt = new Date();
    const controller = new AbortController();
    this.#instances.set(instanceId, controller);

    await this.#db
      .insertInto("task_instance")
      .values({
        id: instanceId,
        task_id: def.id,
        status: "running",
        trigger: opts.trigger,
        queued_at: startedAt.toISOString(),
        started_at: startedAt.toISOString(),
        finished_at: null,
        duration_ms: null,
        result: null,
        error: null,
      })
      .execute();

    await this.#db
      .updateTable("task")
      .set({ last_run_at: startedAt.toISOString() })
      .where("id", "=", def.id)
      .execute();

    const timeoutMs = def.timeoutMs ?? 0;
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort(new Error(`Task timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }

    const promise = this.#run(def, instanceId, controller, opts)
      .then(async (result) => {
        if (timer) clearTimeout(timer);
        const finishedAt = new Date();
        const status: TaskInstanceStatus = timedOut ? "timeout" : "succeeded";
        await this.#settle(
          instanceId,
          status,
          finishedAt,
          startedAt,
          serializeResult(result),
          null,
        );
      })
      .catch(async (error: unknown) => {
        if (timer) clearTimeout(timer);
        const finishedAt = new Date();
        const aborted = controller.signal.aborted;
        const status: TaskInstanceStatus = timedOut
          ? "timeout"
          : aborted
            ? "cancelled"
            : "failed";
        await this.#settle(
          instanceId,
          status,
          finishedAt,
          startedAt,
          null,
          error instanceof Error ? error.message : String(error),
        );
      })
      .finally(async () => {
        this.#instances.delete(instanceId);
        this.#running.delete(def.id);
        await this.#onSettled?.(def.id);
        await this.#drain(def);
      });

    this.#running.set(def.id, { controller, promise });
  }

  async #run(
    def: TaskDefinition,
    instanceId: string,
    controller: AbortController,
    opts: TriggerOptions,
  ): Promise<unknown> {
    const log = (
      level: "debug" | "info" | "warn" | "error",
      message: string,
      data?: unknown,
    ) => {
      void this.#db
        .insertInto("task_instance_log")
        .values({
          id: undefined as unknown as number,
          instance_id: instanceId,
          ts: new Date().toISOString(),
          level,
          message,
          data: data === undefined ? null : serializeResult(data),
        })
        .execute()
        .catch(() => {});
    };

    const handler = Promise.resolve(
      def.handle({
        instanceId,
        taskId: def.id,
        trigger: opts.trigger,
        db: this.#db,
        log,
        signal: controller.signal,
        payload: opts.payload,
      }),
    );

    if (!controller.signal.aborted) {
      const aborted = new Promise<never>((_, reject) => {
        controller.signal.addEventListener(
          "abort",
          () => {
            reject(
              controller.signal.reason instanceof Error
                ? controller.signal.reason
                : new Error("Task aborted"),
            );
          },
          { once: true },
        );
      });
      return await Promise.race([handler, aborted]);
    }

    return await handler;
  }

  async #settle(
    instanceId: string,
    status: TaskInstanceStatus,
    finishedAt: Date,
    startedAt: Date,
    result: string | null,
    error: string | null,
  ): Promise<void> {
    await this.#db
      .updateTable("task_instance")
      .set({
        status,
        finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - startedAt.getTime(),
        result,
        error,
      })
      .where("id", "=", instanceId)
      .execute();
  }

  async #drain(def: TaskDefinition): Promise<void> {
    const queued = this.#queue.get(def.id);
    if (!queued || queued.length === 0) return;
    const next = queued.shift();
    if (queued.length === 0) this.#queue.delete(def.id);
    if (next) {
      const instanceId = crypto.randomUUID();
      await this.#start(def, instanceId, next);
    }
  }
}
