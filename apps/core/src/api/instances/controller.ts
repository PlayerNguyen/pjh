import { instanceToDto } from "@pjh/core";
import { Hono } from "hono";
import { listInstancesSchema } from "./schema.ts";
import type { InstanceStatus, InstancesDeps } from "./types.ts";

/**
 * Builds the instances controller, mounted at `/api/instances`. Instances are
 * read-only execution records plus a cancel action.
 *
 * @param deps - Database and executor handles.
 * @returns A Hono router handling instance endpoints.
 *
 * @example
 * ```ts
 * app.route("/api/instances", createInstancesController({ db, executor }));
 * ```
 */
export function createInstancesController(deps: InstancesDeps): Hono {
  const { db, executor } = deps;
  const app = new Hono();

  app.get("/", async (c) => {
    const parsed = listInstancesSchema.safeParse(c.req.query());
    if (!parsed.success) {
      return c.json({ error: "Invalid query", issues: parsed.error.issues }, 400);
    }
    const { delegationId, status, limit, offset } = parsed.data;

    let query = db
      .selectFrom("task_instance")
      .selectAll()
      .orderBy("queued_at", "desc")
      .limit(limit)
      .offset(offset);

    if (delegationId) query = query.where("delegation_id", "=", delegationId);
    if (status) query = query.where("status", "=", status as InstanceStatus);

    const rows = await query.execute();
    return c.json(rows.map(instanceToDto));
  });

  app.get("/:id", async (c) => {
    const id = c.req.param("id");
    const instance = await db
      .selectFrom("task_instance")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    if (!instance) return c.json({ error: "Instance not found" }, 404);

    const logs = await db
      .selectFrom("task_instance_log")
      .selectAll()
      .where("instance_id", "=", id)
      .orderBy("id", "asc")
      .execute();

    return c.json({
      ...instanceToDto(instance),
      logs: logs.map((l) => ({
        id: l.id,
        ts: l.ts,
        level: l.level,
        message: l.message,
        data: l.data,
      })),
    });
  });

  app.post("/:id/cancel", async (c) => {
    const id = c.req.param("id");
    const cancelled = executor.cancel(id);
    if (!cancelled) {
      return c.json({ error: "Instance is not running" }, 409);
    }
    return c.json({ ok: true });
  });

  return app;
}
