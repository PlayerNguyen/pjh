import {
  DelegationService,
  Executor,
  loadEnabledDelegations,
  pruneStrategies,
  Scheduler,
  seedDelegations as seed,
  syncStrategies,
} from "@pjh/process-engine";
import type { PjhDB, TaskDefinition } from "@pjh/task";
import type { Kysely } from "kysely";
import { createApi } from "./api/routes.ts";
import { config } from "./config.ts";
import { getDb, initDb } from "./db/client.ts";
import { migrate } from "./db/migrations.ts";
import { loadTasks, seedDelegations } from "./engine/load-tasks.ts";

export interface AppContext {
  db: Kysely<PjhDB>;
  executor: Executor;
  scheduler: Scheduler;
  delegations: DelegationService;
  stop: () => Promise<void>;
}

/**
 * Builds the full core application: database, strategy registry, delegation
 * service, executor and scheduler, and the REST API. Reused by the server
 * entry and tests.
 */
export async function createApp(options?: {
  db?: Kysely<PjhDB>;
  register?: boolean;
}): Promise<{
  context: AppContext;
  fetch: (req: Request) => Response | Promise<Response>;
}> {
  const db = options?.db ?? (await initDb(config.databaseUrl));
  await migrate(db);

  const registry = await loadTasks();
  const register = options?.register ?? true;

  if (register) {
    await syncStrategies(db, registry.list());
    await pruneStrategies(
      db,
      registry.list().map((t) => t.type),
    );
    await seed(db, seedDelegations(), (type) => registry.get(type)?.args);
  }

  const getStrategy = (type: string): TaskDefinition | undefined => registry.get(type);

  const executor = new Executor({
    db,
    getStrategy,
    onSettled: async () => {},
  });

  const scheduler = new Scheduler(
    db,
    async (delegationId, trigger) => {
      await executor.trigger(delegationId, { trigger });
    },
    { defaultTimezone: config.timezone },
  );

  const delegations = new DelegationService(db, getStrategy, scheduler);

  if (register) {
    const enabled = await loadEnabledDelegations(db);
    for (const delegation of enabled) {
      try {
        await scheduler.schedule(delegation);
      } catch (error) {
        console.error(`[scheduler] cannot schedule "${delegation.id}":`, error);
      }
    }
  }

  const app = createApi({ db, executor, delegations });

  return {
    context: {
      db,
      executor,
      scheduler,
      delegations,
      stop: async () => {
        scheduler.stopAll();
      },
    },
    fetch: (req) => app.fetch(req),
  };
}

async function main(): Promise<void> {
  const { context, fetch } = await createApp();
  const server = Bun.serve({
    hostname: config.host,
    port: config.port,
    fetch,
  });

  console.log(`pjh core listening on http://${config.host}:${config.port}`);
  console.log(`database: ${config.databaseUrl}`);

  const shutdown = async () => {
    console.log("\nshutting down...");
    await context.stop();
    server.stop(true);
    await getDb().destroy();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("fatal:", error);
    process.exit(1);
  });
}
