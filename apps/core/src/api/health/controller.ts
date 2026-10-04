import { stats } from "@pjh/stats";
import { Hono } from "hono";
import type { HealthDeps } from "./types.ts";

/**
 * Builds the health and stats controller, mounted at `/api`. Exposes
 * `GET /api/health` and `GET /api/stats`.
 *
 * @param deps - Database handle used to compute stats.
 * @returns A Hono router handling health/stat endpoints.
 *
 * @example
 * ```ts
 * app.route("/api", createHealthController({ db }));
 * ```
 */
export function createHealthController(deps: HealthDeps): Hono {
  const { db } = deps;
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true, time: new Date().toISOString() }));

  app.get("/stats", async (c) => c.json(await stats(db)));

  return app;
}
