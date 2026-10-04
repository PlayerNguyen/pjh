import type { TaskDefinition } from "@pjh/task";

/**
 * Task plugin configuration for the core app.
 *
 * Built-in tasks discovered under `src/tasks/**` are always loaded. Add
 * additional task packages here as module specifiers — either local paths or
 * installed packages that default-export a `TaskDefinition` (or an array).
 */
export interface PjhConfig {
  /** Extra task modules to load at boot. */
  tasks?: string[];
  /** Default enabled state for newly discovered tasks. */
  defaultEnabled?: boolean;
}

const config: PjhConfig = {
  tasks: [
    // "./src/tasks/heartbeat.task.ts",
    // "@acme/pjh-tasks/backup",
  ],
  defaultEnabled: true,
};

export default config;

export type TaskModule = TaskDefinition | TaskDefinition[];
