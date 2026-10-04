import { delegationToDto } from "@pjh/core";
import type { ServiceError } from "@pjh/process-engine";
import { Hono } from "hono";
import { createTaskSchema, patchTaskSchema, runTaskSchema } from "./schema.ts";
import type { TasksDeps } from "./types.ts";

/**
 * Maps each {@link ServiceError} code to the HTTP status returned to clients.
 *
 * @example
 * ```ts
 * errorStatus["duplicate-args"]; // => 409
 * ```
 */
const errorStatus: Record<ServiceError["code"], 400 | 404 | 409> = {
  "unknown-strategy": 400,
  "invalid-args": 400,
  "invalid-schedule": 400,
  "duplicate-args": 409,
  "not-found": 404,
};

/**
 * Builds the task-delegation CRUD controller, mounted at `/api/tasks`.
 *
 * @param deps - Database, executor and delegation service.
 * @returns A Hono router handling delegation endpoints.
 *
 * @example
 * ```ts
 * const app = new Hono();
 * app.route("/api/tasks", createTasksController({ db, executor, delegations }));
 * ```
 */
export function createTasksController(deps: TasksDeps): Hono {
  const { db, executor, delegations } = deps;
  const app = new Hono();

  app.get("/", async (c) => {
    const rows = await db
      .selectFrom("task_delegation")
      .selectAll()
      .orderBy("name")
      .execute();
    return c.json(rows.map(delegationToDto));
  });

  app.get("/:id", async (c) => {
    const id = c.req.param("id");
    const row = await db
      .selectFrom("task_delegation")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) return c.json({ error: "Delegation not found" }, 404);
    return c.json(delegationToDto(row));
  });

  app.post("/", async (c) => {
    const body = createTaskSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) {
      return c.json({ error: "Invalid body", issues: body.error.issues }, 400);
    }
    const result = await delegations.create(body.data);
    if (!result.ok) {
      return c.json(result.error, errorStatus[result.error.code]);
    }
    const row = await db
      .selectFrom("task_delegation")
      .selectAll()
      .where("id", "=", result.id)
      .executeTakeFirstOrThrow();
    return c.json(delegationToDto(row), 201);
  });

  app.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const body = patchTaskSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) {
      return c.json({ error: "Invalid body", issues: body.error.issues }, 400);
    }
    const result = await delegations.update(id, body.data);
    if (!result.ok) {
      return c.json(result.error, errorStatus[result.error.code]);
    }
    const row = await db
      .selectFrom("task_delegation")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
    return c.json(delegationToDto(row));
  });

  app.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const removed = await delegations.remove(id);
    if (!removed) return c.json({ error: "Delegation not found" }, 404);
    return c.body(null, 204);
  });

  app.post("/:id/run", async (c) => {
    const id = c.req.param("id");
    const body = runTaskSchema.safeParse(await c.req.json().catch(() => undefined));
    const payload = body.success ? body.data?.payload : undefined;

    const result = await executor.trigger(id, { trigger: "manual", payload });
    if (!result.started) {
      const notFound = result.reason === "unknown-delegation";
      return c.json({ error: result.reason }, notFound ? 404 : 409);
    }
    return c.json({ instanceId: result.instanceId }, 202);
  });

  return app;
}
