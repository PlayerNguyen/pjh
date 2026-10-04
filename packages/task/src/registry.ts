import type { TaskDefinition } from "./task.ts";

/**
 * In-memory collection of the task definitions known to the running core
 * process. Tasks are registered at boot from built-ins and configured plugins.
 */
export class TaskRegistry {
  readonly #tasks = new Map<string, TaskDefinition>();

  register(...defs: TaskDefinition[]): this {
    for (const def of defs) {
      if (this.#tasks.has(def.id)) {
        throw new Error(`Task "${def.id}" is already registered`);
      }
      this.#tasks.set(def.id, def);
    }
    return this;
  }

  get(id: string): TaskDefinition | undefined {
    return this.#tasks.get(id);
  }

  has(id: string): boolean {
    return this.#tasks.has(id);
  }

  list(): TaskDefinition[] {
    return [...this.#tasks.values()];
  }

  get size(): number {
    return this.#tasks.size;
  }
}
