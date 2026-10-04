import type { TaskDefinition } from "./task.ts";

/**
 * In-memory collection of the task strategies known to the running core
 * process. Strategies are registered at boot from built-ins and configured
 * plugins, and mirrored into the `task_strategy` table.
 */
export class TaskRegistry {
  readonly #tasks = new Map<string, TaskDefinition>();

  /**
   * Register one or more strategies. Throws when a type is registered twice.
   *
   * @param defs - Strategy definitions to add.
   * @returns This registry, for chaining.
   *
   * @example
   * ```ts
   * const registry = new TaskRegistry().register(heartbeatDef, cleanupDef);
   * ```
   */
  register(...defs: TaskDefinition[]): this {
    for (const def of defs) {
      if (this.#tasks.has(def.type)) {
        throw new Error(`Task strategy "${def.type}" is already registered`);
      }
      this.#tasks.set(def.type, def);
    }
    return this;
  }

  /**
   * Look up a strategy by its type.
   *
   * @param type - Stable strategy type.
   * @returns The definition, or `undefined` when unknown.
   *
   * @example
   * ```ts
   * registry.get("heartbeat"); // => TaskDefinition | undefined
   * ```
   */
  get(type: string): TaskDefinition | undefined {
    return this.#tasks.get(type);
  }

  /**
   * Whether a strategy type is registered.
   *
   * @param type - Stable strategy type.
   * @returns `true` when registered.
   *
   * @example
   * ```ts
   * registry.has("heartbeat"); // => true
   * ```
   */
  has(type: string): boolean {
    return this.#tasks.has(type);
  }

  /**
   * Snapshot of every registered strategy.
   *
   * @returns An array of strategy definitions.
   *
   * @example
   * ```ts
   * registry.list().map((t) => t.type); // => ["heartbeat", "cleanup-instances"]
   * ```
   */
  list(): TaskDefinition[] {
    return [...this.#tasks.values()];
  }

  /**
   * Number of registered strategies.
   *
   * @example
   * ```ts
   * registry.size; // => 2
   * ```
   */
  get size(): number {
    return this.#tasks.size;
  }
}
