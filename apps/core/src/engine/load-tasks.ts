import { resolve } from "node:path";
import type { SeedDelegation } from "@pjh/process-engine";
import { type TaskDefinition, TaskRegistry } from "@pjh/task";
import config from "../../pjh.config.ts";

/**
 * Normalizes a dynamically imported module into a list of task definitions.
 * Accepts either a default export or the module namespace, in array or single
 * form.
 *
 * @param mod - Imported module namespace.
 * @returns An array of task definitions.
 *
 * @example
 * ```ts
 * normalize({ default: heartbeatDef }); // => [heartbeatDef]
 * normalize([heartbeatDef, cleanupDef]); // => [heartbeatDef, cleanupDef]
 * ```
 */
function normalize(mod: unknown): TaskDefinition[] {
  const value = (mod as { default?: unknown }).default ?? mod;
  if (Array.isArray(value)) return value as TaskDefinition[];
  return [value as TaskDefinition];
}

/**
 * Loads built-in task strategies discovered under `src/tasks/**` plus any
 * modules listed in `pjh.config.ts`, and registers them in a fresh registry.
 *
 * @returns A registry containing every discovered strategy.
 *
 * @example
 * ```ts
 * const registry = await loadTasks();
 * registry.list().map((t) => t.type); // => ["heartbeat", "cleanup-instances"]
 * ```
 */
export async function loadTasks(): Promise<TaskRegistry> {
  const registry = new TaskRegistry();

  const builtinDir = resolve(import.meta.dir, "../tasks");
  const glob = new Bun.Glob("**/*.task.ts");

  const builtins: string[] = [];
  for await (const file of glob.scan(builtinDir)) {
    builtins.push(resolve(builtinDir, file));
  }

  const moduleSpecs = [...builtins, ...(config.tasks ?? [])];

  for (const spec of moduleSpecs) {
    const mod = await import(spec.startsWith(".") ? resolve(spec) : spec);
    registry.register(...normalize(mod));
  }

  return registry;
}

/**
 * Returns the seed delegations declared in `pjh.config.ts`.
 *
 * @returns Seed delegations inserted idempotently on boot.
 *
 * @example
 * ```ts
 * seedDelegations();
 * // => [{ id: "seed-heartbeat", type: "heartbeat", name: "Heartbeat", ... }]
 * ```
 */
export function seedDelegations(): SeedDelegation[] {
  return config.delegations ?? [];
}
