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
  /** Resolve a strategy by its type from the code registry. */
  getStrategy: (type: string) => TaskDefinition | undefined;
  /** Called after an instance settles so the scheduler can refresh next_run_at. */
  onSettled?: (delegationId: string) => Promise<void> | void;
}

export interface TriggerOptions {
  trigger: TaskInstanceTrigger;
  payload?: unknown;
}

export interface TriggerResult {
  started: boolean;
  instanceId?: string;
  reason?:
    | "disabled"
    | "unknown-delegation"
    | "unknown-strategy"
    | "skipped-running"
    | "queued";
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
 * `task_instance` row. A delegation resolves to a code-defined strategy by
 * `type`, and its stored `args` are passed to the handler.
 */
export class Executor {
  readonly #db: Kysely<PjhDB>;
  readonly #getStrategy: ExecutorDeps["getStrategy"];
  readonly #onSettled: ExecutorDeps["onSettled"] | undefined;
  readonly #running = new Map<string, RunningEntry>();
  readonly #queue = new Map<string, TriggerOptions[]>();
  readonly #instances = new Map<string, AbortController>();

  constructor(deps: ExecutorDeps) {
    this.#db = deps.db;
    this.#getStrategy = deps.getStrategy;
    this.#onSettled = deps.onSettled;
  }

  isRunning(delegationId: string): boolean {
    return this.#running.has(delegationId);
  }

  async trigger(delegationId: string, opts: TriggerOptions): Promise<TriggerResult> {
    const delegation = await this.#db
      .selectFrom("task_delegation")
      .select(["id", "type", "name", "args", "enabled", "concurrency", "timeout_ms"])
      .where("id", "=", delegationId)
      .executeTakeFirst();

    if (!delegation) return { started: false, reason: "unknown-delegation" };
    if (!this.#getStrategy(delegation.type)) {
      return { started: false, reason: "unknown-strategy" };
    }
    if (delegation.enabled !== 1 && opts.trigger !== "manual") {
      return { started: false, reason: "disabled" };
    }

    const policy: TaskConcurrency = delegation.concurrency ?? "skip";
    const running = this.#running.has(delegationId);

    if (running) {
      if (policy === "skip") return { started: false, reason: "skipped-running" };
      if (policy === "queue") {
        const queued = this.#queue.get(delegationId) ?? [];
        queued.push(opts);
        this.#queue.set(delegationId, queued);
        return { started: false, reason: "queued" };
      }
      // "parallel" falls through and starts immediately.
    }

    const instanceId = crypto.randomUUID();
    await this.#start(delegation, instanceId, opts);
    return { started: true, instanceId };
  }

  cancel(instanceId: string): boolean {
    const controller = this.#instances.get(instanceId);
    if (!controller) return false;
    controller.abort(new Error("Task cancelled"));
    return true;
  }

  async #start(
    delegation: DelegationRow,
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
        delegation_id: delegation.id,
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
      .updateTable("task_delegation")
      .set({ last_run_at: startedAt.toISOString() })
      .where("id", "=", delegation.id)
      .execute();

    const timeoutMs = delegation.timeout_ms ?? 0;
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort(new Error(`Task timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }

    const promise = this.#run(delegation, instanceId, controller, opts)
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
        this.#running.delete(delegation.id);
        await this.#onSettled?.(delegation.id);
        await this.#drain(delegation);
      });

    this.#running.set(delegation.id, { controller, promise });
  }

  async #run(
    delegation: DelegationRow,
    instanceId: string,
    controller: AbortController,
    opts: TriggerOptions,
  ): Promise<unknown> {
    const strategy = this.#getStrategy(delegation.type);
    if (!strategy) throw new Error(`Unknown task strategy "${delegation.type}"`);

    const parsed = strategy.args.safeParse(parseArgs(delegation.args));
    if (!parsed.success) {
      throw new Error(
        `Invalid delegation args for "${delegation.type}": ${parsed.error.issues
          .map((i: { message: string }) => i.message)
          .join(", ")}`,
      );
    }

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
      strategy.handle({
        instanceId,
        delegationId: delegation.id,
        type: delegation.type,
        taskName: delegation.name,
        trigger: opts.trigger,
        args: parsed.data,
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

  async #drain(delegation: DelegationRow): Promise<void> {
    const queued = this.#queue.get(delegation.id);
    if (!queued || queued.length === 0) return;
    const next = queued.shift();
    if (queued.length === 0) this.#queue.delete(delegation.id);
    if (next) {
      const instanceId = crypto.randomUUID();
      await this.#start(delegation, instanceId, next);
    }
  }
}

interface DelegationRow {
  id: string;
  type: string;
  name: string;
  args: string;
  enabled: number;
  concurrency: TaskConcurrency;
  timeout_ms: number | null;
}

function parseArgs(args: string): unknown {
  try {
    return JSON.parse(args);
  } catch {
    return {};
  }
}
