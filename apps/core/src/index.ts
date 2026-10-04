import type { PjhDB } from "@pjh/task";
import type { Kysely } from "kysely";
import { createApi } from "./api/routes.ts";
import { config } from "./config.ts";
import { getDb, initDb } from "./db/client.ts";
import { migrate } from "./db/migrations.ts";
import { Executor } from "./engine/executor.ts";
import { defaultEnabled, loadTasks } from "./engine/load-tasks.ts";
import { pruneOrphans, syncTasks } from "./engine/loader.ts";
import { loadEnabledTasks, Scheduler } from "./engine/scheduler.ts";

export interface AppContext {
  db: Kysely<PjhDB>;
  executor: Executor;
  scheduler: Scheduler;
  stop: () => Promise<void>;
}

/**
 * Builds the full core application: database, task registry, executor and
 * scheduler, and the REST API. Reused by both the server entry and tests.
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
    await syncTasks(db, registry.list(), defaultEnabled());
    await pruneOrphans(
      db,
      registry.list().map((t) => t.id),
    );
  }

  const executor: Executor = new Executor({
    db,
    getTask: (id) => registry.get(id),
    onSettled: async () => {},
  });

  const scheduler = new Scheduler(
    db,
    async (taskId, trigger) => {
      await executor.trigger(taskId, { trigger });
    },
    { defaultTimezone: config.timezone },
  );

  if (register) {
    const enabled = await loadEnabledTasks(db);
    for (const task of enabled) {
      try {
        await scheduler.schedule(task);
      } catch (error) {
        console.error(`[scheduler] cannot schedule "${task.id}":`, error);
      }
    }
  }

  const app = createApi({ db, executor, scheduler });

  return {
    context: {
      db,
      executor,
      scheduler,
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
