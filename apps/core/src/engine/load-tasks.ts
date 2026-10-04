import { resolve } from "node:path";
import { type TaskDefinition, TaskRegistry } from "@pjh/task";
import config from "../../pjh.config.ts";
import type { SeedDelegation } from "./loader.ts";

function normalize(mod: unknown): TaskDefinition[] {
  const value = (mod as { default?: unknown }).default ?? mod;
  if (Array.isArray(value)) return value as TaskDefinition[];
  return [value as TaskDefinition];
}

/**
 * Loads built-in task strategies discovered under `src/tasks/**` plus any
 * modules listed in `pjh.config.ts`, and registers them in a fresh registry.
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

export function seedDelegations(): SeedDelegation[] {
  return config.delegations ?? [];
}
