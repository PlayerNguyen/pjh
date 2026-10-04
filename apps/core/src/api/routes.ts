import type { PjhDB, TaskInstanceStatus } from "@pjh/task";
import { Hono } from "hono";
import type { Kysely } from "kysely";
import { z } from "zod";
import type { DelegationService, ServiceError } from "../engine/delegations.ts";
import type { Executor } from "../engine/executor.ts";
import { delegationToDto, instanceToDto, stats, strategyToDto } from "./serialize.ts";

export interface ApiDeps {
  db: Kysely<PjhDB>;
  executor: Executor;
  delegations: DelegationService;
}

const errorStatus: Record<ServiceError["code"], 400 | 404 | 409> = {
  "unknown-strategy": 400,
  "invalid-args": 400,
  "invalid-schedule": 400,
  "duplicate-args": 409,
  "not-found": 404,
};

const createSchema = z
  .object({
    type: z.string().min(1),
    name: z.string().min(1),
    args: z.unknown().optional(),
    schedule: z.string().min(1).optional(),
    timezone: z.string().min(1).nullable().optional(),
    enabled: z.boolean().optional(),
    timeoutMs: z.number().int().nonnegative().nullable().optional(),
    concurrency: z.enum(["skip", "queue", "parallel"]).optional(),
  })
  .strict();

const patchSchema = z
  .object({
    name: z.string().min(1).optional(),
    args: z.unknown().optional(),
    schedule: z.string().min(1).optional(),
    timezone: z.string().min(1).nullable().optional(),
    enabled: z.boolean().optional(),
    timeoutMs: z.number().int().nonnegative().nullable().optional(),
    concurrency: z.enum(["skip", "queue", "parallel"]).optional(),
  })
  .strict();

const runSchema = z.object({ payload: z.unknown().optional() }).strict().optional();

const listSchema = z.object({
  delegationId: z.string().optional(),
  status: z.enum(["running", "succeeded", "failed", "timeout", "cancelled"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export function createApi(deps: ApiDeps): Hono {
  const { db, executor, delegations } = deps;
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ ok: true, time: new Date().toISOString() }));

  app.get("/api/stats", async (c) => c.json(await stats(db)));

  // --- task strategies (code-defined) ---

  app.get("/api/strategies", async (c) => {
    const rows = await db
      .selectFrom("task_strategy")
      .selectAll()
      .orderBy("name")
      .execute();
    return c.json(rows.map(strategyToDto));
  });

  app.get("/api/strategies/:type", async (c) => {
    const type = c.req.param("type");
    const row = await db
      .selectFrom("task_strategy")
      .selectAll()
      .where("type", "=", type)
      .executeTakeFirst();
    if (!row) return c.json({ error: "Strategy not found" }, 404);
    return c.json(strategyToDto(row));
  });

  // --- task delegations (seeded or user-created) ---

  app.get("/api/tasks", async (c) => {
    const rows = await db
      .selectFrom("task_delegation")
      .selectAll()
      .orderBy("name")
      .execute();
    return c.json(rows.map(delegationToDto));
  });

  app.get("/api/tasks/:id", async (c) => {
    const id = c.req.param("id");
    const row = await db
      .selectFrom("task_delegation")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) return c.json({ error: "Delegation not found" }, 404);
    return c.json(delegationToDto(row));
  });

  app.post("/api/tasks", async (c) => {
    const body = createSchema.safeParse(await c.req.json().catch(() => ({})));
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

  app.patch("/api/tasks/:id", async (c) => {
    const id = c.req.param("id");
    const body = patchSchema.safeParse(await c.req.json().catch(() => ({})));
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

  app.delete("/api/tasks/:id", async (c) => {
    const id = c.req.param("id");
    const removed = await delegations.remove(id);
    if (!removed) return c.json({ error: "Delegation not found" }, 404);
    return c.body(null, 204);
  });

  app.post("/api/tasks/:id/run", async (c) => {
    const id = c.req.param("id");
    const body = runSchema.safeParse(await c.req.json().catch(() => undefined));
    const payload = body.success ? body.data?.payload : undefined;

    const result = await executor.trigger(id, { trigger: "manual", payload });
    if (!result.started) {
      const notFound = result.reason === "unknown-delegation";
      return c.json({ error: result.reason }, notFound ? 404 : 409);
    }
    return c.json({ instanceId: result.instanceId }, 202);
  });

  // --- instances ---

  app.get("/api/instances", async (c) => {
    const parsed = listSchema.safeParse(c.req.query());
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
