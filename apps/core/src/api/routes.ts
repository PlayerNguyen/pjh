import { Hono } from "hono";
import { createHealthController } from "./health/controller.ts";
import { createInstancesController } from "./instances/controller.ts";
import { createStrategiesController } from "./strategies/controller.ts";
import { createTasksController } from "./tasks/controller.ts";
import type { TasksDeps } from "./tasks/types.ts";

export interface ApiDeps extends TasksDeps {}

/**
 * Assembles the REST API from its per-domain controllers. This is the only
 * place routes are wired together; each controller owns its own handlers.
 *
 * @param deps - Database, executor and delegation service.
 * @returns A Hono app serving the full `/api` surface.
 *
 * @example
 * ```ts
 * const app = createApi({ db, executor, delegations });
 * Bun.serve({ fetch: (req) => app.fetch(req) });
 * ```
 */
export function createApi(deps: ApiDeps): Hono {
  const { db, executor, delegations } = deps;
  const app = new Hono();

  app.route("/api", createHealthController({ db }));
  app.route("/api/strategies", createStrategiesController({ db }));
  app.route("/api/tasks", createTasksController({ db, executor, delegations }));
  app.route("/api/instances", createInstancesController({ db, executor }));

  return app;
}
