import type { TaskDefinition } from "./task.ts";

/**
 * In-memory collection of the task strategies known to the running core
 * process. Strategies are registered at boot from built-ins and configured
 * plugins, and mirrored into the `task_strategy` table.
 */
export class TaskRegistry {
  readonly #tasks = new Map<string, TaskDefinition>();

  register(...defs: TaskDefinition[]): this {
    for (const def of defs) {
      if (this.#tasks.has(def.type)) {
        throw new Error(`Task strategy "${def.type}" is already registered`);
      }
      this.#tasks.set(def.type, def);
    }
    return this;
  }

  get(type: string): TaskDefinition | undefined {
    return this.#tasks.get(type);
  }

  has(type: string): boolean {
    return this.#tasks.has(type);
  }

  list(): TaskDefinition[] {
    return [...this.#tasks.values()];
  }

  get size(): number {
    return this.#tasks.size;
  }
}
