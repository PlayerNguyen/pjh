import { strategyToDto } from "@pjh/core";
import { Hono } from "hono";
import type { StrategiesDeps } from "./types.ts";

/**
 * Builds the read-only strategies controller, mounted at `/api/strategies`.
 * Strategies are code-defined, so only list and detail routes exist.
 *
 * @param deps - Database handle.
 * @returns A Hono router handling strategy endpoints.
 *
 * @example
 * ```ts
 * app.route("/api/strategies", createStrategiesController({ db }));
 * ```
 */
export function createStrategiesController(deps: StrategiesDeps): Hono {
  const { db } = deps;
  const app = new Hono();

  app.get("/", async (c) => {
    const rows = await db
      .selectFrom("task_strategy")
      .selectAll()
      .orderBy("name")
      .execute();
    return c.json(rows.map(strategyToDto));
  });

  app.get("/:type", async (c) => {
    const type = c.req.param("type");
    const row = await db
      .selectFrom("task_strategy")
      .selectAll()
      .where("type", "=", type)
      .executeTakeFirst();
    if (!row) return c.json({ error: "Strategy not found" }, 404);
    return c.json(strategyToDto(row));
  });

  return app;
}
