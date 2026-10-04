import type { PjhDB, TaskInstanceStatus } from "@pjh/task";
import { Hono } from "hono";
import type { Kysely } from "kysely";
import { z } from "zod";
import type { Executor } from "../engine/executor.ts";
import type { Scheduler } from "../engine/scheduler.ts";
import { instanceToDto, stats, taskToDto } from "./serialize.ts";

export interface ApiDeps {
  db: Kysely<PjhDB>;
  executor: Executor;
  scheduler: Scheduler;
}

const patchSchema = z
  .object({
    enabled: z.boolean().optional(),
    schedule: z.string().min(1).optional(),
    timezone: z.string().min(1).nullable().optional(),
    timeoutMs: z.number().int().nonnegative().nullable().optional(),
    concurrency: z.enum(["skip", "queue", "parallel"]).optional(),
  })
  .strict();

const runSchema = z.object({ payload: z.unknown().optional() }).strict().optional();

const listSchema = z.object({
  taskId: z.string().optional(),
  status: z.enum(["running", "succeeded", "failed", "timeout", "cancelled"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export function createApi(deps: ApiDeps): Hono {
  const { db, executor, scheduler } = deps;
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ ok: true, time: new Date().toISOString() }));

  app.get("/api/stats", async (c) => c.json(await stats(db)));

  app.get("/api/tasks", async (c) => {
    const rows = await db.selectFrom("task").selectAll().orderBy("name").execute();
    return c.json(rows.map(taskToDto));
  });

  app.get("/api/tasks/:id", async (c) => {
    const id = c.req.param("id");
    const row = await db
      .selectFrom("task")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) return c.json({ error: "Task not found" }, 404);
    return c.json(taskToDto(row));
  });

  app.patch("/api/tasks/:id", async (c) => {
    const id = c.req.param("id");
    const body = patchSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) {
      return c.json({ error: "Invalid body", issues: body.error.issues }, 400);
    }

    const existing = await db
      .selectFrom("task")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    if (!existing) return c.json({ error: "Task not found" }, 404);

    const input = body.data;
    const schedule = input.schedule ?? existing.schedule;
    const timezone = input.timezone === undefined ? existing.timezone : input.timezone;

    if (input.schedule !== undefined || input.timezone !== undefined) {
      try {
        scheduler.validate(schedule, timezone ?? undefined);
      } catch (error) {
        return c.json(
          {
            error: "Invalid schedule",
            detail: error instanceof Error ? error.message : String(error),
          },
          400,
        );
      }
    }

    await db
      .updateTable("task")
      .set({
        enabled: input.enabled === undefined ? existing.enabled : input.enabled ? 1 : 0,
        schedule,
        timezone,
        timeout_ms:
          input.timeoutMs === undefined ? existing.timeout_ms : input.timeoutMs,
        concurrency: input.concurrency ?? existing.concurrency,
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", id)
      .execute();

    const updated = await db
      .selectFrom("task")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirstOrThrow();

    await scheduler.schedule({
      id: updated.id,
      schedule: updated.schedule,
      timezone: updated.timezone,
      enabled: updated.enabled === 1,
    });

    const fresh = await db
      .selectFrom("task")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirstOrThrow();

    return c.json(taskToDto(fresh));
  });

  app.post("/api/tasks/:id/run", async (c) => {
    const id = c.req.param("id");
    const body = runSchema.safeParse(await c.req.json().catch(() => undefined));
    const payload = body.success ? body.data?.payload : undefined;

    const result = await executor.trigger(id, { trigger: "manual", payload });
    if (!result.started) {
      const status = result.reason === "unknown-task" ? 404 : 409;
      return c.json({ error: result.reason }, status);
    }
    return c.json({ instanceId: result.instanceId }, 202);
  });

  app.get("/api/instances", async (c) => {
    const parsed = listSchema.safeParse(c.req.query());
    if (!parsed.success) {
      return c.json({ error: "Invalid query", issues: parsed.error.issues }, 400);
    }
    const { taskId, status, limit, offset } = parsed.data;

    let query = db
      .selectFrom("task_instance")
      .selectAll()
      .orderBy("queued_at", "desc")
      .limit(limit)
      .offset(offset);

    if (taskId) query = query.where("task_id", "=", taskId);
    if (status) query = query.where("status", "=", status as TaskInstanceStatus);

    const rows = await query.execute();
    return c.json(rows.map(instanceToDto));
  });

  app.get("/api/instances/:id", async (c) => {
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

  app.post("/api/instances/:id/cancel", async (c) => {
    const id = c.req.param("id");
    const cancelled = executor.cancel(id);
    if (!cancelled) {
      return c.json({ error: "Instance is not running" }, 409);
    }
    return c.json({ ok: true });
  });

  return app;
}
