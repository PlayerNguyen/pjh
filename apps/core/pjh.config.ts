import type { SeedDelegation } from "@pjh/process-engine";

export interface PjhConfig {
  /** Extra task strategy modules to load at boot (local paths or packages). */
  tasks?: string[];
  /** Delegations seeded on boot. Only inserted when their id is absent. */
  delegations?: SeedDelegation[];
}

const config: PjhConfig = {
  tasks: [
    // "./src/tasks/heartbeat.task.ts",
    // "@acme/pjh-tasks/backup",
  ],
  delegations: [
    {
      id: "seed-heartbeat",
      type: "heartbeat",
      name: "Heartbeat",
      schedule: "* * * * *",
    },
    {
      id: "seed-cleanup-instances",
      type: "cleanup-instances",
      name: "Cleanup old instances",
      args: { retentionDays: 7 },
      schedule: "0 3 * * *",
    },
  ],
};

export default config;
